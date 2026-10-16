const express  = require('express');
const router   = express.Router();
const Meal     = require('../models/Meal');
const User     = require('../models/User');
const SettlementPeriod = require('../models/SettlementPeriod');
const { calculateShares, getPriceForDate, getActivePeriod } = require('../helpers/calculations');

/** Serialize a Meal mongoose doc to a flat, frontend-friendly object */
function serializeMeal(meal) {
  const obj = meal.toObject ? meal.toObject() : meal;
  return {
    ...obj,
    id:               obj._id,
    meal_type:        obj.mealType,
    price_per_plate:  obj.pricePerPlate,
    number_of_plates: obj.numberOfPlates,
    total_amount:     obj.totalAmount,
    settlement_period_id: obj.settlementPeriodId,
    participants: (obj.participants || []).map(p => ({
      ...p,
      user_id:      p.userId,
      user_name:    p.userName,
      share_amount: p.shareAmount
    })),
    payments: (obj.payments || []).map(p => ({
      ...p,
      user_id:     p.userId,
      user_name:   p.userName,
      amount_paid: p.amountPaid
    }))
  };
}

/**
 * Determine which period to assign a meal to.
 * Returns the period object, or null if no period covers the date.
 * Throws if the date falls within a SETTLED period.
 */
async function resolvePeriodForDate(date) {
  // Find any period whose date range includes this date
  const period = await SettlementPeriod.findOne({
    startDate: { $lte: date },
    endDate:   { $gte: date }
  });

  if (!period) {
    // Try the active period as a fallback (in case date is today and within range)
    const active = await getActivePeriod();
    return active; // may be null
  }

  if (period.status === 'settled') {
    const err = new Error(
      `The date ${date} falls within a settled period (${period.startDate} → ${period.endDate}). ` +
      `You cannot add or modify meals in a settled period.`
    );
    err.statusCode = 409;
    err.settledPeriodId = period._id;
    throw err;
  }

  return period;
}

// GET /api/meals — list with optional filters
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, meal_type, user_id, paid_by, period_id } = req.query;
    const query = {};

    if (period_id) {
      query.settlementPeriodId = period_id;
    } else if (start_date || end_date) {
      query.date = {};
      if (start_date) query.date.$gte = start_date;
      if (end_date)   query.date.$lte = end_date;
    }
    if (meal_type) query.mealType = meal_type;
    if (user_id)   query['participants.userId'] = user_id;
    if (paid_by)   query['payments.userId']     = paid_by;

    const meals = await Meal.find(query).sort({ date: -1, mealType: -1 });
    res.json(meals.map(serializeMeal));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/meals/:id
router.get('/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json(serializeMeal(meal));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/meals — create
router.post('/', async (req, res) => {
  try {
    const {
      date, meal_type, mealType,
      number_of_plates, numberOfPlates,
      participant_ids, participantIds,
      payments, notes
    } = req.body;

    const mType   = mealType   || meal_type;
    const nPlates = Number(numberOfPlates || number_of_plates);
    const pIds    = participantIds || participant_ids || [];

    if (!date || !mType || !nPlates || !pIds.length)
      return res.status(400).json({ error: 'date, mealType, numberOfPlates, participant_ids are required' });

    // Resolve period — blocks settled dates, returns active period or null
    let period;
    try {
      period = await resolvePeriodForDate(date);
    } catch (err) {
      return res.status(err.statusCode || 409).json({
        error: err.message,
        settled_period_id: err.settledPeriodId
      });
    }

    const [participants_users, allUsers, pricePerPlate] = await Promise.all([
      User.find({ _id: { $in: pIds } }).lean(),
      User.find().lean(),
      getPriceForDate(mType, date)
    ]);

    const totalAmount = Math.round(pricePerPlate * nPlates * 100) / 100;
    const shares      = calculateShares(totalAmount, pIds);

    const participantDocs = participants_users.map(u => ({
      userId:      u._id,
      userName:    u.name,
      shareAmount: shares[u._id.toString()] || 0
    }));

    const paymentDocs = (payments || [])
      .filter(p => Number(p.amount_paid ?? p.amountPaid) > 0)
      .map(p => {
        const uid  = (p.user_id || p.userId).toString();
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', amountPaid: Number(p.amount_paid ?? p.amountPaid) };
      });

    const meal = await Meal.create({
      date, mealType: mType, pricePerPlate, numberOfPlates: nPlates,
      totalAmount, notes: notes || null,
      participants: participantDocs, payments: paymentDocs,
      settlementPeriodId: period ? period._id : null
    });

    res.status(201).json(serializeMeal(meal));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PUT /api/meals/:id — update
router.put('/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    // Block editing meals in settled periods
    if (meal.settlementPeriodId) {
      const period = await SettlementPeriod.findById(meal.settlementPeriodId).lean();
      if (period && period.status === 'settled') {
        return res.status(409).json({
          error: `This meal belongs to a settled period (${period.startDate} → ${period.endDate}) and cannot be edited.`
        });
      }
    }

    const {
      date, meal_type, mealType,
      number_of_plates, numberOfPlates,
      participant_ids, participantIds,
      payments, notes,
      price_per_plate, pricePerPlate: customPrice
    } = req.body;

    const mType   = mealType   || meal_type;
    const nPlates = Number(numberOfPlates || number_of_plates);
    const pIds    = participantIds || participant_ids || [];

    // If the date is changing, verify the new date is not in a settled period
    if (date && date !== meal.date) {
      try {
        await resolvePeriodForDate(date);
      } catch (err) {
        return res.status(err.statusCode || 409).json({ error: err.message });
      }
    }

    const [allUsers, pricePerPlate] = await Promise.all([
      User.find().lean(),
      (customPrice || price_per_plate)
        ? Promise.resolve(Number(customPrice || price_per_plate))
        : getPriceForDate(mType, date)
    ]);

    const totalAmount = Math.round(pricePerPlate * nPlates * 100) / 100;
    const shares      = calculateShares(totalAmount, pIds);

    const participantDocs = pIds.map(uid => {
      const user = allUsers.find(u => u._id.toString() === uid.toString());
      return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid.toString()] || 0 };
    });

    const paymentDocs = (payments || [])
      .filter(p => Number(p.amount_paid ?? p.amountPaid) > 0)
      .map(p => {
        const uid  = (p.user_id || p.userId).toString();
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', amountPaid: Number(p.amount_paid ?? p.amountPaid) };
      });

    Object.assign(meal, {
      date, mealType: mType, pricePerPlate, numberOfPlates: nPlates,
      totalAmount, notes: notes || null,
      participants: participantDocs, payments: paymentDocs
    });

    await meal.save();
    res.json(serializeMeal(meal));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/meals/:id
router.delete('/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    // Block deleting meals in settled periods
    if (meal.settlementPeriodId) {
      const period = await SettlementPeriod.findById(meal.settlementPeriodId).lean();
      if (period && period.status === 'settled') {
        return res.status(409).json({
          error: `This meal belongs to a settled period (${period.startDate} → ${period.endDate}) and cannot be deleted.`
        });
      }
    }

    await meal.deleteOne();
    res.json({ success: true, id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

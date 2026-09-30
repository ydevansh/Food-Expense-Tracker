const express = require('express');
const router  = express.Router();
const Meal    = require('../models/Meal');
const User    = require('../models/User');
const { calculateShares, getPriceForDate } = require('../helpers/calculations');

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

// GET /api/meals — list with optional filters
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, meal_type, user_id, paid_by } = req.query;
    const query = {};

    if (start_date || end_date) {
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
      participants: participantDocs, payments: paymentDocs
    });

    res.status(201).json(serializeMeal(meal));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PUT /api/meals/:id — update
router.put('/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

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
    const meal = await Meal.findByIdAndDelete(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json({ success: true, id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

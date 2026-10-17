const express  = require('express');
const router   = express.Router();
const Meal     = require('../models/Meal');
const User     = require('../models/User');
const SettlementPeriod = require('../models/SettlementPeriod');
const {
  calculateShares,
  calculateQuantityShares,
  calculateMultiItemShares,
  getPriceForDate,
  getActivePeriod
} = require('../helpers/calculations');
const { requireAdmin } = require('../middleware/auth');

// ─── Serializer ───────────────────────────────────────────────────────────────
/** Serialize a Meal mongoose doc to a flat, frontend-friendly object */
function serializeMeal(meal) {
  const obj = meal.toObject ? meal.toObject() : meal;
  return {
    ...obj,
    id:               obj._id,
    meal_type:        obj.mealType,
    food_type:        obj.foodType,
    pricing_method:   obj.pricingMethod,
    split_method:     obj.splitMethod,
    price_per_plate:  obj.pricePerPlate,
    number_of_plates: obj.numberOfPlates,
    total_amount:     obj.totalAmount,
    custom_price:     obj.customPrice,
    description:      obj.description,
    settlement_period_id: obj.settlementPeriodId,
    items: (obj.items || []).map(it => ({
      ...it,
      id: it._id
    })),
    participant_item_qtys: (obj.participantItemQtys || []).map(piq => ({
      ...piq,
      user_id:  piq.userId,
      item_id:  piq.itemId
    })),
    participants: (obj.participants || []).map(p => ({
      ...p,
      user_id:      p.userId,
      user_name:    p.userName,
      share_amount: p.shareAmount,
      quantity:     p.quantity || 0
    })),
    payments: (obj.payments || []).map(p => ({
      ...p,
      user_id:     p.userId,
      user_name:   p.userName,
      amount_paid: p.amountPaid
    }))
  };
}

// ─── Period resolver ──────────────────────────────────────────────────────────
/**
 * Determine which period to assign a meal to.
 * Returns the period object, or null if no period covers the date.
 * Throws if the date falls within a SETTLED period.
 */
async function resolvePeriodForDate(date) {
  const period = await SettlementPeriod.findOne({
    startDate: { $lte: date },
    endDate:   { $gte: date }
  });

  if (!period) {
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

// ─── Share calculator ─────────────────────────────────────────────────────────
/**
 * Given the full meal payload (already validated), compute:
 *   - totalAmount
 *   - participantDocs  [{ userId, userName, shareAmount, quantity }]
 *   - processedItems   (for custom meals)
 *
 * Supports all modes:
 *   Regular  → plates × pricePerPlate, equal split
 *   Custom/per_plate  → quantity × unitPrice, equal OR quantity split
 *   Custom/per_item   → per-person item quantities × unitPrice
 *   Custom/manual     → fixed total, equal split
 *   Multi-item custom → sum of items, equal OR quantity split
 */
function computeMealFinancials(body, allUsers) {
  const {
    foodType        = 'regular',
    pricingMethod,
    splitMethod     = 'equal',
    // Regular
    numberOfPlates,
    pricePerPlate: priceOverride,
    // Custom single-price
    quantity,
    unitPrice,
    manualTotal,
    // Per-participant quantities (per_item mode, single item)
    participantQuantities, // { [userId]: qty }
    // Multi-item
    items,                 // [{ description, quantity, unitPrice, unit, participantQtys: { [userId]: qty } }]
    // Participants
    participantIds,
    // Description
    description
  } = body;

  const pIds = (participantIds || []).map(id => id.toString());
  if (pIds.length === 0) throw Object.assign(new Error('At least one participant is required'), { statusCode: 400 });

  let totalAmount     = 0;
  let participantDocs = [];
  let processedItems  = [];
  let processedItemQtys = [];

  // ── REGULAR MEAL ──────────────────────────────────────────────────────────
  if (foodType === 'regular') {
    const nPlates = Number(numberOfPlates) || 1;
    const ppp     = Number(priceOverride)  || 0;
    if (ppp <= 0)  throw Object.assign(new Error('Price per plate must be > 0'), { statusCode: 400 });
    if (nPlates < 1) throw Object.assign(new Error('Number of plates must be >= 1'), { statusCode: 400 });

    totalAmount = Math.round(ppp * nPlates * 100) / 100;
    const shares = calculateShares(totalAmount, pIds);

    participantDocs = pIds.map(uid => {
      const user = allUsers.find(u => u._id.toString() === uid);
      return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid] || 0, quantity: 0 };
    });

    return {
      totalAmount, participantDocs, processedItems, processedItemQtys,
      pricePerPlate: ppp, numberOfPlates: nPlates,
      foodType: 'regular', pricingMethod: null, splitMethod: 'equal',
      description: description || null
    };
  }

  // ── CUSTOM MEAL ───────────────────────────────────────────────────────────

  // -- Multi-item custom (items array provided) --
  if (items && items.length > 0) {
    processedItems = items.map((it, idx) => {
      const qty  = Number(it.quantity)  || 0;
      const up   = Number(it.unitPrice) || 0;
      const tot  = Math.round(qty * up * 100) / 100;
      return {
        description: it.description || `Item ${idx + 1}`,
        quantity:    qty,
        unitPrice:   up,
        totalAmount: tot,
        unit:        it.unit || 'plate'
      };
    });

    totalAmount = Math.round(processedItems.reduce((s, it) => s + it.totalAmount, 0) * 100) / 100;

    // Collect per-participant per-item quantities
    const hasPerPersonQtys = items.some(it => it.participantQtys && Object.keys(it.participantQtys || {}).length > 0);

    let shares;
    if (splitMethod === 'quantity' && hasPerPersonQtys) {
      // Build flat participantItemQtys list
      items.forEach((it, idx) => {
        const savedItem = processedItems[idx];
        if (it.participantQtys) {
          Object.entries(it.participantQtys).forEach(([uid, qty]) => {
            processedItemQtys.push({
              userId:   uid,
              userName: (allUsers.find(u => u._id.toString() === uid) || {}).name || '',
              itemId:   `placeholder_${idx}`, // will be replaced with real _id after create
              quantity: Number(qty) || 0
            });
          });
        }
      });

      shares = calculateMultiItemShares(
        processedItemQtys.map((piq, i) => ({
          userId: piq.userId,
          itemId: `placeholder_${Math.floor(i / pIds.length)}`,
          quantity: piq.quantity
        })),
        processedItems.map((it, i) => ({ _id: `placeholder_${i}`, unitPrice: it.unitPrice })),
        pIds
      );
    } else {
      shares = calculateShares(totalAmount, pIds);
    }

    participantDocs = pIds.map(uid => {
      const user = allUsers.find(u => u._id.toString() === uid);
      return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid] || 0, quantity: 0 };
    });

    return {
      totalAmount, participantDocs, processedItems, processedItemQtys,
      pricePerPlate: null, numberOfPlates: null,
      foodType: 'custom',
      pricingMethod: pricingMethod || 'per_plate',
      splitMethod,
      description: description || null
    };
  }

  // -- Single-price custom modes --
  switch (pricingMethod) {
    case 'per_plate': {
      const qty = Number(quantity)  || 1;
      const up  = Number(unitPrice) || 0;
      if (up <= 0) throw Object.assign(new Error('Unit price must be > 0'), { statusCode: 400 });
      totalAmount = Math.round(qty * up * 100) / 100;

      const shares = splitMethod === 'quantity' && participantQuantities
        ? calculateQuantityShares(participantQuantities, up)
        : calculateShares(totalAmount, pIds);

      participantDocs = pIds.map(uid => {
        const user = allUsers.find(u => u._id.toString() === uid);
        const pQty = participantQuantities ? (Number(participantQuantities[uid]) || 0) : 0;
        return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid] || 0, quantity: pQty };
      });

      processedItems = [{
        description: description || 'Custom plate',
        quantity: qty, unitPrice: up,
        totalAmount, unit: 'plate'
      }];
      break;
    }

    case 'per_item': {
      // participantQuantities: { [userId]: qty }; each person's units × unitPrice
      const up = Number(unitPrice) || 0;
      if (up <= 0) throw Object.assign(new Error('Unit price must be > 0'), { statusCode: 400 });

      let totalQty = 0;
      const qtyMap = {};
      pIds.forEach(uid => {
        const qty = Number((participantQuantities || {})[uid]) || 0;
        qtyMap[uid] = qty;
        totalQty += qty;
      });

      totalAmount = Math.round(totalQty * up * 100) / 100;
      const shares = calculateQuantityShares(qtyMap, up);

      participantDocs = pIds.map(uid => {
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid] || 0, quantity: qtyMap[uid] || 0 };
      });

      processedItems = [{
        description: description || 'Per-item',
        quantity: totalQty, unitPrice: up,
        totalAmount, unit: body.unit || 'item'
      }];
      break;
    }

    case 'manual': {
      const mt = Number(manualTotal) || 0;
      if (mt <= 0) throw Object.assign(new Error('Manual total must be > 0'), { statusCode: 400 });
      totalAmount = mt;
      const shares = calculateShares(totalAmount, pIds);
      participantDocs = pIds.map(uid => {
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', shareAmount: shares[uid] || 0, quantity: 0 };
      });
      processedItems = [{
        description: description || 'Custom meal',
        quantity: 1, unitPrice: mt,
        totalAmount: mt, unit: 'total'
      }];
      break;
    }

    default:
      throw Object.assign(new Error('Invalid pricing method for custom meal'), { statusCode: 400 });
  }

  return {
    totalAmount, participantDocs, processedItems, processedItemQtys,
    pricePerPlate: null, numberOfPlates: null,
    foodType: 'custom', pricingMethod, splitMethod,
    description: description || null
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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

// POST /api/meals — create (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { date, meal_type, mealType, payments, notes } = req.body;
    const mType = mealType || meal_type;

    if (!date || !mType)
      return res.status(400).json({ error: 'date and mealType are required' });

    // Resolve period — blocks settled dates
    let period;
    try {
      period = await resolvePeriodForDate(date);
    } catch (err) {
      return res.status(err.statusCode || 409).json({
        error: err.message,
        settled_period_id: err.settledPeriodId
      });
    }

    // For regular meals, auto-fill pricePerPlate from settings if not provided
    const body = { ...req.body };
    if (body.foodType === 'regular' || !body.foodType) {
      body.foodType = 'regular';
      if (!body.pricePerPlate && !body.price_per_plate) {
        body.pricePerPlate = await getPriceForDate(mType, date);
        body.customPrice   = false;
      } else {
        const settingsPrice = await getPriceForDate(mType, date);
        body.pricePerPlate  = Number(body.pricePerPlate || body.price_per_plate);
        body.customPrice    = Math.abs(body.pricePerPlate - settingsPrice) > 0.01;
      }
    }

    // Normalize participant ids
    body.participantIds = body.participantIds || body.participant_ids || [];

    const allUsers = await User.find().lean();

    let financials;
    try {
      financials = computeMealFinancials(body, allUsers);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    // Build payment docs
    const paymentDocs = (payments || [])
      .filter(p => Number(p.amount_paid ?? p.amountPaid) > 0)
      .map(p => {
        const uid  = (p.user_id || p.userId).toString();
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', amountPaid: Number(p.amount_paid ?? p.amountPaid) };
      });

    const meal = await Meal.create({
      date,
      mealType:         mType,
      foodType:         financials.foodType,
      pricingMethod:    financials.pricingMethod,
      splitMethod:      financials.splitMethod,
      description:      financials.description,
      pricePerPlate:    financials.pricePerPlate,
      numberOfPlates:   financials.numberOfPlates,
      customPrice:      body.customPrice || false,
      totalAmount:      financials.totalAmount,
      items:            financials.processedItems,
      participantItemQtys: [], // will be set below with real item IDs
      participants:     financials.participantDocs,
      payments:         paymentDocs,
      notes:            notes || null,
      settlementPeriodId: period ? period._id : null
    });

    res.status(201).json(serializeMeal(meal));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PUT /api/meals/:id — update (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
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

    const { date, meal_type, mealType, payments, notes } = req.body;
    const mType = mealType || meal_type || meal.mealType;

    // If the date is changing, verify the new date is not in a settled period
    const newDate = date || meal.date;
    if (date && date !== meal.date) {
      try {
        await resolvePeriodForDate(date);
      } catch (err) {
        return res.status(err.statusCode || 409).json({ error: err.message });
      }
    }

    const body = { ...req.body };
    if (body.foodType === 'regular' || !body.foodType) {
      body.foodType = 'regular';
      if (!body.pricePerPlate && !body.price_per_plate) {
        body.pricePerPlate = await getPriceForDate(mType, newDate);
        body.customPrice   = false;
      } else {
        const settingsPrice = await getPriceForDate(mType, newDate);
        body.pricePerPlate  = Number(body.pricePerPlate || body.price_per_plate);
        body.customPrice    = Math.abs(body.pricePerPlate - settingsPrice) > 0.01;
      }
    }

    body.participantIds = body.participantIds || body.participant_ids || [];

    const allUsers = await User.find().lean();

    let financials;
    try {
      financials = computeMealFinancials(body, allUsers);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    const paymentDocs = (payments || [])
      .filter(p => Number(p.amount_paid ?? p.amountPaid) > 0)
      .map(p => {
        const uid  = (p.user_id || p.userId).toString();
        const user = allUsers.find(u => u._id.toString() === uid);
        return { userId: uid, userName: user ? user.name : '', amountPaid: Number(p.amount_paid ?? p.amountPaid) };
      });

    Object.assign(meal, {
      date:             newDate,
      mealType:         mType,
      foodType:         financials.foodType,
      pricingMethod:    financials.pricingMethod,
      splitMethod:      financials.splitMethod,
      description:      financials.description,
      pricePerPlate:    financials.pricePerPlate,
      numberOfPlates:   financials.numberOfPlates,
      customPrice:      body.customPrice || false,
      totalAmount:      financials.totalAmount,
      items:            financials.processedItems,
      participants:     financials.participantDocs,
      payments:         paymentDocs,
      notes:            notes || null
    });

    await meal.save();
    res.json(serializeMeal(meal));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/meals/:id (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
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

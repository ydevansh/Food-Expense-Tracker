const express = require('express');
const router  = express.Router();
const Meal    = require('../models/Meal');
const User    = require('../models/User');

function serializeMeal(m) {
  const obj = m.toObject ? m.toObject() : m;
  return {
    ...obj, id: obj._id,
    meal_type: obj.mealType, price_per_plate: obj.pricePerPlate,
    number_of_plates: obj.numberOfPlates, total_amount: obj.totalAmount,
    participants: (obj.participants||[]).map(p=>({ ...p, user_id: p.userId, user_name: p.userName, share_amount: p.shareAmount })),
    payments:     (obj.payments||[]).map(p=>({ ...p, user_id: p.userId, user_name: p.userName, amount_paid: p.amountPaid }))
  };
}

// GET /api/daily/:date
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const [meals, users] = await Promise.all([
      Meal.find({ date }).sort({ mealType: 1 }),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    let dayTotal = 0;
    const userShares = {}, userPayments = {};
    users.forEach(u => { userShares[u._id.toString()] = 0; userPayments[u._id.toString()] = 0; });

    meals.forEach(meal => {
      dayTotal += meal.totalAmount;
      meal.participants.forEach(p => { userShares[p.userId.toString()]   = (userShares[p.userId.toString()]   || 0) + p.shareAmount; });
      meal.payments.forEach(p    => { userPayments[p.userId.toString()] = (userPayments[p.userId.toString()] || 0) + p.amountPaid; });
    });

    const user_summary = users.map(u => ({
      user:        { _id: u._id, id: u._id, name: u.name },
      total_share: Math.round((userShares[u._id.toString()]   || 0) * 100) / 100,
      total_paid:  Math.round((userPayments[u._id.toString()] || 0) * 100) / 100
    }));

    res.json({
      date,
      meals:        meals.map(serializeMeal),
      day_total:    Math.round(dayTotal * 100) / 100,
      user_summary
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

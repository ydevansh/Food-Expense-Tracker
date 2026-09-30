const express = require('express');
const router  = express.Router();
const Meal    = require('../models/Meal');
const User    = require('../models/User');
const { getBalances } = require('../helpers/calculations');

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

router.get('/', async (req, res) => {
  try {
    const today      = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const [todayMeals, monthMeals, users] = await Promise.all([
      Meal.find({ date: today }).sort({ mealType: 1 }),
      Meal.find({ date: { $gte: monthStart } }).lean(),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    let totalExpense = 0, breakfastExpense = 0, dinnerExpense = 0, totalPlates = 0;
    const uniqueDates = new Set();
    monthMeals.forEach(m => {
      totalExpense += m.totalAmount;
      if (m.mealType === 'breakfast') breakfastExpense += m.totalAmount;
      else                            dinnerExpense    += m.totalAmount;
      totalPlates += m.numberOfPlates;
      uniqueDates.add(m.date);
    });

    const userBalances = await getBalances(users, monthStart, null);

    res.json({
      today_date: today,
      today:      todayMeals.map(serializeMeal),
      month_stats: {
        meal_count:        monthMeals.length,
        total_expense:     Math.round(totalExpense     * 100) / 100,
        breakfast_expense: Math.round(breakfastExpense * 100) / 100,
        dinner_expense:    Math.round(dinnerExpense    * 100) / 100,
        total_plates:      totalPlates,
        days_with_meals:   uniqueDates.size
      },
      user_balances: userBalances
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const Meal    = require('../models/Meal');
const User    = require('../models/User');
const { getBalances } = require('../helpers/calculations');

// GET /api/reports?start_date=&end_date=
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const query = {};
    if (start_date || end_date) {
      query.date = {};
      if (start_date) query.date.$gte = start_date;
      if (end_date)   query.date.$lte = end_date;
    }

    const [meals, users] = await Promise.all([
      Meal.find(query).lean(),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    let totalExpense = 0, breakfastExpense = 0, dinnerExpense = 0, totalPlates = 0;
    const uniqueDates = new Set();
    meals.forEach(m => {
      totalExpense += m.totalAmount;
      if (m.mealType === 'breakfast') breakfastExpense += m.totalAmount;
      else                            dinnerExpense    += m.totalAmount;
      totalPlates += m.numberOfPlates;
      uniqueDates.add(m.date);
    });

    res.json({
      stats: {
        meal_count:        meals.length,
        total_expense:     Math.round(totalExpense     * 100) / 100,
        breakfast_expense: Math.round(breakfastExpense * 100) / 100,
        dinner_expense:    Math.round(dinnerExpense    * 100) / 100,
        total_plates:      totalPlates,
        days_with_meals:   uniqueDates.size
      },
      user_stats: await getBalances(users, start_date || null, end_date || null)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

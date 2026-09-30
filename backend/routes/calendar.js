const express = require('express');
const router  = express.Router();
const Meal    = require('../models/Meal');

// GET /api/calendar/:year/:month
router.get('/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const prefix = `${year}-${month.padStart(2, '0')}`;

    // Query all meals in this month
    const meals = await Meal.find({
      date: { $gte: `${prefix}-01`, $lte: `${prefix}-31` }
    }, { date: 1, mealType: 1, totalAmount: 1 }).lean();

    const dateMap = {};
    meals.forEach(({ date, mealType, totalAmount }) => {
      if (!dateMap[date]) dateMap[date] = { breakfast: false, dinner: false, day_total: 0 };
      dateMap[date][mealType]  = true;
      dateMap[date].day_total += totalAmount;
    });

    Object.values(dateMap).forEach(d => {
      d.day_total = Math.round(d.day_total * 100) / 100;
    });

    res.json(dateMap);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

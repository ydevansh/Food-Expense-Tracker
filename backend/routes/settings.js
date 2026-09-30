const express      = require('express');
const router       = express.Router();
const PriceSetting = require('../models/PriceSetting');
const { getPriceForDate } = require('../helpers/calculations');

// GET /api/settings — all price history
router.get('/', async (req, res) => {
  try {
    const settings = await PriceSetting.find()
      .sort({ effectiveFrom: -1, createdAt: -1 })
      .lean();
    res.json(settings.map(s => ({ ...s, id: s._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/current — current prices for a date
router.get('/current', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [breakfast, dinner] = await Promise.all([
      getPriceForDate('breakfast', date),
      getPriceForDate('dinner',    date)
    ]);
    res.json({ breakfast, dinner });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings — update price (creates new history entry)
router.post('/', async (req, res) => {
  try {
    const { meal_type, mealType, price, effective_from, effectiveFrom } = req.body;
    const setting = await PriceSetting.create({
      mealType:      mealType      || meal_type,
      price:         Number(price),
      effectiveFrom: effectiveFrom || effective_from
    });
    res.status(201).json({ ...setting.toObject(), id: setting._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

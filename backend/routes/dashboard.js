const express  = require('express');
const router   = express.Router();
const Meal     = require('../models/Meal');
const User     = require('../models/User');
const { getBalances, getActivePeriod, buildPeriodLabel } = require('../helpers/calculations');

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

    // ── Determine the active period ────────────────────────────────────────
    const activePeriod = await getActivePeriod();

    // ── Today's meals (always show regardless of period) ──────────────────
    const [todayMeals, users] = await Promise.all([
      Meal.find({ date: today }).sort({ mealType: 1 }),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    // ── Active-period balances and stats ──────────────────────────────────
    let userBalances   = [];
    let periodStats    = { meal_count: 0, total_expense: 0, breakfast_expense: 0, dinner_expense: 0, total_plates: 0, days_with_meals: 0 };
    let periodInfo     = null;

    if (activePeriod) {
      // Scope balances exclusively to the active period
      userBalances = await getBalances(users, null, null, activePeriod._id.toString());

      // Aggregate stats for the active period only
      const periodMeals = await Meal.find({ settlementPeriodId: activePeriod._id }).lean();
      const uniqueDates  = new Set();
      periodMeals.forEach(m => {
        periodStats.total_expense     += m.totalAmount;
        periodStats.meal_count        += 1;
        periodStats.total_plates      += m.numberOfPlates;
        if (m.mealType === 'breakfast') periodStats.breakfast_expense += m.totalAmount;
        else                            periodStats.dinner_expense    += m.totalAmount;
        uniqueDates.add(m.date);
      });
      periodStats.days_with_meals  = uniqueDates.size;
      periodStats.total_expense    = Math.round(periodStats.total_expense    * 100) / 100;
      periodStats.breakfast_expense= Math.round(periodStats.breakfast_expense* 100) / 100;
      periodStats.dinner_expense   = Math.round(periodStats.dinner_expense   * 100) / 100;

      periodInfo = {
        id:         activePeriod._id,
        start_date: activePeriod.startDate,
        end_date:   activePeriod.endDate,
        status:     activePeriod.status,
        label:      activePeriod.label || buildPeriodLabel(activePeriod.startDate, activePeriod.endDate)
      };
    } else {
      // No active period — balances are all zero; show month stats for context only
      const monthStart = today.substring(0, 7) + '-01';
      const monthMeals = await Meal.find({ date: { $gte: monthStart } }).lean();
      const uniqueDates = new Set();
      monthMeals.forEach(m => {
        periodStats.total_expense     += m.totalAmount;
        periodStats.meal_count        += 1;
        periodStats.total_plates      += m.numberOfPlates;
        if (m.mealType === 'breakfast') periodStats.breakfast_expense += m.totalAmount;
        else                            periodStats.dinner_expense    += m.totalAmount;
        uniqueDates.add(m.date);
      });
      periodStats.days_with_meals  = uniqueDates.size;
      periodStats.total_expense    = Math.round(periodStats.total_expense    * 100) / 100;
      periodStats.breakfast_expense= Math.round(periodStats.breakfast_expense* 100) / 100;
      periodStats.dinner_expense   = Math.round(periodStats.dinner_expense   * 100) / 100;

      userBalances = users.map(u => ({
        user:        { _id: u._id, id: u._id, name: u.name },
        total_share: 0,
        total_paid:  0,
        balance:     0
      }));
    }

    res.json({
      today_date:    today,
      today:         todayMeals.map(serializeMeal),
      active_period: periodInfo,
      period_stats:  periodStats,
      // Keep month_stats as alias for backward compatibility
      month_stats:   periodStats,
      user_balances: userBalances
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;

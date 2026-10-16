const PriceSetting      = require('../models/PriceSetting');
const Meal              = require('../models/Meal');
const SettlementPeriod  = require('../models/SettlementPeriod');

/**
 * Distribute totalAmount among userIds with proper penny rounding.
 * Guarantees sum of shares === totalAmount.
 * Returns { [userId.toString()]: shareAmount }
 */
function calculateShares(totalAmount, userIds) {
  const n = userIds.length;
  if (n === 0) return {};
  const totalCents = Math.round(totalAmount * 100);
  const baseCents  = Math.floor(totalCents / n);
  const extraCents = totalCents - baseCents * n;
  const shares = {};
  userIds.forEach((uid, i) => {
    shares[uid.toString()] = (baseCents + (i < extraCents ? 1 : 0)) / 100;
  });
  return shares;
}

/**
 * Get the price for a mealType effective on or before a given date.
 */
async function getPriceForDate(mealType, date) {
  const row = await PriceSetting
    .findOne({ mealType, effectiveFrom: { $lte: date } })
    .sort({ effectiveFrom: -1 });
  return row ? row.price : (mealType === 'breakfast' ? 50 : 70);
}

/**
 * Compute running balances (share vs paid) for each user.
 * Scope: EITHER by settlementPeriodId (preferred) OR by date range.
 *
 * @param {Array}  users         – User lean docs
 * @param {string} startDate     – YYYY-MM-DD (inclusive), ignored when periodId provided
 * @param {string} endDate       – YYYY-MM-DD (inclusive), ignored when periodId provided
 * @param {string} periodId      – If set, only meals with this settlementPeriodId are used
 */
async function getBalances(users, startDate, endDate, periodId) {
  let query = {};

  if (periodId) {
    // Primary path: scope to the period
    query.settlementPeriodId = periodId;
  } else if (startDate || endDate) {
    // Legacy / report path: use date range
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate)   query.date.$lte = endDate;
  }

  const meals = await Meal.find(query).lean();

  return users.map(user => {
    let totalShare = 0, totalPaid = 0;
    const uid = user._id.toString();

    meals.forEach(meal => {
      const p   = meal.participants.find(p => p.userId.toString() === uid);
      const pay = meal.payments.find(p   => p.userId.toString() === uid);
      if (p)   totalShare += p.shareAmount;
      if (pay) totalPaid  += pay.amountPaid;
    });

    totalShare = Math.round(totalShare * 100) / 100;
    totalPaid  = Math.round(totalPaid  * 100) / 100;

    return {
      user:        { _id: user._id, id: user._id, name: user.name },
      total_share: totalShare,
      total_paid:  totalPaid,
      balance:     Math.round((totalPaid - totalShare) * 100) / 100
    };
  });
}

/**
 * Minimize the number of settlement transactions using a greedy algorithm.
 * balances: [{ user: { _id, name }, balance }]  (+ = creditor, − = debtor)
 */
function generateSettlementTransactions(balances) {
  const transactions = [];
  const debtors   = balances
    .filter(b => b.balance < -0.01)
    .map(b => ({ userId: b.user._id, name: b.user.name, amount: -b.balance }));
  const creditors = balances
    .filter(b => b.balance >  0.01)
    .map(b => ({ userId: b.user._id, name: b.user.name, amount:  b.balance }));

  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di], c = creditors[ci];
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0.005) {
      transactions.push({
        fromUserId: d.userId, fromUserName: d.name,
        toUserId:   c.userId, toUserName:   c.name,
        amount:     Math.round(amount * 100) / 100
      });
    }
    d.amount -= amount; c.amount -= amount;
    if (d.amount < 0.005) di++;
    if (c.amount < 0.005) ci++;
  }
  return transactions;
}

/**
 * Return the currently active SettlementPeriod, or null if none exists.
 */
async function getActivePeriod() {
  return SettlementPeriod.findOne({ status: 'active' }).sort({ startDate: -1 });
}

/**
 * Build a human-readable label for a period, e.g. "October 1–15, 2026"
 */
function buildPeriodLabel(startDate, endDate) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [, em, ed]   = endDate.split('-').map(Number);
  if (sm === em) {
    return `${months[sm - 1]} ${sd}–${ed}, ${sy}`;
  }
  return `${months[sm - 1]} ${sd} – ${months[em - 1]} ${ed}, ${sy}`;
}

module.exports = {
  calculateShares,
  getPriceForDate,
  getBalances,
  generateSettlementTransactions,
  getActivePeriod,
  buildPeriodLabel
};

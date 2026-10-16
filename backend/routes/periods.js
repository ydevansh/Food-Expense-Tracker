/**
 * /api/periods — SettlementPeriod lifecycle management
 *
 * GET    /api/periods                  — all periods (newest first)
 * GET    /api/periods/active           — the single active period + live balances
 * GET    /api/periods/:id              — one period by id
 * POST   /api/periods                  — create a new period (only if no active period)
 * POST   /api/periods/:id/calculate    — calculate settlement for active/pending period (idempotent)
 * POST   /api/periods/:id/confirm      — mark period as settled, create next period optionally
 * PUT    /api/periods/:id/transactions/:txId — toggle paid/pending on a transaction
 * DELETE /api/periods/:id              — delete a period (only non-settled & no attached meals)
 */

const express          = require('express');
const router           = express.Router();
const SettlementPeriod = require('../models/SettlementPeriod');
const Meal             = require('../models/Meal');
const User             = require('../models/User');
const {
  getBalances,
  generateSettlementTransactions,
  getActivePeriod,
  buildPeriodLabel
} = require('../helpers/calculations');
const { requireAdmin } = require('../middleware/auth');

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeTx(t) {
  return {
    ...t,
    id:             t._id,
    from_user_id:   t.fromUserId,
    from_user_name: t.fromUserName,
    to_user_id:     t.toUserId,
    to_user_name:   t.toUserName
  };
}

function serializePeriod(p, liveBalances) {
  const obj = p.toObject ? p.toObject() : p;
  return {
    ...obj,
    id:         obj._id,
    start_date: obj.startDate,
    end_date:   obj.endDate,
    settled_at: obj.settledAt,
    total_expense: obj.totalExpense,
    label:      obj.label || buildPeriodLabel(obj.startDate, obj.endDate),
    transactions: (obj.transactions || []).map(serializeTx),
    // live balances (only for active/pending); for settled use balanceSnapshot
    balances:   liveBalances || obj.balanceSnapshot.map(b => ({
      user:        { _id: b.userId, id: b.userId, name: b.userName },
      total_share: b.totalShare,
      total_paid:  b.totalPaid,
      balance:     b.balance
    }))
  };
}

// ─── GET /api/periods ─────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const [periods, users] = await Promise.all([
      SettlementPeriod.find().sort({ startDate: -1 }),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    const result = await Promise.all(periods.map(async p => {
      if (p.status === 'settled') {
        // Use the stored snapshot — never recalculate settled data
        return serializePeriod(p, null);
      }
      // active or pending: return live balances
      const balances = await getBalances(users, null, null, p._id.toString());
      return serializePeriod(p, balances);
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/periods/active ──────────────────────────────────────────────────

router.get('/active', async (req, res) => {
  try {
    const period = await getActivePeriod();
    if (!period) return res.json(null);

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, null, null, period._id.toString());
    res.json(serializePeriod(period, balances));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/periods/:id ─────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ error: 'Period not found' });

    const users = await User.find().sort({ createdAt: 1 }).lean();

    if (period.status === 'settled') {
      return res.json(serializePeriod(period, null));
    }

    const balances = await getBalances(users, null, null, period._id.toString());
    res.json(serializePeriod(period, balances));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/periods ────────────────────────────────────────────────────────
// Creates a NEW accounting period. Requires no other active period to exist.

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { start_date, startDate, end_date, endDate, label } = req.body;
    const sDate = (startDate || start_date || '').trim();
    const eDate = (endDate   || end_date   || '').trim();

    if (!sDate || !eDate)
      return res.status(400).json({ error: 'start_date and end_date are required' });
    if (sDate > eDate)
      return res.status(400).json({ error: 'start_date must be on or before end_date' });

    // Block creation if there is already an active or pending period
    const existing = await SettlementPeriod.findOne({ status: { $in: ['active', 'pending'] } });
    if (existing)
      return res.status(409).json({
        error: `There is already an ${existing.status} period (${existing.startDate} → ${existing.endDate}). Settle it before creating a new one.`,
        existingPeriodId: existing._id
      });

    // Check for date overlap with any existing settled period
    const overlap = await SettlementPeriod.findOne({
      $or: [
        { startDate: { $lte: eDate }, endDate: { $gte: sDate } }
      ]
    });
    if (overlap)
      return res.status(409).json({
        error: `The date range overlaps with an existing period (${overlap.startDate} → ${overlap.endDate}).`
      });

    const periodLabel = label || buildPeriodLabel(sDate, eDate);
    const period = await SettlementPeriod.create({
      startDate: sDate,
      endDate:   eDate,
      status:    'active',
      label:     periodLabel
    });

    // Migrate any orphaned meals (no period) whose date falls in this range
    const migrated = await Meal.updateMany(
      { settlementPeriodId: null, date: { $gte: sDate, $lte: eDate } },
      { $set: { settlementPeriodId: period._id } }
    );

    console.log(`✅ Period created: ${periodLabel} — migrated ${migrated.modifiedCount} orphan meal(s)`);

    res.status(201).json(serializePeriod(period, []));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── POST /api/periods/:id/calculate ─────────────────────────────────────────
// Calculate (or recalculate) settlement for an active or pending period.
// Idempotent — safe to call multiple times.

router.post('/:id/calculate', requireAdmin, async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period)          return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'settled')
      return res.status(400).json({ error: 'This period is already settled. It cannot be recalculated.' });

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, null, null, period._id.toString());
    const txs      = generateSettlementTransactions(balances);

    // Compute total expense for the period
    const meals = await Meal.find({ settlementPeriodId: period._id }).lean();
    const totalExpense = Math.round(meals.reduce((s, m) => s + m.totalAmount, 0) * 100) / 100;

    // Transition to 'pending' — preserve prior paid status if re-calculating
    const existingPaidTxIds = new Set(
      (period.transactions || [])
        .filter(t => t.status === 'paid')
        .map(t => `${t.fromUserId}-${t.toUserId}`) // rough identity key
    );

    period.status                    = 'pending';
    period.settlementCalculatedAt    = new Date();
    period.totalExpense              = totalExpense;
    period.transactions              = txs.map(tx => ({
      fromUserId:   tx.fromUserId,
      fromUserName: tx.fromUserName,
      toUserId:     tx.toUserId,
      toUserName:   tx.toUserName,
      amount:       tx.amount,
      // Preserve 'paid' if same from→to existed in previous calculation
      status: existingPaidTxIds.has(`${tx.fromUserId}-${tx.toUserId}`) ? 'paid' : 'pending'
    }));

    await period.save();

    const liveBalances = await getBalances(users, null, null, period._id.toString());
    res.json(serializePeriod(period, liveBalances));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── POST /api/periods/:id/confirm ────────────────────────────────────────────
// Confirm that all settlement payments have been made.
// Freezes the period as 'settled' and stores a permanent balance snapshot.

router.post('/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'settled')
      return res.status(400).json({ error: 'Period is already settled.' });
    if (period.status === 'active')
      return res.status(400).json({ error: 'Calculate the settlement first before confirming.' });

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, null, null, period._id.toString());

    // Freeze a permanent snapshot
    period.balanceSnapshot = balances.map(b => ({
      userId:     b.user._id,
      userName:   b.user.name,
      totalShare: b.total_share,
      totalPaid:  b.total_paid,
      balance:    b.balance
    }));
    period.status    = 'settled';
    period.settledAt = new Date();

    // Mark all transactions as paid
    period.transactions.forEach(t => { t.status = 'paid'; });

    await period.save();

    res.json(serializePeriod(period, null));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/periods/:id/transactions/:txId ──────────────────────────────────
// Toggle a single transaction between pending and paid.

router.put('/:id/transactions/:txId', requireAdmin, async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'settled')
      return res.status(400).json({ error: 'Cannot modify a settled period.' });

    const tx = period.transactions.id(req.params.txId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.status = req.body.status === 'paid' ? 'paid' : 'pending';
    await period.save();

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, null, null, period._id.toString());
    res.json(serializePeriod(period, balances));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/periods/:id ──────────────────────────────────────────────────
// Allowed when the period is not settled.
// If meals are attached, allows unassigning them with unassign_meals=true so no meals are lost.

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'settled')
      return res.status(400).json({ error: 'Cannot delete a settled period directly. Please reopen it first if you need to adjust or reset it.' });

    const mealCount = await Meal.countDocuments({ settlementPeriodId: period._id });
    const shouldUnassign = req.query.unassign_meals === 'true' || req.body?.unassign_meals === true;

    if (mealCount > 0 && !shouldUnassign) {
      return res.status(400).json({
        error: `Cannot delete — ${mealCount} meal(s) are attached to this period.`,
        hasMeals: true,
        mealCount
      });
    }

    if (mealCount > 0 && shouldUnassign) {
      await Meal.updateMany({ settlementPeriodId: period._id }, { $set: { settlementPeriodId: null } });
      console.log(`ℹ️ Unassigned ${mealCount} meal(s) from deleted period ${period.label}`);
    }

    await period.deleteOne();
    res.json({ success: true, id: req.params.id, unassignedMeals: mealCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/periods/:id/reopen ─────────────────────────────────────────────
// Reverse a settled (or pending) period back to 'active'.
// Clears frozen snapshot + transactions so meals can be edited and settlement recalculated.
// All meals remain attached — nothing is deleted!
// If an empty active period exists, passing { force: true } automatically cleans it up.

router.post('/:id/reopen', requireAdmin, async (req, res) => {
  try {
    const period = await SettlementPeriod.findById(req.params.id);
    if (!period) return res.status(404).json({ error: 'Period not found' });

    if (period.status !== 'settled' && period.status !== 'pending') {
      return res.status(400).json({
        error: `Period is already '${period.status}'. Only settled or pending periods can be reset to active.`
      });
    }

    // Check for another active or pending period
    const conflict = await SettlementPeriod.findOne({
      _id:    { $ne: period._id },
      status: { $in: ['active', 'pending'] }
    });

    if (conflict) {
      const conflictMeals = await Meal.countDocuments({ settlementPeriodId: conflict._id });
      const force = req.body?.force === true || req.query.force === 'true';

      if (force) {
        if (conflictMeals > 0) {
          return res.status(409).json({
            error: `Cannot reopen: The current ${conflict.status} period (${conflict.label || conflict.startDate}) already has ${conflictMeals} meal(s) recorded. Please settle or review those meals first.`,
            conflictPeriodId: conflict._id,
            conflictMealCount: conflictMeals
          });
        }
        // Conflict active/pending period is empty — remove it so this period can be safely reopened
        await conflict.deleteOne();
        console.log(`🗑️ Removed empty active period ${conflict.label} to allow reopening ${period.label}`);
      } else {
        return res.status(409).json({
          error: `There is already an ${conflict.status} period (${conflict.label || conflict.startDate + ' → ' + conflict.endDate}).`,
          conflictPeriodId: conflict._id,
          conflictMealCount: conflictMeals,
          canAutoRemoveConflict: conflictMeals === 0
        });
      }
    }

    // Reset to active, wipe snapshot & transactions
    period.status                 = 'active';
    period.settledAt              = null;
    period.settlementCalculatedAt = null;
    period.totalExpense           = null;
    period.balanceSnapshot        = [];
    period.transactions           = [];

    await period.save();

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, null, null, period._id.toString());

    console.log(`🔄 Period reopened to active: ${period.label}`);
    res.json(serializePeriod(period, balances));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;

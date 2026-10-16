require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const cookieParser     = require('cookie-parser');
const connectDB        = require('./config/db');
const User             = require('./models/User');
const PriceSetting     = require('./models/PriceSetting');
const Meal             = require('./models/Meal');
const SettlementPeriod = require('./models/SettlementPeriod');
const Settlement       = require('./models/Settlement');
const Admin            = require('./models/Admin');
const { buildPeriodLabel } = require('./helpers/calculations');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow request origin (localhost or deployed frontend)
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));        // Admin authentication
app.use('/api/users',       require('./routes/users'));
app.use('/api/settings',    require('./routes/settings'));
app.use('/api/meals',       require('./routes/meals'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/daily',       require('./routes/daily'));
app.use('/api/calendar',    require('./routes/calendar'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/settlements', require('./routes/settlements')); // legacy endpoint kept
app.use('/api/periods',     require('./routes/periods'));     // new lifecycle endpoint

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Seed Initial Data ────────────────────────────────────────────────────────
async function seedData() {
  try {
    // Seed initial admin user if not present
    await Admin.seedInitialAdmin();

    // Seed users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany([
        { name: 'Gaurav'  },
        { name: 'Nikhil'  },
        { name: 'Devansh' }
      ]);
      console.log('✅ Seeded users: Gaurav, Nikhil, Devansh');
    }

    // Seed default prices
    const priceCount = await PriceSetting.countDocuments();
    if (priceCount === 0) {
      await PriceSetting.insertMany([
        { mealType: 'breakfast', price: 50, effectiveFrom: '2024-01-01' },
        { mealType: 'dinner',    price: 70, effectiveFrom: '2024-01-01' }
      ]);
      console.log('✅ Seeded prices: breakfast=₹50, dinner=₹70');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

// ─── Migration: legacy Settlement → SettlementPeriod ─────────────────────────
async function migrateSettlements() {
  try {
    const legacySettlements = await Settlement.find().sort({ startDate: 1 }).lean();
    if (legacySettlements.length === 0) return;

    for (const ls of legacySettlements) {
      // Check if a SettlementPeriod already exists for this date range
      const exists = await SettlementPeriod.findOne({
        startDate: ls.startDate,
        endDate:   ls.endDate
      });
      if (exists) continue;

      // Determine status: if all transactions paid → settled, else pending
      const allPaid = ls.transactions.length > 0 && ls.transactions.every(t => t.status === 'paid');
      const periodStatus = allPaid ? 'settled' : (ls.status === 'settled' ? 'settled' : 'pending');

      const label = buildPeriodLabel(ls.startDate, ls.endDate);
      const period = await SettlementPeriod.create({
        startDate:    ls.startDate,
        endDate:      ls.endDate,
        status:       periodStatus,
        label:        label,
        settledAt:    periodStatus === 'settled' ? ls.updatedAt : null,
        settlementCalculatedAt: ls.createdAt,
        transactions: ls.transactions.map(t => ({
          fromUserId:   t.fromUserId,
          fromUserName: t.fromUserName,
          toUserId:     t.toUserId,
          toUserName:   t.toUserName,
          amount:       t.amount,
          status:       t.status || 'paid'
        }))
      });

      // Assign meals in this date range to the migrated period
      const result = await Meal.updateMany(
        { settlementPeriodId: null, date: { $gte: ls.startDate, $lte: ls.endDate } },
        { $set: { settlementPeriodId: period._id } }
      );

      // If settled, take balance snapshot now
      if (periodStatus === 'settled') {
        const User = require('./models/User');
        const { getBalances } = require('./helpers/calculations');
        const users    = await User.find().sort({ createdAt: 1 }).lean();
        const balances = await getBalances(users, null, null, period._id.toString());

        const meals = await Meal.find({ settlementPeriodId: period._id }).lean();
        const totalExpense = Math.round(meals.reduce((s, m) => s + m.totalAmount, 0) * 100) / 100;

        period.balanceSnapshot = balances.map(b => ({
          userId:     b.user._id,
          userName:   b.user.name,
          totalShare: b.total_share,
          totalPaid:  b.total_paid,
          balance:    b.balance
        }));
        period.totalExpense = totalExpense;
        await period.save();
      }

      console.log(`📦 Migrated legacy settlement ${ls.startDate} → ${ls.endDate} as ${periodStatus} (${result.modifiedCount} meals tagged)`);
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// ─── Migration: assign orphan meals to active period ─────────────────────────
async function assignOrphanMeals() {
  try {
    const orphans = await Meal.countDocuments({ settlementPeriodId: null });
    if (orphans === 0) return;

    // Try to match each orphan meal to an existing period by date
    const periods = await SettlementPeriod.find().sort({ startDate: 1 }).lean();
    if (periods.length === 0) {
      console.log(`⚠️  ${orphans} orphan meal(s) found but no periods exist yet. Create a period to claim them.`);
      return;
    }

    let totalAssigned = 0;
    for (const p of periods) {
      const result = await Meal.updateMany(
        { settlementPeriodId: null, date: { $gte: p.startDate, $lte: p.endDate } },
        { $set: { settlementPeriodId: p._id } }
      );
      totalAssigned += result.modifiedCount;
    }

    const remaining = await Meal.countDocuments({ settlementPeriodId: null });
    if (totalAssigned > 0) console.log(`✅ Assigned ${totalAssigned} orphan meal(s) to existing periods`);
    if (remaining    > 0) console.log(`⚠️  ${remaining} meal(s) still unassigned — their dates don't fall in any period`);
  } catch (err) {
    console.error('Orphan meal assignment error:', err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
connectDB().then(async () => {
  await seedData();
  await migrateSettlements();  // convert old Settlement docs → SettlementPeriod docs
  await assignOrphanMeals();   // link any leftover meals to their periods

  app.listen(PORT, () => {
    console.log(`\n🍽️  Food Expense Tracker — MERN Backend`);
    console.log(`📡  API running at: http://localhost:${PORT}/api\n`);
  });
});

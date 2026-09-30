require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');
const User         = require('./models/User');
const PriceSetting = require('./models/PriceSetting');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:4173',  // Vite preview
  ],
  credentials: true
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/users',       require('./routes/users'));
app.use('/api/settings',    require('./routes/settings'));
app.use('/api/meals',       require('./routes/meals'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/daily',       require('./routes/daily'));
app.use('/api/calendar',    require('./routes/calendar'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/settlements', require('./routes/settlements'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Seed Initial Data ────────────────────────────────────────────────────────
async function seedData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany([
        { name: 'Gaurav'  },
        { name: 'Nikhil'  },
        { name: 'Devansh' }
      ]);
      console.log('✅ Seeded users: Gaurav, Nikhil, Devansh');
    }

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

// ─── Start ────────────────────────────────────────────────────────────────────
connectDB().then(async () => {
  await seedData();
  app.listen(PORT, () => {
    console.log(`\n🍽️  Food Expense Tracker — MERN Backend`);
    console.log(`📡  API running at: http://localhost:${PORT}/api\n`);
  });
});

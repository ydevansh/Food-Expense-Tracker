const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Database Setup ────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'food_tracker.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema Initialization ─────────────────────────────────────────────────────
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_settings (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_type      TEXT NOT NULL,
      price          REAL NOT NULL,
      effective_from TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      date             TEXT NOT NULL,
      meal_type        TEXT NOT NULL,
      price_per_plate  REAL NOT NULL,
      number_of_plates INTEGER NOT NULL,
      total_amount     REAL NOT NULL,
      notes            TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_participants (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id      INTEGER NOT NULL,
      user_id      INTEGER NOT NULL,
      share_amount REAL NOT NULL,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meal_payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      amount_paid REAL NOT NULL,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_periods (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlement_transactions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_period_id INTEGER NOT NULL,
      from_user_id         INTEGER NOT NULL,
      to_user_id           INTEGER NOT NULL,
      amount               REAL NOT NULL,
      status               TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (settlement_period_id) REFERENCES settlement_periods(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id)   REFERENCES users(id)
    );
  `);

  // Seed users
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const ins = db.prepare('INSERT INTO users (name) VALUES (?)');
    ins.run('Gaurav');
    ins.run('Nikhil');
    ins.run('Devansh');
    console.log('Users seeded: Gaurav, Nikhil, Devansh');
  }

  // Seed default prices
  const priceCount = db.prepare('SELECT COUNT(*) as c FROM price_settings').get();
  if (priceCount.c === 0) {
    const ins = db.prepare('INSERT INTO price_settings (meal_type, price, effective_from) VALUES (?, ?, ?)');
    ins.run('breakfast', 50, '2024-01-01');
    ins.run('dinner',    70, '2024-01-01');
    console.log('Default prices seeded: breakfast=50, dinner=70');
  }
}

initDB();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calculateShares(totalAmount, userIds) {
  const n = userIds.length;
  if (n === 0) return {};
  const totalCents = Math.round(totalAmount * 100);
  const baseCents  = Math.floor(totalCents / n);
  const extraCents = totalCents - baseCents * n;
  const shares = {};
  userIds.forEach((uid, i) => {
    shares[uid] = (baseCents + (i < extraCents ? 1 : 0)) / 100;
  });
  return shares;
}

function getPriceForDate(mealType, date) {
  const row = db.prepare(
    'SELECT price FROM price_settings WHERE meal_type = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1'
  ).get(mealType, date);
  return row ? row.price : (mealType === 'breakfast' ? 50 : 70);
}

function getMealWithDetails(mealId) {
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(mealId);
  if (!meal) return null;
  const participants = db.prepare(
    'SELECT mp.*, u.name AS user_name FROM meal_participants mp JOIN users u ON u.id = mp.user_id WHERE mp.meal_id = ? ORDER BY u.id'
  ).all(mealId);
  const payments = db.prepare(
    'SELECT mp.*, u.name AS user_name FROM meal_payments mp JOIN users u ON u.id = mp.user_id WHERE mp.meal_id = ? ORDER BY u.id'
  ).all(mealId);
  return { ...meal, participants, payments };
}

function getBalances(startDate, endDate) {
  const users = db.prepare('SELECT * FROM users ORDER BY id').all();
  return users.map(user => {
    const params = [user.id];
    let df = '';
    if (startDate) { df += ' AND m.date >= ?'; params.push(startDate); }
    if (endDate)   { df += ' AND m.date <= ?'; params.push(endDate);   }

    const totalShare = db.prepare(
      'SELECT COALESCE(SUM(mp.share_amount), 0) AS total FROM meal_participants mp JOIN meals m ON m.id = mp.meal_id WHERE mp.user_id = ?' + df
    ).get(...params);

    const totalPaid = db.prepare(
      'SELECT COALESCE(SUM(mp.amount_paid), 0) AS total FROM meal_payments mp JOIN meals m ON m.id = mp.meal_id WHERE mp.user_id = ?' + df
    ).get(...params);

    return {
      user,
      total_share: Math.round(totalShare.total * 100) / 100,
      total_paid:  Math.round(totalPaid.total  * 100) / 100,
      balance:     Math.round((totalPaid.total - totalShare.total) * 100) / 100
    };
  });
}

function generateSettlementTransactions(balances) {
  const transactions = [];
  const debtors   = balances.filter(b => b.balance < -0.01).map(b => ({ userId: b.user.id, name: b.user.name, amount: -b.balance }));
  const creditors = balances.filter(b => b.balance >  0.01).map(b => ({ userId: b.user.id, name: b.user.name, amount:  b.balance }));
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di], c = creditors[ci];
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0.005) {
      transactions.push({ fromUserId: d.userId, fromName: d.name, toUserId: c.userId, toName: c.name, amount: Math.round(amount * 100) / 100 });
    }
    d.amount -= amount; c.amount -= amount;
    if (d.amount < 0.005) di++;
    if (c.amount < 0.005) ci++;
  }
  return transactions;
}

function getSettlementWithDetails(settlementId) {
  const s = db.prepare('SELECT * FROM settlement_periods WHERE id = ?').get(settlementId);
  if (!s) return null;
  const transactions = db.prepare(
    'SELECT st.*, fu.name AS from_user_name, tu.name AS to_user_name FROM settlement_transactions st JOIN users fu ON fu.id = st.from_user_id JOIN users tu ON tu.id = st.to_user_id WHERE st.settlement_period_id = ? ORDER BY st.id'
  ).all(settlementId);
  const balances = getBalances(s.start_date, s.end_date);
  return { ...s, transactions, balances };
}

// ═══ ROUTES ═══════════════════════════════════════════════════════════════════

app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id').all());
});

app.get('/api/settings', (req, res) => {
  res.json(db.prepare('SELECT * FROM price_settings ORDER BY effective_from DESC, id DESC').all());
});

app.get('/api/settings/current', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  res.json({ breakfast: getPriceForDate('breakfast', date), dinner: getPriceForDate('dinner', date) });
});

app.post('/api/settings', (req, res) => {
  try {
    const { meal_type, price, effective_from } = req.body;
    const result = db.prepare('INSERT INTO price_settings (meal_type, price, effective_from) VALUES (?, ?, ?)').run(meal_type, Number(price), effective_from);
    res.status(201).json({ id: result.lastInsertRowid, meal_type, price: Number(price), effective_from });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/meals', (req, res) => {
  try {
    const { date, meal_type, number_of_plates, participant_ids, payments, notes } = req.body;
    if (!date || !meal_type || !number_of_plates || !participant_ids?.length)
      return res.status(400).json({ error: 'date, meal_type, number_of_plates, participant_ids required' });

    const price_per_plate = getPriceForDate(meal_type, date);
    const total_amount    = Math.round(price_per_plate * number_of_plates * 100) / 100;
    const now             = new Date().toISOString();
    const shares          = calculateShares(total_amount, participant_ids);

    const mealId = db.transaction(() => {
      const r = db.prepare(
        'INSERT INTO meals (date, meal_type, price_per_plate, number_of_plates, total_amount, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(date, meal_type, price_per_plate, number_of_plates, total_amount, notes || null, now, now);
      const id = r.lastInsertRowid;
      const insP = db.prepare('INSERT INTO meal_participants (meal_id, user_id, share_amount) VALUES (?, ?, ?)');
      participant_ids.forEach(uid => insP.run(id, uid, shares[uid]));
      const insPay = db.prepare('INSERT INTO meal_payments (meal_id, user_id, amount_paid) VALUES (?, ?, ?)');
      (payments || []).forEach(({ user_id, amount_paid }) => {
        if (Number(amount_paid) > 0) insPay.run(id, user_id, Number(amount_paid));
      });
      return id;
    })();

    res.status(201).json(getMealWithDetails(mealId));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/meals', (req, res) => {
  try {
    const { start_date, end_date, meal_type, user_id, paid_by } = req.query;
    let query = 'SELECT DISTINCT m.* FROM meals m';
    const joins = [], conditions = [], params = [];
    if (user_id) { joins.push('JOIN meal_participants mpf ON mpf.meal_id = m.id'); conditions.push('mpf.user_id = ?'); params.push(user_id); }
    if (paid_by) { joins.push('JOIN meal_payments mpp ON mpp.meal_id = m.id'); conditions.push('mpp.user_id = ?'); params.push(paid_by); }
    if (joins.length) query += ' ' + joins.join(' ');
    if (start_date) { conditions.push('m.date >= ?'); params.push(start_date); }
    if (end_date)   { conditions.push('m.date <= ?'); params.push(end_date);   }
    if (meal_type)  { conditions.push('m.meal_type = ?'); params.push(meal_type); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY m.date DESC, CASE m.meal_type WHEN "dinner" THEN 1 ELSE 0 END DESC';
    const meals = db.prepare(query).all(...params);
    res.json(meals.map(m => getMealWithDetails(m.id)));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/meals/:id', (req, res) => {
  const meal = getMealWithDetails(parseInt(req.params.id));
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  res.json(meal);
});

app.put('/api/meals/:id', (req, res) => {
  try {
    const mealId = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM meals WHERE id = ?').get(mealId))
      return res.status(404).json({ error: 'Meal not found' });

    const { date, meal_type, number_of_plates, participant_ids, payments, notes, price_per_plate: customPrice } = req.body;
    const price_per_plate = customPrice != null ? Number(customPrice) : getPriceForDate(meal_type, date);
    const total_amount    = Math.round(price_per_plate * number_of_plates * 100) / 100;
    const now             = new Date().toISOString();
    const shares          = calculateShares(total_amount, participant_ids);

    db.transaction(() => {
      db.prepare('UPDATE meals SET date=?, meal_type=?, price_per_plate=?, number_of_plates=?, total_amount=?, notes=?, updated_at=? WHERE id=?')
        .run(date, meal_type, price_per_plate, number_of_plates, total_amount, notes || null, now, mealId);
      db.prepare('DELETE FROM meal_participants WHERE meal_id = ?').run(mealId);
      const insP = db.prepare('INSERT INTO meal_participants (meal_id, user_id, share_amount) VALUES (?, ?, ?)');
      participant_ids.forEach(uid => insP.run(mealId, uid, shares[uid]));
      db.prepare('DELETE FROM meal_payments WHERE meal_id = ?').run(mealId);
      const insPay = db.prepare('INSERT INTO meal_payments (meal_id, user_id, amount_paid) VALUES (?, ?, ?)');
      (payments || []).forEach(({ user_id, amount_paid }) => {
        if (Number(amount_paid) > 0) insPay.run(mealId, user_id, Number(amount_paid));
      });
    })();

    res.json(getMealWithDetails(mealId));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/meals/:id', (req, res) => {
  const mealId = parseInt(req.params.id);
  if (!db.prepare('SELECT id FROM meals WHERE id = ?').get(mealId))
    return res.status(404).json({ error: 'Meal not found' });
  db.prepare('DELETE FROM meals WHERE id = ?').run(mealId);
  res.json({ success: true, id: mealId });
});

app.get('/api/dashboard', (req, res) => {
  try {
    const today      = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';
    const todayMeals = db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY meal_type').all(today).map(m => getMealWithDetails(m.id));
    const monthStats = db.prepare(
      'SELECT COUNT(*) AS meal_count, COALESCE(SUM(total_amount),0) AS total_expense, COALESCE(SUM(CASE WHEN meal_type=\'breakfast\' THEN total_amount ELSE 0 END),0) AS breakfast_expense, COALESCE(SUM(CASE WHEN meal_type=\'dinner\' THEN total_amount ELSE 0 END),0) AS dinner_expense, COALESCE(SUM(number_of_plates),0) AS total_plates, COUNT(DISTINCT date) AS days_with_meals FROM meals WHERE date >= ?'
    ).get(monthStart);
    res.json({ today_date: today, today: todayMeals, month_stats: monthStats, user_balances: getBalances(monthStart, null) });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/daily/:date', (req, res) => {
  try {
    const { date } = req.params;
    const users    = db.prepare('SELECT * FROM users ORDER BY id').all();
    const meals    = db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY meal_type').all(date).map(m => getMealWithDetails(m.id));
    let dayTotal = 0;
    const userShares = {}, userPayments = {};
    users.forEach(u => { userShares[u.id] = 0; userPayments[u.id] = 0; });
    meals.forEach(meal => {
      dayTotal += meal.total_amount;
      meal.participants.forEach(p => { userShares[p.user_id]   += p.share_amount; });
      meal.payments.forEach(p    => { userPayments[p.user_id] += p.amount_paid;  });
    });
    const user_summary = users.map(u => ({
      user: u,
      total_share: Math.round(userShares[u.id]   * 100) / 100,
      total_paid:  Math.round(userPayments[u.id] * 100) / 100
    }));
    res.json({ date, meals, day_total: Math.round(dayTotal * 100) / 100, user_summary });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/calendar/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const monthStr = year + '-' + month.padStart(2, '0');
    const meals    = db.prepare('SELECT date, meal_type, total_amount FROM meals WHERE date LIKE ?').all(monthStr + '%');
    const dateMap  = {};
    meals.forEach(({ date, meal_type, total_amount }) => {
      if (!dateMap[date]) dateMap[date] = { breakfast: false, dinner: false, day_total: 0 };
      dateMap[date][meal_type] = true;
      dateMap[date].day_total += total_amount;
    });
    Object.values(dateMap).forEach(d => { d.day_total = Math.round(d.day_total * 100) / 100; });
    res.json(dateMap);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/balances', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    res.json(getBalances(start_date || null, end_date || null));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let df = '', params = [];
    if (start_date) { df += ' AND date >= ?'; params.push(start_date); }
    if (end_date)   { df += ' AND date <= ?'; params.push(end_date);   }
    const stats = db.prepare(
      'SELECT COUNT(*) AS meal_count, COALESCE(SUM(total_amount),0) AS total_expense, COALESCE(SUM(CASE WHEN meal_type=\'breakfast\' THEN total_amount ELSE 0 END),0) AS breakfast_expense, COALESCE(SUM(CASE WHEN meal_type=\'dinner\' THEN total_amount ELSE 0 END),0) AS dinner_expense, COALESCE(SUM(number_of_plates),0) AS total_plates, COUNT(DISTINCT date) AS days_with_meals FROM meals WHERE 1=1' + df
    ).get(...params);
    res.json({ stats, user_stats: getBalances(start_date || null, end_date || null) });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/settlements', (req, res) => {
  res.json(db.prepare('SELECT * FROM settlement_periods ORDER BY created_at DESC').all().map(s => getSettlementWithDetails(s.id)));
});

app.get('/api/settlements/:id', (req, res) => {
  const s = getSettlementWithDetails(parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Settlement not found' });
  res.json(s);
});

app.post('/api/settlements', (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });
    const now = new Date().toISOString();
    const balances = getBalances(start_date, end_date);
    const txs      = generateSettlementTransactions(balances);
    const settlementId = db.transaction(() => {
      const r = db.prepare('INSERT INTO settlement_periods (start_date, end_date, status, created_at) VALUES (?, ?, ?, ?)').run(start_date, end_date, 'pending', now);
      const id = r.lastInsertRowid;
      const insTx = db.prepare('INSERT INTO settlement_transactions (settlement_period_id, from_user_id, to_user_id, amount, status) VALUES (?, ?, ?, ?, \'pending\')');
      txs.forEach(tx => insTx.run(id, tx.fromUserId, tx.toUserId, tx.amount));
      return id;
    })();
    res.status(201).json(getSettlementWithDetails(settlementId));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.put('/api/settlements/:id/transactions/:txId', (req, res) => {
  try {
    const { id, txId } = req.params;
    const { status }   = req.body;
    db.prepare('UPDATE settlement_transactions SET status=? WHERE id=? AND settlement_period_id=?').run(status, txId, id);
    const allTx   = db.prepare('SELECT status FROM settlement_transactions WHERE settlement_period_id=?').all(id);
    const allPaid = allTx.every(t => t.status === 'paid');
    const anyPaid = allTx.some(t  => t.status === 'paid');
    db.prepare('UPDATE settlement_periods SET status=? WHERE id=?').run(allPaid ? 'settled' : anyPaid ? 'partial' : 'pending', id);
    res.json(getSettlementWithDetails(parseInt(id)));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/settlements/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.prepare('SELECT id FROM settlement_periods WHERE id=?').get(id))
    return res.status(404).json({ error: 'Settlement not found' });
  db.prepare('DELETE FROM settlement_periods WHERE id=?').run(id);
  res.json({ success: true, id });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log('\nFood Expense Tracker');
  console.log('API:      http://localhost:' + PORT + '/api');
  console.log('Frontend: http://localhost:' + PORT + '\n');
});

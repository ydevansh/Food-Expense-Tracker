const express    = require('express');
const router     = express.Router();
const Settlement = require('../models/Settlement');
const User       = require('../models/User');
const { getBalances, generateSettlementTransactions } = require('../helpers/calculations');

function serializeSettlement(s, balances) {
  const obj = s.toObject ? s.toObject() : s;
  return {
    ...obj,
    id:         obj._id,
    start_date: obj.startDate,
    end_date:   obj.endDate,
    transactions: (obj.transactions || []).map(t => ({
      ...t,
      id:             t._id,
      from_user_id:   t.fromUserId,
      from_user_name: t.fromUserName,
      to_user_id:     t.toUserId,
      to_user_name:   t.toUserName
    })),
    balances: balances || []
  };
}

// GET /api/settlements
router.get('/', async (req, res) => {
  try {
    const [settlements, users] = await Promise.all([
      Settlement.find().sort({ createdAt: -1 }),
      User.find().sort({ createdAt: 1 }).lean()
    ]);

    const result = await Promise.all(settlements.map(async s => {
      const balances = await getBalances(users, s.startDate, s.endDate);
      return serializeSettlement(s, balances);
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settlements/:id
router.get('/:id', async (req, res) => {
  try {
    const [s, users] = await Promise.all([
      Settlement.findById(req.params.id),
      User.find().sort({ createdAt: 1 }).lean()
    ]);
    if (!s) return res.status(404).json({ error: 'Settlement not found' });

    const balances = await getBalances(users, s.startDate, s.endDate);
    res.json(serializeSettlement(s, balances));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settlements — create new settlement
router.post('/', async (req, res) => {
  try {
    const { start_date, startDate, end_date, endDate } = req.body;
    const sDate = startDate || start_date;
    const eDate = endDate   || end_date;
    if (!sDate || !eDate)
      return res.status(400).json({ error: 'start_date and end_date are required' });

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, sDate, eDate);
    const txs      = generateSettlementTransactions(balances);

    const s = await Settlement.create({
      startDate: sDate,
      endDate:   eDate,
      status:    'pending',
      transactions: txs.map(tx => ({
        fromUserId: tx.fromUserId, fromUserName: tx.fromName,
        toUserId:   tx.toUserId,   toUserName:   tx.toName,
        amount:     tx.amount,     status:       'pending'
      }))
    });

    res.status(201).json(serializeSettlement(s, balances));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PUT /api/settlements/:id/transactions/:txId — mark paid/unpaid
router.put('/:id/transactions/:txId', async (req, res) => {
  try {
    const { id, txId } = req.params;
    const { status }   = req.body;

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Settlement not found' });

    const tx = s.transactions.id(txId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.status = status;
    const allPaid = s.transactions.every(t => t.status === 'paid');
    const anyPaid = s.transactions.some(t  => t.status === 'paid');
    s.status = allPaid ? 'settled' : anyPaid ? 'partial' : 'pending';

    await s.save();

    const users    = await User.find().sort({ createdAt: 1 }).lean();
    const balances = await getBalances(users, s.startDate, s.endDate);
    res.json(serializeSettlement(s, balances));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settlements/:id
router.delete('/:id', async (req, res) => {
  try {
    const s = await Settlement.findByIdAndDelete(req.params.id);
    if (!s) return res.status(404).json({ error: 'Settlement not found' });
    res.json({ success: true, id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

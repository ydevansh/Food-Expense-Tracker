const mongoose = require('mongoose');

// Snapshot of one user's balance at the moment of settlement
const BalanceSnapshotSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  totalShare:  { type: Number, required: true },
  totalPaid:   { type: Number, required: true },
  balance:     { type: Number, required: true }          // paid − share  (+ = receive, − = owe)
}, { _id: false });

// Settlement transaction within a period
const PeriodTransactionSchema = new mongoose.Schema({
  fromUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserName: { type: String, required: true },
  toUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserName:   { type: String, required: true },
  amount:       { type: Number, required: true, min: 0 },
  status:       { type: String, enum: ['pending', 'paid'], default: 'pending' }
});

const SettlementPeriodSchema = new mongoose.Schema({
  // Date range this period covers
  startDate:       { type: String, required: true },   // YYYY-MM-DD
  endDate:         { type: String, required: true },   // YYYY-MM-DD

  // Lifecycle:
  //   'active'   — currently recording expenses
  //   'pending'  — settlement calculated, awaiting payment confirmation
  //   'settled'  — all payments confirmed, period closed
  status:          { type: String, enum: ['active', 'pending', 'settled'], default: 'active' },

  // Set when the period transitions to 'pending' (user clicks Calculate)
  settlementCalculatedAt: { type: Date, default: null },

  // Set when user confirms all payments and period is marked settled
  settledAt:       { type: Date, default: null },

  // Snapshot totals captured at settlement time (null while still active)
  totalExpense:    { type: Number, default: null },
  balanceSnapshot: { type: [BalanceSnapshotSchema], default: [] },
  transactions:    { type: [PeriodTransactionSchema], default: [] },

  // Human-readable label, e.g. "October 1–15"
  label:           { type: String, default: '' }
}, { timestamps: true });

// Only one active period at a time — enforced at the application layer
SettlementPeriodSchema.index({ status: 1 });
SettlementPeriodSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('SettlementPeriod', SettlementPeriodSchema);

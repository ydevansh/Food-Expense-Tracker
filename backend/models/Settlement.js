const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  fromUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserName: { type: String, required: true },
  toUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserName:   { type: String, required: true },
  amount:       { type: Number, required: true, min: 0 },
  status:       { type: String, enum: ['pending', 'paid'], default: 'pending' }
});

const SettlementSchema = new mongoose.Schema({
  startDate:    { type: String, required: true },  // YYYY-MM-DD
  endDate:      { type: String, required: true },
  status:       { type: String, enum: ['pending', 'partial', 'settled'], default: 'pending' },
  transactions: { type: [TransactionSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Settlement', SettlementSchema);

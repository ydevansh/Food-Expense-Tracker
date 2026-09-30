const mongoose = require('mongoose');

// Embedded: who ate this meal and their calculated share
const ParticipantSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  shareAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

// Embedded: who paid how much for this meal
const PaymentSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:   { type: String, required: true },
  amountPaid: { type: Number, required: true, min: 0 }
}, { _id: false });

const MealSchema = new mongoose.Schema({
  date:            { type: String, required: true },  // YYYY-MM-DD
  mealType:        { type: String, enum: ['breakfast', 'dinner'], required: true },
  pricePerPlate:   { type: Number, required: true },  // snapshot at time of entry
  numberOfPlates:  { type: Number, required: true, min: 1 },
  totalAmount:     { type: Number, required: true },
  notes:           { type: String, default: null },
  participants:    { type: [ParticipantSchema], default: [] },
  payments:        { type: [PaymentSchema],     default: [] }
}, { timestamps: true });

// Indexes for common queries
MealSchema.index({ date: 1 });
MealSchema.index({ date: 1, mealType: 1 });
MealSchema.index({ 'participants.userId': 1 });
MealSchema.index({ 'payments.userId': 1 });

module.exports = mongoose.model('Meal', MealSchema);

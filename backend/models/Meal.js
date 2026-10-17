const mongoose = require('mongoose');

// Embedded: who ate this meal and their calculated share
const ParticipantSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  shareAmount: { type: Number, required: true, min: 0 },
  // For quantity-based split: how many units this person consumed
  quantity:    { type: Number, default: 0 }
}, { _id: false });

// Embedded: who paid how much for this meal
const PaymentSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:   { type: String, required: true },
  amountPaid: { type: Number, required: true, min: 0 }
}, { _id: false });

// Embedded: individual food item within a custom meal (supports multi-item meals)
const FoodItemSchema = new mongoose.Schema({
  description:  { type: String, default: '' },     // "Roti and sabzi"
  quantity:     { type: Number, default: 1 },       // total units (plates/rotis/items)
  unitPrice:    { type: Number, required: true },   // price per unit
  totalAmount:  { type: Number, required: true },   // quantity × unitPrice snapshot
  unit:         { type: String, default: 'plate' }  // "plate" | "roti" | "item"
}, { _id: true });

// Per-participant per-item quantity (for quantity-based split across items)
const ParticipantItemQtySchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  itemId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, default: 0 }
}, { _id: false });

const MealSchema = new mongoose.Schema({
  date:     { type: String, required: true },  // YYYY-MM-DD
  mealType: { type: String, enum: ['breakfast', 'dinner'], required: true },

  // ── Food type ──────────────────────────────────────────────────────────────
  foodType: {
    type:    String,
    enum:    ['regular', 'custom'],
    default: 'regular'
  },

  // ── Regular meal fields (single-price snapshot) ────────────────────────────
  pricePerPlate:  { type: Number, default: null },  // snapshot at time of entry (regular)
  numberOfPlates: { type: Number, default: null },
  customPrice:    { type: Boolean, default: false }, // true when price was manually overridden

  // ── Custom meal fields ─────────────────────────────────────────────────────
  // pricingMethod: how the custom meal is priced
  //   'per_plate'  – N plates × unit price
  //   'per_item'   – N items × unit price (roti, etc.)
  //   'manual'     – user entered a fixed total
  pricingMethod: {
    type:    String,
    enum:    ['per_plate', 'per_item', 'manual', null],
    default: null
  },

  // Split method:
  //   'equal'    – total divided equally among participants
  //   'quantity' – each person's share based on their individual quantity
  splitMethod: {
    type:    String,
    enum:    ['equal', 'quantity'],
    default: 'equal'
  },

  // Food description (for custom meals)
  description: { type: String, default: null },

  // Line items (for multi-item custom meals)
  items: { type: [FoodItemSchema], default: [] },

  // Per-participant quantities per item (for quantity-based split)
  participantItemQtys: { type: [ParticipantItemQtySchema], default: [] },

  // ── Shared fields ──────────────────────────────────────────────────────────
  totalAmount:   { type: Number, required: true },
  notes:         { type: String, default: null },
  participants:  { type: [ParticipantSchema], default: [] },
  payments:      { type: [PaymentSchema],     default: [] },

  // Links this meal to its accounting period; null only for legacy data
  settlementPeriodId: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'SettlementPeriod',
    default: null
  }
}, { timestamps: true });

// Indexes for common queries
MealSchema.index({ date: 1 });
MealSchema.index({ date: 1, mealType: 1 });
MealSchema.index({ 'participants.userId': 1 });
MealSchema.index({ 'payments.userId': 1 });
MealSchema.index({ settlementPeriodId: 1 });

module.exports = mongoose.model('Meal', MealSchema);

const mongoose = require('mongoose');

const PriceSettingSchema = new mongoose.Schema({
  mealType:      { type: String, enum: ['breakfast', 'dinner'], required: true },
  price:         { type: Number, required: true, min: 0 },
  effectiveFrom: { type: String, required: true } // YYYY-MM-DD string
}, { timestamps: true });

// Index for efficient price lookups
PriceSettingSchema.index({ mealType: 1, effectiveFrom: -1 });

module.exports = mongoose.model('PriceSetting', PriceSettingSchema);

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  username: {
    type:      String,
    required:  true,
    unique:    true,
    trim:      true,
    lowercase: true,
    index:     true
  },
  passwordHash: {
    type:     String,
    required: true
  },
  name: {
    type:    String,
    default: 'Devansh'
  },
  role: {
    type:    String,
    default: 'admin'
  },
  failedLoginAttempts: {
    type:    Number,
    default: 0
  },
  lockUntil: {
    type:    Date,
    default: null
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

/** Check if account is currently locked due to failed attempts */
AdminSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/** Compare candidate plain text password with stored hash */
AdminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/** Seed initial admin user if not present */
AdminSchema.statics.seedInitialAdmin = async function() {
  const adminCount = await this.countDocuments();
  if (adminCount === 0) {
    const username = (process.env.ADMIN_USERNAME || 'ydevansh').toLowerCase().trim();
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@Devansh2026';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    await this.create({
      username,
      passwordHash,
      name: 'Devansh',
      role: 'admin'
    });

    console.log(`🛡️ Initial administrator account initialized in database: ${username}`);
  }
};

module.exports = mongoose.model('Admin', AdminSchema);

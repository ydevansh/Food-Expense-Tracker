const express   = require('express');
const router    = express.Router();
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Admin     = require('../models/Admin');
const { requireAdmin, JWT_SECRET } = require('../middleware/auth');

// ─── Rate limiting for login attempts ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per window per IP
  message: { error: 'Too many login attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const admin = await Admin.findOne({ username: cleanUsername });

    // Always generic error if not found to prevent username enumeration
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check account-level lockout
    if (admin.isLocked()) {
      const waitMinutes = Math.ceil((admin.lockUntil - Date.now()) / (60 * 1000));
      return res.status(429).json({
        error: `Account is temporarily locked due to repeated failed attempts. Please try again in ${waitMinutes} minute(s).`
      });
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= 5) {
        admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
        console.warn(`[SECURITY] Admin account ${cleanUsername} locked for 15 minutes after 5 failed attempts.`);
      }
      await admin.save();
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Login successful — reset counters
    admin.failedLoginAttempts = 0;
    admin.lockUntil           = null;
    admin.lastLoginAt         = new Date();
    await admin.save();

    const tokenPayload = {
      id:       admin._id,
      username: admin.username,
      role:     admin.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Set secure HttpOnly cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   24 * 60 * 60 * 1000
    });

    console.log(`[AUDIT] Administrator ${admin.username} logged in at ${new Date().toISOString()}`);

    res.json({
      success: true,
      token,
      admin: {
        id:          admin._id,
        username:    admin.username,
        name:        admin.name,
        role:        admin.role,
        lastLoginAt: admin.lastLoginAt
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Verify session status & get current admin info
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    authenticated: true,
    admin: {
      id:          req.admin._id,
      username:    req.admin.username,
      name:        req.admin.name,
      role:        req.admin.role,
      lastLoginAt: req.admin.lastLoginAt
    }
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── POST /api/auth/change-credentials ────────────────────────────────────────
router.post('/change-credentials', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to update credentials.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ error: 'Admin account not found.' });

    const isValid = await admin.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Update username if requested
    if (newUsername && newUsername.trim()) {
      const cleanNewUser = newUsername.trim().toLowerCase();
      if (cleanNewUser.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
      }
      if (cleanNewUser !== admin.username) {
        const existing = await Admin.findOne({ username: cleanNewUser });
        if (existing) {
          return res.status(409).json({ error: 'This username is already taken.' });
        }
        admin.username = cleanNewUser;
      }
    }

    // Update password if requested
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      admin.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await admin.save();

    // Re-issue fresh token
    const token = jwt.sign({
      id:       admin._id,
      username: admin.username,
      role:     admin.role
    }, JWT_SECRET, { expiresIn: '24h' });

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   24 * 60 * 60 * 1000
    });

    console.log(`[AUDIT] Admin credentials successfully updated for admin id: ${admin._id}`);

    res.json({
      success: true,
      token,
      admin: {
        id:       admin._id,
        username: admin.username,
        name:     admin.name,
        role:     admin.role
      }
    });
  } catch (err) {
    console.error('Change credentials error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

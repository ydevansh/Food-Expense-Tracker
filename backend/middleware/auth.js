const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'fe_tracker_jwt_secret_devansh_2026_secure_key_!#987';

/**
 * requireAdmin middleware
 * Enforces valid admin JWT either from HttpOnly cookie or Authorization Bearer header.
 * Returns 401 if unauthenticated, 403 if insufficient permissions.
 */
async function requireAdmin(req, res, next) {
  try {
    let token = null;

    // 1. Check cookies (preferred for browser sessions)
    if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    // 2. Fallback to Authorization: Bearer <token>
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: Admin authentication required. Please log in.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized: Session invalid or expired. Please log in again.'
      });
    }

    const admin = await Admin.findById(decoded.id).select('-passwordHash');
    if (!admin) {
      return res.status(401).json({
        error: 'Unauthorized: Administrator account no longer exists.'
      });
    }

    if (admin.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Insufficient administrator privileges.'
      });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

module.exports = {
  requireAdmin,
  JWT_SECRET
};

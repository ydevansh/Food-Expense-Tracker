const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    res.json(users.map(u => ({ ...u, id: u._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

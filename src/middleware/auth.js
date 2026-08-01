// const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// ── LOGIN DISABLED ──────────────────────────────────────────────────────────
// Email/password login is commented out (original guard preserved at the
// bottom of this file). Instead, every browser/device generates a permanent
// random ID once (frontend utils/api.js) and sends it as the `x-device-id`
// header. Each device gets its own User row here, so the server always knows
// which device created which project and what its progress is — while the
// actual videos never leave that device (they live in its IndexedDB).
const protect = async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] || '').trim();
    if (!/^[A-Za-z0-9-]{8,64}$/.test(deviceId)) {
      return res.status(401).json({ success: false, message: 'Missing device id' });
    }

    const email = `device-${deviceId.toLowerCase()}@pardex.local`;
    let user = await User.findOne({ email });
    if (!user) {
      try {
        user = await User.create({
          name: `Device ${deviceId.slice(0, 8)}`,
          email,
          // Never used for login — just satisfies the schema
          password: crypto.randomBytes(24).toString('hex'),
        });
      } catch (err) {
        // Two first requests raced to create the same device user
        if (err.code === 11000) user = await User.findOne({ email });
        else throw err;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/* ── original JWT login guard (disabled — restore by swapping with the
      device-id version above and re-enabling the jwt require) ─────────────
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};
*/

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not authorized` });
  }
  next();
};

module.exports = { protect, authorize };

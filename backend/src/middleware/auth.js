const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect REST routes — requires valid Bearer token
 */
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Verify Socket.IO connections
 * Usage: io.use(socketAuth)
 */
const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      // Allow anonymous connections with limited access
      socket.user = { _id: null, name: 'Anonymous', color: '#888' };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('Authentication error'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
};

/**
 * Generate a signed JWT
 */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = { protect, socketAuth, signToken };

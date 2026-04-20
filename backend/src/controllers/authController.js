const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id);

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: user.toPublic(),
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const match = await user.comparePassword(password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);
  res.json({ message: 'Login successful', token, user: user.toPublic() });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });
  }
  res.json({ message: 'Logged out' });
});

// PUT /api/auth/update-password
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  const match = await user.comparePassword(currentPassword);
  if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

module.exports = { register, login, getMe, logout, updatePassword };

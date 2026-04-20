const router = require('express').Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(protect);

// GET /api/users/search?q=email
router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ users: [] });

  const users = await User.find({
    $or: [
      { email: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
    ],
    _id: { $ne: req.user._id },
  }).select('name email color avatar').limit(10);

  res.json({ users });
}));

// GET /api/users/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name color avatar isOnline lastSeen');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}));

// PUT /api/users/profile
router.put('/profile', asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (color) updates.color = color;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true, runValidators: true,
  });
  res.json({ message: 'Profile updated', user: user.toPublic() });
}));

module.exports = router;

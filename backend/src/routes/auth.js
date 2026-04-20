const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  logout,
  updatePassword,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/update-password', protect, updatePassword);

module.exports = router;

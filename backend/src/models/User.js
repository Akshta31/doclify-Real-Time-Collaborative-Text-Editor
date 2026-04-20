const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never return password by default
    },
    avatar: {
      type: String,
      default: null,
    },
    color: {
      // Cursor / presence color for this user
      type: String,
      default: () => {
        const colors = ['#7c6af7', '#3dd68c', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
        return colors[Math.floor(Math.random() * colors.length)];
      },
    },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Public representation
userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    color: this.color,
    avatar: this.avatar,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

module.exports = mongoose.model('User', userSchema);

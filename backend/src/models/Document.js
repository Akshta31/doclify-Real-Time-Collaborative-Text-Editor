const mongoose = require('mongoose');

// ─── Version snapshot (for history) ──────────────────────────────────────────
const versionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  savedAt: { type: Date, default: Date.now },
  label: { type: String, default: 'Auto-save' },
});

// ─── Comment ──────────────────────────────────────────────────────────────────
const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 1000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Collaborator entry ───────────────────────────────────────────────────────
const collaboratorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['viewer', 'editor', 'owner'], default: 'editor' },
  addedAt: { type: Date, default: Date.now },
});

// ─── Document ─────────────────────────────────────────────────────────────────
const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
      default: 'Untitled Document',
    },
    content: {
      type: String,
      default: '<p></p>',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: [collaboratorSchema],
    comments: [commentSchema],
    versions: {
      type: [versionSchema],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true, // Only indexed when set
    },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    emoji: { type: String, default: '📄' },
    wordCount: { type: Number, default: 0 },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
documentSchema.index({ owner: 1, updatedAt: -1 });
documentSchema.index({ 'collaborators.user': 1 });
documentSchema.index({ shareToken: 1 });
documentSchema.index({ title: 'text', content: 'text' });

// ─── Virtual: collaborator count ──────────────────────────────────────────────
documentSchema.virtual('collaboratorCount').get(function () {
  return this.collaborators.length;
});

// ─── Method: check if user has access ─────────────────────────────────────────
documentSchema.methods.hasAccess = function (userId) {
  if (this.isPublic) return true;
  // owner may be a populated object or a raw ObjectId — handle both
  const ownerId = this.owner?._id ? this.owner._id.toString() : this.owner.toString();
  if (ownerId === userId.toString()) return true;
  return this.collaborators.some((c) => {
    const collabId = c.user?._id ? c.user._id.toString() : c.user.toString();
    return collabId === userId.toString();
  });
};

// ─── Method: get role for user ────────────────────────────────────────────────
documentSchema.methods.getUserRole = function (userId) {
  const ownerId = this.owner?._id ? this.owner._id.toString() : this.owner.toString();
  if (ownerId === userId.toString()) return 'owner';
  const collab = this.collaborators.find((c) => {
    const collabId = c.user?._id ? c.user._id.toString() : c.user.toString();
    return collabId === userId.toString();
  });
  return collab ? collab.role : null;
};

// ─── Auto-save version (keep last 20) ────────────────────────────────────────
documentSchema.methods.saveVersion = function (content, userId, label = 'Auto-save') {
  this.versions.push({ content, savedBy: userId, label });
  if (this.versions.length > 20) {
    this.versions = this.versions.slice(-20);
  }
};

module.exports = mongoose.model('Document', documentSchema);
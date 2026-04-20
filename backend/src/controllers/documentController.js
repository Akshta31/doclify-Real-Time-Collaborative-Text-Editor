const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countWords = (html) => {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
};

const docPopulate = [
  { path: 'owner', select: 'name email color avatar' },
  { path: 'collaborators.user', select: 'name email color avatar' },
  { path: 'comments.author', select: 'name color avatar' },
  { path: 'lastEditedBy', select: 'name color' },
];

// ─── GET /api/documents ───────────────────────────────────────────────────────
const getDocuments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { search, page = 1, limit = 20 } = req.query;

  const query = {
    $or: [{ owner: userId }, { 'collaborators.user': userId }],
  };

  if (search) {
    query.$text = { $search: search };
  }

  const [docs, total] = await Promise.all([
    Document.find(query)
      .populate('owner', 'name color')
      .populate('lastEditedBy', 'name')
      .select('-content -versions')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Document.countDocuments(query),
  ]);

  res.json({ documents: docs, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// ─── GET /api/documents/:id ───────────────────────────────────────────────────
const getDocument = asyncHandler(async (req, res) => {
  // First fetch without populate so hasAccess compares raw ObjectIds reliably
  const doc = await Document.findById(req.params.id).select('-versions');

  if (!doc) return res.status(404).json({ message: 'Document not found' });

  if (!doc.hasAccess(req.user._id)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Now populate for the response
  await doc.populate(docPopulate);

  res.json({ document: doc });
});

// ─── POST /api/documents ──────────────────────────────────────────────────────
const createDocument = asyncHandler(async (req, res) => {
  const { title, content, emoji } = req.body;

  const doc = await Document.create({
    title: title || 'Untitled Document',
    content: content || '<p></p>',
    owner: req.user._id,
    emoji: emoji || '📄',
    lastEditedBy: req.user._id,
  });

  await doc.populate('owner', 'name email color');

  // Notify collaborators via socket
  req.io?.emit('document:created', {
    documentId: doc._id,
    title: doc.title,
    owner: doc.owner,
  });

  res.status(201).json({ message: 'Document created', document: doc });
});

// ─── PUT /api/documents/:id ───────────────────────────────────────────────────
const updateDocument = asyncHandler(async (req, res) => {
  const { title, content, emoji, tags } = req.body;

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (!doc.hasAccess(req.user._id)) return res.status(403).json({ message: 'Access denied' });

  const role = doc.getUserRole(req.user._id);
  if (role === 'viewer') return res.status(403).json({ message: 'You have view-only access' });

  // Save version snapshot before overwriting
  if (content && content !== doc.content) {
    doc.saveVersion(doc.content, req.user._id);
    doc.content = content;
    doc.wordCount = countWords(content);
    doc.lastEditedBy = req.user._id;
  }

  if (title !== undefined) doc.title = title;
  if (emoji !== undefined) doc.emoji = emoji;
  if (tags !== undefined) doc.tags = tags;

  await doc.save();
  await doc.populate(docPopulate);

  // Broadcast update to all users in this document room
  req.io?.to(`doc:${doc._id}`).emit('document:updated', {
    documentId: doc._id,
    title: doc.title,
    content: doc.content,
    updatedBy: req.user.toPublic(),
    updatedAt: doc.updatedAt,
  });

  res.json({ message: 'Document saved', document: doc });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the owner can delete this document' });
  }

  await doc.deleteOne();
  req.io?.emit('document:deleted', { documentId: req.params.id });
  res.json({ message: 'Document deleted' });
});

// ─── POST /api/documents/:id/share ────────────────────────────────────────────
const shareDocument = asyncHandler(async (req, res) => {
  const { email, role = 'editor' } = req.body;
  const doc = await Document.findById(req.params.id);

  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the owner can share this document' });
  }

  const invitee = await User.findOne({ email: email.toLowerCase() });
  if (!invitee) return res.status(404).json({ message: 'User with that email not found' });

  // Avoid duplicates
  const already = doc.collaborators.some(
    (c) => c.user.toString() === invitee._id.toString()
  );
  if (already) return res.status(409).json({ message: 'User is already a collaborator' });

  doc.collaborators.push({ user: invitee._id, role });
  await doc.save();
  await doc.populate(docPopulate);

  res.json({ message: `${invitee.name} added as ${role}`, document: doc });
});

// ─── DELETE /api/documents/:id/collaborators/:userId ─────────────────────────
const removeCollaborator = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the owner can remove collaborators' });
  }

  doc.collaborators = doc.collaborators.filter(
    (c) => c.user.toString() !== req.params.userId
  );
  await doc.save();
  res.json({ message: 'Collaborator removed' });
});

// ─── POST /api/documents/:id/share-link ───────────────────────────────────────
const generateShareLink = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  doc.shareToken = uuidv4();
  doc.isPublic = true;
  await doc.save();

  res.json({
    message: 'Share link generated',
    shareLink: `${process.env.CLIENT_URL}/doc/shared/${doc.shareToken}`,
    shareToken: doc.shareToken,
  });
});

// ─── GET /api/documents/shared/:token ────────────────────────────────────────
const getSharedDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ shareToken: req.params.token, isPublic: true })
    .populate('owner', 'name color')
    .select('-versions');

  if (!doc) return res.status(404).json({ message: 'Document not found or link expired' });
  res.json({ document: doc });
});

// ─── GET /api/documents/:id/versions ─────────────────────────────────────────
const getVersions = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id)
    .select('versions owner collaborators')
    .populate('versions.savedBy', 'name color');

  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (!doc.hasAccess(req.user._id)) return res.status(403).json({ message: 'Access denied' });

  res.json({ versions: doc.versions.reverse() });
});

// ─── POST /api/documents/:id/restore/:versionId ───────────────────────────────
const restoreVersion = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  const version = doc.versions.id(req.params.versionId);
  if (!version) return res.status(404).json({ message: 'Version not found' });

  doc.saveVersion(doc.content, req.user._id, 'Before restore');
  doc.content = version.content;
  doc.lastEditedBy = req.user._id;
  await doc.save();

  res.json({ message: 'Version restored', content: doc.content });
});

// ─── POST /api/documents/:id/comments ────────────────────────────────────────
const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Comment text is required' });

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (!doc.hasAccess(req.user._id)) return res.status(403).json({ message: 'Access denied' });

  doc.comments.push({ text, author: req.user._id });
  await doc.save();
  await doc.populate('comments.author', 'name color avatar');

  const comment = doc.comments[doc.comments.length - 1];

  req.io?.to(`doc:${doc._id}`).emit('comment:new', {
    documentId: doc._id,
    comment,
  });

  res.status(201).json({ message: 'Comment added', comment });
});

// ─── DELETE /api/documents/:id/comments/:commentId ───────────────────────────
const deleteComment = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  const comment = doc.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (comment.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Cannot delete other user\'s comment' });
  }

  comment.deleteOne();
  await doc.save();
  res.json({ message: 'Comment deleted' });
});

module.exports = {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  removeCollaborator,
  generateShareLink,
  getSharedDocument,
  getVersions,
  restoreVersion,
  addComment,
  deleteComment,
};

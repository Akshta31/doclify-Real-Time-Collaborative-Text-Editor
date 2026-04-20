const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
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
} = require('../controllers/documentController');

// Public routes (no auth required)
router.get('/shared/:token', getSharedDocument);

// All routes below require authentication
router.use(protect);

router.route('/')
  .get(getDocuments)
  .post(createDocument);

router.route('/:id')
  .get(getDocument)
  .put(updateDocument)
  .delete(deleteDocument);

router.post('/:id/share', shareDocument);
router.delete('/:id/collaborators/:userId', removeCollaborator);
router.post('/:id/share-link', generateShareLink);

router.get('/:id/versions', getVersions);
router.post('/:id/restore/:versionId', restoreVersion);

router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

module.exports = router;

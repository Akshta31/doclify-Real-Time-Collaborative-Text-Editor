const { socketAuth } = require('../middleware/auth');
const Document = require('../models/Document');

/**
 * In-memory map of active document rooms:
 * { docId: { socketId: { userId, name, color, cursor } } }
 */
const activeRooms = new Map();

// Debounce auto-save: { docId: timeoutId }
const saveTimers = new Map();

const AUTOSAVE_DELAY = 3000; // ms

/**
 * Count words from HTML string
 */
const countWords = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;

/**
 * Get all presence info for a room
 */
const getRoomPresence = (docId) => {
  const room = activeRooms.get(docId) || {};
  return Object.values(room);
};

/**
 * Initialize all Socket.IO event handlers
 */
const initSocketHandlers = (io) => {
  // Authenticate every socket connection
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 Socket connected: ${socket.id} (${user?.name || 'anon'})`);

    // ── JOIN DOCUMENT ROOM ─────────────────────────────────────────────────
    socket.on('doc:join', async ({ docId }) => {
      try {
        // Verify access
        if (user?._id) {
          const doc = await Document.findById(docId).select('owner collaborators isPublic');
          if (!doc) return socket.emit('error', { message: 'Document not found' });
          if (!doc.hasAccess(user._id)) {
            return socket.emit('error', { message: 'Access denied' });
          }
        }

        const roomName = `doc:${docId}`;
        socket.join(roomName);

        // Track presence
        if (!activeRooms.has(docId)) activeRooms.set(docId, {});
        activeRooms.get(docId)[socket.id] = {
          socketId: socket.id,
          userId: user?._id?.toString() || null,
          name: user?.name || 'Anonymous',
          color: user?.color || '#888',
          cursor: null,
        };

        // Notify others
        socket.to(roomName).emit('presence:update', {
          docId,
          users: getRoomPresence(docId),
        });

        // Send current presence to the joining user
        socket.emit('presence:init', {
          docId,
          users: getRoomPresence(docId),
        });

        console.log(`📄 ${user?.name || 'anon'} joined doc:${docId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── LEAVE DOCUMENT ROOM ────────────────────────────────────────────────
    socket.on('doc:leave', ({ docId }) => {
      leaveRoom(socket, docId, io);
    });

    // ── REAL-TIME CONTENT UPDATE (operational transform lite) ─────────────
    socket.on('doc:change', async ({ docId, content, title }) => {
      const roomName = `doc:${docId}`;

      // Broadcast delta to all OTHER users in the room immediately
      socket.to(roomName).emit('doc:change', {
        docId,
        content,
        title,
        sentBy: socket.id,
        timestamp: Date.now(),
      });

      // Debounced auto-save to MongoDB
      if (saveTimers.has(docId)) clearTimeout(saveTimers.get(docId));
      saveTimers.set(
        docId,
        setTimeout(async () => {
          try {
            const doc = await Document.findById(docId);
            if (!doc) return;

            const hasChanged = content !== undefined && content !== doc.content;
            if (hasChanged) {
              doc.saveVersion(doc.content, user?._id, 'Auto-save');
              doc.content = content;
              doc.wordCount = countWords(content);
              doc.lastEditedBy = user?._id || null;
            }
            if (title && title !== doc.title) doc.title = title;
            if (hasChanged || (title && title !== doc.title)) {
              await doc.save();
              io.to(roomName).emit('doc:saved', {
                docId,
                savedAt: new Date().toISOString(),
                wordCount: doc.wordCount,
              });
            }
          } catch (err) {
            console.error('Auto-save error:', err.message);
          }
          saveTimers.delete(docId);
        }, AUTOSAVE_DELAY)
      );
    });

    // ── CURSOR POSITION ────────────────────────────────────────────────────
    socket.on('cursor:move', ({ docId, position, selection }) => {
      const room = activeRooms.get(docId);
      if (room && room[socket.id]) {
        room[socket.id].cursor = { position, selection };
      }

      socket.to(`doc:${docId}`).emit('cursor:move', {
        socketId: socket.id,
        userId: user?._id?.toString(),
        name: user?.name || 'Anonymous',
        color: user?.color || '#888',
        position,
        selection,
      });
    });

    // ── TYPING INDICATOR ───────────────────────────────────────────────────
    socket.on('user:typing', ({ docId, isTyping }) => {
      socket.to(`doc:${docId}`).emit('user:typing', {
        socketId: socket.id,
        name: user?.name || 'Anonymous',
        color: user?.color || '#888',
        isTyping,
      });
    });

    // ── MANUAL SAVE REQUEST ────────────────────────────────────────────────
    socket.on('doc:save', async ({ docId, content, title }) => {
      try {
        const doc = await Document.findById(docId);
        if (!doc) return socket.emit('error', { message: 'Document not found' });

        if (content) {
          doc.saveVersion(doc.content, user?._id, 'Manual save');
          doc.content = content;
          doc.wordCount = countWords(content);
          doc.lastEditedBy = user?._id || null;
        }
        if (title) doc.title = title;
        await doc.save();

        socket.emit('doc:saved', {
          docId,
          savedAt: new Date().toISOString(),
          wordCount: doc.wordCount,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── COMMENT ────────────────────────────────────────────────────────────
    socket.on('comment:add', async ({ docId, text }) => {
      try {
        const doc = await Document.findById(docId);
        if (!doc || !user?._id) return;

        doc.comments.push({ text, author: user._id });
        await doc.save();
        await doc.populate('comments.author', 'name color avatar');

        const comment = doc.comments[doc.comments.length - 1];
        io.to(`doc:${docId}`).emit('comment:new', { docId, comment });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    socket.on('disconnecting', () => {
      socket.rooms.forEach((room) => {
        if (room.startsWith('doc:')) {
          const docId = room.replace('doc:', '');
          leaveRoom(socket, docId, io);
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

/**
 * Clean up a socket leaving a room
 */
function leaveRoom(socket, docId, io) {
  const roomName = `doc:${docId}`;
  socket.leave(roomName);

  const room = activeRooms.get(docId);
  if (room) {
    delete room[socket.id];
    if (Object.keys(room).length === 0) {
      activeRooms.delete(docId);
    } else {
      io.to(roomName).emit('presence:update', {
        docId,
        users: getRoomPresence(docId),
      });
    }
  }

  io.to(roomName).emit('user:left', {
    socketId: socket.id,
    name: socket.user?.name || 'Anonymous',
  });
}

module.exports = { initSocketHandlers };

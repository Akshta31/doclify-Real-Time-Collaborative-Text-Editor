import { useState, useEffect, useRef, useCallback } from 'react';
import { docAPI } from '../utils/api';
import { getSocket } from '../utils/socket';

export const useDocument = (docId) => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'
  const [presence, setPresence] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [comments, setComments] = useState([]);
  const saveTimer = useRef(null);
  const socket = getSocket();

  // Load document
  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    docAPI.get(docId)
      .then(res => {
        setDocument(res.data.document);
        setComments(res.data.document.comments || []);
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load document'))
      .finally(() => setLoading(false));
  }, [docId]);

  // Socket events for this document
  useEffect(() => {
    if (!docId || !socket) return;

    socket.emit('doc:join', { docId });

    socket.on('doc:change', ({ content, title, sentBy }) => {
      if (sentBy === socket.id) return;
      setDocument(prev => prev ? { ...prev, content, title: title || prev.title } : prev);
    });

    socket.on('doc:saved', ({ savedAt, wordCount }) => {
      setSaveStatus('saved');
      setDocument(prev => prev ? { ...prev, updatedAt: savedAt, wordCount } : prev);
    });

    socket.on('presence:init', ({ users }) => setPresence(users));
    socket.on('presence:update', ({ users }) => setPresence(users));

    socket.on('cursor:move', (data) => {
      setRemoteCursors(prev => ({ ...prev, [data.socketId]: data }));
    });

    socket.on('user:left', ({ socketId }) => {
      setRemoteCursors(prev => { const n = { ...prev }; delete n[socketId]; return n; });
    });

    socket.on('comment:new', ({ comment }) => {
      setComments(prev => [...prev, comment]);
    });

    return () => {
      socket.emit('doc:leave', { docId });
      socket.off('doc:change');
      socket.off('doc:saved');
      socket.off('presence:init');
      socket.off('presence:update');
      socket.off('cursor:move');
      socket.off('user:left');
      socket.off('comment:new');
    };
  }, [docId, socket]);

  // Broadcast local changes + debounced autosave trigger
  const handleChange = useCallback((content, title) => {
    setDocument(prev => prev ? { ...prev, content, title: title || prev.title } : prev);
    setSaveStatus('saving');
    socket.emit('doc:change', { docId, content, title });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus('saved'), 3500);
  }, [docId, socket]);

  // Manual save
  const saveNow = useCallback(async (content, title) => {
    setSaveStatus('saving');
    try {
      socket.emit('doc:save', { docId, content, title });
      await docAPI.update(docId, { content, title });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [docId, socket]);

  // Move cursor
  const moveCursor = useCallback((position, selection) => {
    socket.emit('cursor:move', { docId, position, selection });
  }, [docId, socket]);

  // Add comment
  const addComment = useCallback(async (text) => {
    socket.emit('comment:add', { docId, text });
  }, [docId, socket]);

  return {
    document, setDocument, loading, error,
    saveStatus, presence, remoteCursors,
    comments, setComments,
    handleChange, saveNow, moveCursor, addComment,
  };
};

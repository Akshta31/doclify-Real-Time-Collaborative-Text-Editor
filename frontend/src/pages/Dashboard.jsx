import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { docAPI } from '../utils/api';
import { formatDistanceToNow } from 'date-fns';

const EMOJIS = ['📄', '📊', '🗓', '🎨', '⚙️', '📝', '💡', '🚀', '📌', '🔬'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('doclify_theme') || 'dark');

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('doclify_theme', theme);
  }, [theme]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await docAPI.list({ search });
      setDocs(res.data.documents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const createDoc = async () => {
    setCreating(true);
    try {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const res = await docAPI.create({ title: 'Untitled Document', emoji });
      navigate(`/doc/${res.data.document._id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const deleteDoc = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document?')) return;
    try {
      await docAPI.delete(id);
      setDocs(prev => prev.filter(d => d._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting document');
    }
  };

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div style={s.page}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.logo}>
          <div style={s.logoIcon}>✦</div>
          <span style={s.logoText}>Doclify</span>
        </div>
        <div style={s.navRight}>
          <button
            className="btn-icon"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <div style={s.avatarWrap} title={user?.name}>
            <div style={{ ...s.avatar, background: user?.color || 'var(--accent)' }}>
              {initials(user?.name)}
            </div>
            <div style={s.userInfo}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div style={s.body}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.heading}>My Documents</h1>
            <p style={s.sub}>
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={createDoc}
            disabled={creating}
            style={{ gap: 8 }}
          >
            {creating
              ? <span className="spinner" style={{ width: 14, height: 14 }} />
              : '+'}{' '}
            New Document
          </button>
        </div>

        {/* Search */}
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input
            className="input"
            style={{ paddingLeft: 36, background: 'var(--bg2)' }}
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Doc Grid */}
        {loading ? (
          <div style={s.centerLoader}><div className="spinner" /></div>
        ) : docs.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)' }}>No documents yet</div>
            <p style={{ color: 'var(--text3)', marginTop: 6 }}>
              {search ? 'No documents match your search.' : 'Create your first document to get started.'}
            </p>
          </div>
        ) : (
          <div style={s.grid}>
            {docs.map(doc => (
              <div
                key={doc._id}
                style={s.docCard}
                className="fade-in"
                onClick={() => navigate(`/doc/${doc._id}`)}
              >
                <div style={s.docEmoji}>{doc.emoji || '📄'}</div>
                <div style={s.docTitle}>{doc.title}</div>
                <div style={s.docMeta}>
                  <span>
                    {doc.updatedAt
                      ? formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })
                      : 'Recently'}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>•</span>
                  <span>{doc.wordCount || 0} words</span>
                </div>
                <div style={s.docFooter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* Owner avatar */}
                    <div style={{ ...s.miniAvatar, background: doc.owner?.color || 'var(--accent)' }}>
                      {initials(doc.owner?.name)}
                    </div>
                    {/* Collab count */}
                    {doc.collaborators?.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        +{doc.collaborators.length}
                      </span>
                    )}
                  </div>
                  {doc.owner?._id?.toString() === user?._id?.toString() && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={e => deleteDoc(e, doc._id)}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    height: 56, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 30, height: 30, background: 'linear-gradient(135deg, var(--accent), #c084fc)',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--accent2)', letterSpacing: '-0.5px' },
  navRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
  avatarWrap: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  userInfo: {},
  body: { maxWidth: 1100, margin: '0 auto', width: '100%', padding: '32px 24px', flex: 1 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  heading: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.5px' },
  sub: { color: 'var(--text3)', marginTop: 4, fontSize: 13 },
  searchWrap: { position: 'relative', marginBottom: 24, maxWidth: 400 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none' },
  centerLoader: { display: 'flex', justifyContent: 'center', padding: 80 },
  empty: { textAlign: 'center', padding: '80px 24px', color: 'var(--text2)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  docCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
    padding: '20px', cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', flexDirection: 'column', gap: 8,
    ':hover': { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' },
  },
  docEmoji: { fontSize: 28, marginBottom: 4 },
  docTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  docMeta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' },
  docFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' },
  miniAvatar: { width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' },
};

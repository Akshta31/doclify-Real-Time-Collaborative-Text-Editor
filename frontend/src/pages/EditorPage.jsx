import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDocument } from '../hooks/useDocument';
import { docAPI } from '../utils/api';

const EMOJIS_BY_TYPE = { txt: '📄', html: '🌐', md: '📝' };

const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    document: doc, setDocument, loading, error,
    saveStatus, presence, remoteCursors,
    comments, handleChange, saveNow, addComment,
  } = useDocument(id);

  const editorRef = useRef(null);
  const [title, setTitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelTab, setPanelTab] = useState('people'); // people | history | comments
  const [versions, setVersions] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [commentText, setCommentText] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('doclify_theme') || 'dark');
  const titleTimer = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('doclify_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      if (editorRef.current && editorRef.current.innerHTML !== doc.content) {
        editorRef.current.innerHTML = doc.content || '<p></p>';
      }
    }
  }, [doc?._id]);

  const onEditorInput = useCallback(() => {
    const content = editorRef.current?.innerHTML || '';
    handleChange(content, title);
  }, [handleChange, title]);

  const onTitleChange = (e) => {
    setTitle(e.target.value);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      handleChange(editorRef.current?.innerHTML || '', e.target.value);
    }, 600);
  };

  const fmt = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const wordCount = () => {
    const text = editorRef.current?.innerText || '';
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const doExport = (type) => {
    const content = editorRef.current;
    let text, mime, ext;
    if (type === 'txt') { text = content.innerText; mime = 'text/plain'; ext = 'txt'; }
    else if (type === 'html') { text = `<!DOCTYPE html><html><head><title>${title}</title></head><body>${content.innerHTML}</body></html>`; mime = 'text/html'; ext = 'html'; }
    else { text = content.innerText; mime = 'text/markdown'; ext = 'md'; }
    const blob = new Blob([text], { type: mime });
    const a = window.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'document'}.${ext}`;
    a.click();
    setShowExport(false);
  };

  const loadVersions = async () => {
    try {
      const res = await docAPI.getVersions(id);
      setVersions(res.data.versions);
    } catch {}
  };

  const restoreVersion = async (versionId, content) => {
    if (!window.confirm('Restore this version? Your current content will be saved first.')) return;
    await docAPI.restoreVersion(id, versionId);
    if (editorRef.current) editorRef.current.innerHTML = content;
    handleChange(content, title);
  };

  const generateShareLink = async () => {
    try {
      const res = await docAPI.generateShareLink(id);
      setShareLink(res.data.shareLink);
    } catch {}
  };

  const sendShareInvite = async () => {
    if (!shareEmail) return;
    setShareLoading(true);
    try {
      await docAPI.share(id, { email: shareEmail, role: 'editor' });
      setShareEmail('');
      alert(`Invite sent to ${shareEmail}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error sending invite');
    } finally {
      setShareLoading(false);
    }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText.trim());
    setCommentText('');
  };

  const manualSave = () => saveNow(editorRef.current?.innerHTML || '', title);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontWeight: 600 }}>{error}</div>
      <button className="btn btn-primary" onClick={() => navigate('/')}>← Back to Dashboard</button>
    </div>
  );

  return (
    <div style={s.root}>
      {/* NAVBAR */}
      <nav style={s.nav}>
        <button className="btn-icon" onClick={() => navigate('/')} title="Dashboard" style={{ marginRight: 4 }}>←</button>
        <div style={s.logoSmall}>✦</div>
        <input
          style={s.titleInput}
          value={title}
          onChange={onTitleChange}
          placeholder="Untitled Document"
        />
        <div style={s.navRight}>
          {/* Presence avatars */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {presence.slice(0, 5).map((p, i) => (
              <div
                key={p.socketId}
                style={{ ...s.presenceAvatar, background: p.color, zIndex: 5 - i, marginLeft: i === 0 ? 0 : -6 }}
                title={p.name}
              >
                {initials(p.name)}
              </div>
            ))}
          </div>
          {/* Save status */}
          <div style={{ ...s.saveStatus, color: saveStatus === 'saving' ? 'var(--orange)' : saveStatus === 'error' ? 'var(--red)' : 'var(--green)' }}>
            {saveStatus === 'saving' ? '↻ Saving...' : saveStatus === 'error' ? '⚠ Error' : '✓ Saved'}
          </div>
          <button className="btn btn-sm" onClick={() => setShowShare(true)}>🔗 Share</button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowExport(true)}>⬇ Export</button>
          <button className="btn-icon" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <button className="btn-icon" onClick={() => setSidebarOpen(o => !o)} title="Toggle panel">▧</button>
        </div>
      </nav>

      {/* TOOLBAR */}
      <div style={s.toolbar}>
        <select style={s.tbSelect} onChange={e => fmt('formatBlock', e.target.value)}>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>
        <div style={s.tbDivider} />
        <button style={s.tbBtn} onClick={() => fmt('bold')} title="Bold"><b>B</b></button>
        <button style={s.tbBtn} onClick={() => fmt('italic')} title="Italic"><i>I</i></button>
        <button style={s.tbBtn} onClick={() => fmt('underline')} title="Underline"><u>U</u></button>
        <button style={s.tbBtn} onClick={() => fmt('strikeThrough')} title="Strike"><s>S</s></button>
        <div style={s.tbDivider} />
        <button style={s.tbBtn} onClick={() => fmt('insertUnorderedList')}>• List</button>
        <button style={s.tbBtn} onClick={() => fmt('insertOrderedList')}>1. List</button>
        <div style={s.tbDivider} />
        <button style={s.tbBtn} onClick={() => fmt('justifyLeft')}>⟵</button>
        <button style={s.tbBtn} onClick={() => fmt('justifyCenter')}>⊣⊢</button>
        <button style={s.tbBtn} onClick={() => fmt('justifyRight')}>⟶</button>
        <div style={s.tbDivider} />
        <button style={s.tbBtn} onClick={() => { const url = prompt('URL:', 'https://'); if (url) fmt('createLink', url); }}>🔗</button>
        <button style={s.tbBtn} onClick={() => fmt('insertHorizontalRule')}>—</button>
        <div style={s.tbDivider} />
        <button style={s.tbBtn} onClick={() => fmt('undo')}>↩</button>
        <button style={s.tbBtn} onClick={() => fmt('redo')}>↪</button>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {wordCount()} words
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>
        {/* EDITOR */}
        <div style={s.editorScroll}>
          <div style={s.page}>
            {/* Remote cursors */}
            {Object.values(remoteCursors).map(c => (
              <div key={c.socketId} style={{ ...s.remoteCursor, background: c.color, top: (c.position?.top || 100) }}>
                <div style={{ ...s.cursorLabel, background: c.color }}>{c.name}</div>
              </div>
            ))}
            <div
              id="editor"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              style={s.editorContent}
              onInput={onEditorInput}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  manualSave();
                }
              }}
              data-placeholder="Start writing your document..."
            />
          </div>
        </div>

        {/* RIGHT PANEL */}
        {sidebarOpen && (
          <aside style={s.panel}>
            <div style={s.panelTabs}>
              {['people', 'history', 'comments'].map(tab => (
                <button
                  key={tab}
                  style={{ ...s.panelTab, ...(panelTab === tab ? s.panelTabActive : {}) }}
                  onClick={() => { setPanelTab(tab); if (tab === 'history') loadVersions(); }}
                >
                  {tab === 'people' ? '👥' : tab === 'history' ? '🕓' : '💬'}
                  {' '}{tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div style={s.panelBody}>
              {panelTab === 'people' && (
                <>
                  <div style={s.sectionTitle}>Online Now</div>
                  {presence.map(p => (
                    <div key={p.socketId} style={s.userCard}>
                      <div style={{ ...s.userAvatar, background: p.color }}>{initials(p.name)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}{p.userId === user?._id?.toString() ? ' (you)' : ''}</div>
                        <span className="badge badge-green" style={{ marginTop: 2 }}>● Editing</span>
                      </div>
                    </div>
                  ))}
                  {presence.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>Only you are here</div>}
                  <div style={{ ...s.sectionTitle, marginTop: 20 }}>Document</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2 }}>
                    <div>Owner: {doc?.owner?.name}</div>
                    <div>Words: {doc?.wordCount || 0}</div>
                    <div>Collaborators: {doc?.collaborators?.length || 0}</div>
                    <div>Created: {doc?.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}</div>
                  </div>
                </>
              )}
              {panelTab === 'history' && (
                <>
                  <div style={s.sectionTitle}>Version History</div>
                  {versions.length === 0
                    ? <div style={{ color: 'var(--text3)', fontSize: 12 }}>No saved versions yet.</div>
                    : versions.map((v, i) => (
                      <div key={v._id} style={s.versionItem}>
                        <div style={{ ...s.vDot, background: i === 0 ? 'var(--accent2)' : 'var(--text3)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{v.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {v.savedBy?.name} · {new Date(v.savedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        {i > 0 && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => restoreVersion(v._id, v.content)}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ))
                  }
                </>
              )}
              {panelTab === 'comments' && (
                <>
                  <div style={s.sectionTitle}>Notes & Comments</div>
                  {comments.map(c => (
                    <div key={c._id} style={s.commentCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ ...s.miniAvatar, background: c.author?.color || 'var(--accent)' }}>
                          {initials(c.author?.name)}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)' }}>{c.author?.name}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      className="input"
                      style={{ height: 72, resize: 'none', fontSize: 13 }}
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ justifyContent: 'center' }}
                      onClick={postComment}
                    >
                      Post Comment
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* STATUS BAR */}
      <div style={s.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--green)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
          {presence.length > 0 ? `${presence.length} online` : 'Connected'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 16 }}>
          {doc?.title}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          Doclify v1.0 · {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* EXPORT MODAL */}
      {showExport && (
        <Modal onClose={() => setShowExport(false)} title="Export Document">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['txt', 'html', 'md'].map(type => (
              <button key={type} className="btn" style={{ justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => doExport(type)}>
                {EMOJIS_BY_TYPE[type]} {type === 'txt' ? 'Plain Text (.txt)' : type === 'html' ? 'HTML File (.html)' : 'Markdown (.md)'}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* SHARE MODAL */}
      {showShare && (
        <Modal onClose={() => setShowShare(false)} title="Share Document">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={s.modalLabel}>Invite by email</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="input" type="email" placeholder="colleague@company.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={sendShareInvite} disabled={shareLoading}>
                  {shareLoading ? '...' : 'Invite'}
                </button>
              </div>
            </div>
            <div>
              <label style={s.modalLabel}>Share link</label>
              {shareLink
                ? <div style={s.shareLink} onClick={() => { navigator.clipboard.writeText(shareLink); alert('Copied!'); }}>{shareLink}</div>
                : <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={generateShareLink}>Generate share link</button>
              }
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const s = {
  root: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' },
  nav: {
    height: 52, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0, zIndex: 50,
  },
  logoSmall: { width: 26, height: 26, background: 'linear-gradient(135deg,var(--accent),#c084fc)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 },
  titleInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text)',
    textAlign: 'center', maxWidth: 320, padding: '4px 8px', borderRadius: 6,
    transition: 'background 0.15s',
  },
  navRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 },
  presenceAvatar: {
    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff',
    border: '2px solid var(--bg2)', cursor: 'default',
  },
  saveStatus: { fontSize: 11, fontWeight: 500, minWidth: 70 },
  toolbar: {
    height: 40, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', padding: '0 12px', gap: 2, flexShrink: 0, overflowX: 'auto',
  },
  tbSelect: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text2)', fontFamily: 'var(--font-body)', fontSize: 12, padding: '3px 6px', height: 26, outline: 'none',
  },
  tbDivider: { width: 1, height: 18, background: 'var(--border2)', margin: '0 4px', flexShrink: 0 },
  tbBtn: {
    minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text2)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 5px', transition: 'all 0.12s',
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  editorScroll: { flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 24px', background: 'var(--bg)' },
  page: {
    width: '100%', maxWidth: 720, background: 'var(--bg2)', borderRadius: 12,
    border: '1px solid var(--border)', padding: '56px 64px', minHeight: 900,
    position: 'relative', flexShrink: 0, boxShadow: 'var(--shadow)',
  },
  remoteCursor: { position: 'absolute', width: 2, borderRadius: 1, height: 22, pointerEvents: 'none', zIndex: 10 },
  cursorLabel: { position: 'absolute', top: -20, left: 0, color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' },
  editorContent: {
    width: '100%', minHeight: 800, outline: 'none',
    fontFamily: 'var(--font-body)', fontSize: 15.5, lineHeight: 1.8,
    color: 'var(--text)', caretColor: 'var(--accent2)',
  },
  statusBar: {
    height: 28, background: 'var(--bg2)', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0,
  },
  panel: { width: 260, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  panelTabs: { display: 'flex', borderBottom: '1px solid var(--border)' },
  panelTab: { flex: 1, padding: '10px 4px', fontSize: 11, fontWeight: 500, textAlign: 'center', color: 'var(--text3)', cursor: 'pointer', border: 'none', background: 'transparent', borderBottom: '2px solid transparent', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  panelTabActive: { color: 'var(--accent2)', borderBottomColor: 'var(--accent)' },
  panelBody: { flex: 1, overflowY: 'auto', padding: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text3)', marginBottom: 8 },
  userCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)', marginBottom: 8 },
  userAvatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 },
  miniAvatar: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 },
  versionItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  vDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  commentCard: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  modalLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  shareLink: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--accent2)', fontFamily: 'monospace', wordBreak: 'break-all', cursor: 'pointer', marginTop: 6 },
};

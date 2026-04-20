import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className="fade-in">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>✦</div>
          <span style={styles.logoText}>Doclify</span>
        </div>
        <p style={styles.tagline}>
          {mode === 'login' ? 'Welcome back — sign in to your workspace' : 'Create your free account'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Full Name</label>
              <input
                className="input"
                placeholder="Alex Johnson"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              className="input"
              type="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4 }}
          >
            {loading
              ? <span className="spinner" style={{ width: 16, height: 16 }} />
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={styles.divider}><span>or</span></div>

        <div style={styles.demoBox}>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Demo credentials</p>
          <button
            className="btn btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              setForm({ name: '', email: 'alice@doclify.app', password: 'password123' });
              setMode('login');
            }}
          >
            Use alice@doclify.app
          </button>
        </div>

        <p style={styles.switchText}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            style={styles.switchBtn}
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 400,
    boxShadow: 'var(--shadow)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    justifyContent: 'center',
  },
  logoIcon: {
    width: 36, height: 36,
    background: 'linear-gradient(135deg, var(--accent), #c084fc)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 26,
    color: 'var(--accent2)',
    letterSpacing: '-0.5px',
  },
  tagline: {
    textAlign: 'center',
    color: 'var(--text3)',
    fontSize: 13,
    marginBottom: 28,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--red)',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '20px 0',
    '&::before, &::after': { content: '""', flex: 1, height: 1, background: 'var(--border)' },
    '& span': { fontSize: 12, color: 'var(--text3)' },
  },
  demoBox: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px',
    marginTop: 16,
  },
  switchText: { textAlign: 'center', color: 'var(--text2)', fontSize: 13, marginTop: 20 },
  switchBtn: {
    background: 'none', border: 'none',
    color: 'var(--accent2)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', padding: 0,
  },
};

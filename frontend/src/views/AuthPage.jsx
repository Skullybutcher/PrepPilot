import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Aurora from '../components/Aurora';
import Logo from '../components/Logo';

/**
 * AuthPage — handles both /login and /signup.
 * `mode` prop: 'login' | 'signup'
 *
 * Post-login: redirects to location.state.from (the page that triggered the
 * ProtectedRoute redirect) or /dashboard as fallback.
 * Post-signup: if email confirmation required, shows a "check your inbox" screen;
 * otherwise redirects straight to /dashboard.
 */
export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { signIn, signUp } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/dashboard';

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState('');
  const [confirmed, setConfirmed] = useState(false); // email verify pending

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim())    return setError('Email is required.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error: err } = await signIn(email, password);
        if (err) { setError(err.message); return; }
        navigate(from, { replace: true });
      } else {
        const { error: err, needsConfirmation } = await signUp(email, password);
        if (err) { setError(err.message); return; }
        if (needsConfirmation) { setConfirmed(true); return; }
        // Fire event so AppShell shows the Jira setup modal after redirect
        window.dispatchEvent(new CustomEvent('pp:jira-setup-needed'));
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Email confirmation pending state
  if (confirmed) {
    return (
      <div className="auth-page">
        <Aurora />
        <motion.div
          className="auth-card glass"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="auth-confirm-icon" aria-hidden="true">📬</div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-sub">
            We sent a verification link to <strong>{email}</strong>. Click it to
            activate your account, then come back to sign in.
          </p>
          <Link to="/login" className="auth-switch-link">← Back to sign in</Link>
        </motion.div>
        <style>{authStyles}</style>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Aurora />

      <motion.div
        className="auth-card glass"
        initial={{ opacity: 0, scale: 0.97, y: 24 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Logo */}
        <Link to="/" className="auth-logo-link" aria-label="PrepPilot home">
          <Logo style={{ height: 32, color: 'var(--text)' }} />
        </Link>

        <h1 className="auth-title">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth-sub">
          {isLogin
            ? 'Sign in to continue to your prep dashboard.'
            : 'Start your AI-powered placement journey.'}
        </p>

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={submitting}
              aria-required="true"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password
              {isLogin && (
                <span className="auth-forgot" aria-hidden="true">
                  {/* Forgot password — placeholder; wire up supabase.auth.resetPasswordForEmail in a follow-up */}
                </span>
              )}
            </label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder={isLogin ? '••••••••' : 'At least 6 characters'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              disabled={submitting}
              aria-required="true"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="cta-primary auth-submit"
            disabled={submitting}
          >
            {submitting
              ? (isLogin ? 'Signing in…' : 'Creating account…')
              : (isLogin ? 'Sign in'      : 'Create account')}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Link
            to={isLogin ? '/signup' : '/login'}
            className="auth-switch-link"
          >
            {isLogin ? 'Sign up free' : 'Sign in'}
          </Link>
        </p>
      </motion.div>

      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
    background: var(--bg);
  }
  .auth-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 400px;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .auth-logo-link {
    display: inline-flex;
    align-items: center;
    color: var(--text);
    text-decoration: none;
    margin-bottom: 4px;
  }
  .auth-title {
    font-family: var(--font-serif);
    font-size: 26px;
    font-weight: 800;
    color: var(--text);
    margin: 0;
    line-height: 1.2;
  }
  .auth-sub {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .auth-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .auth-input {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 14px;
    outline: none;
    transition: border-color var(--transition);
    width: 100%;
  }
  .auth-input::placeholder { color: var(--text-muted); }
  .auth-input:focus         { border-color: var(--border-focus); }
  .auth-input:disabled      { opacity: 0.6; cursor: not-allowed; }
  .auth-error {
    font-size: 13px;
    color: var(--danger);
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    line-height: 1.5;
  }
  .auth-submit {
    width: 100%;
    justify-content: center;
    margin-top: 4px;
  }
  .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
  .auth-switch {
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
  .auth-switch-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
    transition: color var(--transition);
  }
  .auth-switch-link:hover { color: var(--text); }
  .auth-confirm-icon {
    font-size: 48px;
    text-align: center;
  }
  @media (max-width: 480px) {
    .auth-card { padding: 28px 20px; }
  }
`;

import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

export default function NavBar({ breadcrumb }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link to="/" className="navbar-logo" aria-label="PrepPilot home">
            <Logo className="navbar-logo-img" />
          </Link>
          {breadcrumb && (
            <nav className="navbar-breadcrumb" aria-label="Breadcrumb">
              <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
              <span className="breadcrumb-sep" aria-hidden="true">/</span>
              <span className="breadcrumb-current">{breadcrumb}</span>
            </nav>
          )}
        </div>

        <div className="navbar-right">
          {!isLanding && (
            <button
              className="nav-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              aria-label="Go to dashboard"
            >
              Dashboard
            </button>
          )}
          {isLanding && (
            <button
              className="cta-primary cta-sm"
              onClick={() => navigate('/dashboard')}
              aria-label="Open app"
            >
              Open App
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          background: var(--glass-bg);
          border-bottom: 1px solid var(--border);
          transition: var(--transition-theme);
        }
        .navbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .navbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--text);
        }
        .navbar-logo-img { height: 28px; width: auto; color: inherit; }
        .navbar-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .breadcrumb-link {
          color: var(--text-secondary);
          text-decoration: none;
          transition: color var(--transition);
        }
        .breadcrumb-link:hover { color: var(--text); }
        .breadcrumb-sep { color: var(--border); }
        .breadcrumb-current {
          color: var(--text);
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-dashboard-btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: border-color var(--transition), color var(--transition);
        }
        .nav-dashboard-btn:hover {
          border-color: var(--text-secondary);
          color: var(--text);
        }
        .cta-sm {
          font-size: 13px !important;
          padding: 8px 18px !important;
        }
        @media (max-width: 640px) {
          .navbar-breadcrumb { display: none; }
          .nav-dashboard-btn { display: none; }
          .navbar-inner { padding: 0 16px; }
        }
      `}</style>
    </header>
  );
}

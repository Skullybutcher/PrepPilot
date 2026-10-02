import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light')
  );

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light');
      localStorage.setItem('pp-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('pp-theme', 'dark');
    }
    // Keep browser native UI (scrollbars, inputs) in sync
    document.body.style.colorScheme = isLight ? 'light' : 'dark';
  }, [isLight]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setIsLight((v) => !v)}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="theme-toggle-track">
        <span className={`theme-toggle-thumb ${isLight ? 'light' : 'dark'}`}>
          {isLight ? '☀️' : '🌙'}
        </span>
      </span>
      <style>{`
        .theme-toggle {
          background: none;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: border-color var(--transition);
        }
        .theme-toggle:hover { border-color: var(--text-secondary); }
        .theme-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .theme-toggle-track {
          width: 48px;
          height: 26px;
          border-radius: 999px;
          background: var(--surface-hover);
          display: flex;
          align-items: center;
          padding: 2px;
          position: relative;
        }
        .theme-toggle-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--bg-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .theme-toggle-thumb.light { transform: translateX(22px); }
        .theme-toggle-thumb.dark  { transform: translateX(0); }
      `}</style>
    </button>
  );
}

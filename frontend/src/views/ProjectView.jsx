import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '../components/NavBar';
import TodayView from './TodayView';
import BoardView from './BoardView';
import ProgressView from './ProgressView';
import PlanView from './PlanView';

const TABS = [
  { id: 'Today',    label: 'Today',    icon: '📋' },
  { id: 'Board',    label: 'Board',    icon: '📊' },
  { id: 'Progress', label: 'Progress', icon: '📈' },
  { id: 'Plan',     label: 'Plan',     icon: '🧠' },
];

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
};

export default function ProjectView() {
  const [tab, setTab] = useState('Today');

  // Keyboard shortcuts: 1-4 to switch tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TABS.length) setTab(TABS[idx - 1].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="project-view">
      <NavBar breadcrumb="Placement Prep" />

      {/* Desktop tab bar */}
      <div className="project-tabs" role="tablist" aria-label="Project sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`project-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
            {tab === t.id && (
              <motion.div
                className="tab-indicator"
                layoutId="tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main className="project-content" role="tabpanel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            style={{ width: '100%' }}
          >
            {tab === 'Today'    && <TodayView />}
            {tab === 'Board'    && <BoardView />}
            {tab === 'Progress' && <ProgressView />}
            {tab === 'Plan'     && <PlanView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav" aria-label="Navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`mobile-nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
          >
            <span className="mobile-nav-icon" aria-hidden="true">{t.icon}</span>
            <span className="mobile-nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        .project-view {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          padding-top: 60px; /* navbar height */
        }

        /* Desktop tab bar */
        .project-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 16px 40px 0;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
          position: sticky;
          top: 60px;
          z-index: 50;
        }
        .project-tab {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px 14px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          transition: color var(--transition);
          white-space: nowrap;
        }
        .project-tab.active { color: var(--text); }
        .project-tab:hover:not(.active) { color: var(--text); background: var(--surface); }
        .tab-icon { font-size: 15px; line-height: 1; }
        .tab-indicator {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent-gradient);
          border-radius: 2px 2px 0 0;
        }

        /* Content */
        .project-content {
          flex: 1;
          padding: 32px 40px;
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
        }

        /* Mobile bottom nav */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid var(--border);
          padding: 8px 0 env(safe-area-inset-bottom, 0);
          flex-direction: row;
        }
        .mobile-nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px 4px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: color var(--transition);
        }
        .mobile-nav-btn.active { color: var(--accent); }
        .mobile-nav-icon { font-size: 20px; line-height: 1; }
        .mobile-nav-label { font-size: 10px; }

        @media (max-width: 640px) {
          .project-tabs { display: none; }
          .mobile-bottom-nav { display: flex; }
          .project-content {
            padding: 20px 16px 80px; /* room for bottom nav */
          }
        }
        @media (max-width: 1024px) {
          .project-tabs { padding: 12px 16px 0; }
          .project-content { padding: 24px 16px; }
        }
      `}</style>
    </div>
  );
}

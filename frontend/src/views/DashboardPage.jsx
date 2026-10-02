import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import NavBar from '../components/NavBar';

// Mock plans — in production these would come from /api/plans
const MOCK_PLANS = [
  {
    id: 'default',
    name: 'Placement Prep 2026',
    description: '12-month SDE placement roadmap with Striver A2Z + Cloud + Projects',
    tracks: ['DSA', 'Cloud', 'Project', 'OpenSource', 'Fundamentals'],
    weekNumber: 5,
    totalWeeks: 52,
  },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function PlanCard({ plan, onClick }) {
  const progress = Math.round((plan.weekNumber / plan.totalWeeks) * 100);

  return (
    <motion.div
      className="plan-card glass"
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Open plan: ${plan.name}`}
    >
      <div className="plan-card-header">
        <div className="plan-card-icon" aria-hidden="true">🗺️</div>
        <div className="plan-card-week">Week {plan.weekNumber}</div>
      </div>
      <h3 className="plan-card-name">{plan.name}</h3>
      <p className="plan-card-desc">{plan.description}</p>

      {/* Tracks */}
      <div className="plan-card-tracks" aria-label="Tracks">
        {plan.tracks.slice(0, 4).map((t) => (
          <span key={t} className={`plan-track-pill track-${t.toLowerCase()}`}>{t}</span>
        ))}
        {plan.tracks.length > 4 && (
          <span className="plan-track-pill plan-track-more">+{plan.tracks.length - 4}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="plan-progress">
        <div className="plan-progress-row">
          <span className="plan-progress-label">Overall</span>
          <span className="plan-progress-pct">{progress}%</span>
        </div>
        <div className="plan-progress-track">
          <motion.div
            className="plan-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="empty-illustration" aria-hidden="true">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" stroke="var(--border)" strokeWidth="2" fill="none"/>
          <circle cx="60" cy="60" r="6" fill="var(--accent)" opacity="0.8"/>
          <line x1="60" y1="60" x2="60" y2="20" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="60" y1="60" x2="90" y2="70" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="60" cy="20" r="4" fill="var(--accent-gradient)" opacity="0.9"/>
          <text x="60" y="115" textAnchor="middle" fontSize="32">🧭</text>
        </svg>
      </div>
      <h2 className="empty-heading">Your journey starts here</h2>
      <p className="empty-sub">
        Create your first PrepPilot plan. Paste your roadmap or describe your goal
        — the AI planner builds a structured roadmap from the conversation.
      </p>
      <button className="cta-primary" onClick={onCreate}>
        Create Your First Plan
        <span aria-hidden="true"> →</span>
      </button>
    </motion.div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const plans = MOCK_PLANS; // swap with API call when multi-plan backend is ready

  return (
    <div className="dashboard-page">
      <NavBar />

      <div className="dashboard-content">
        <motion.div
          className="dashboard-header"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div>
            <h1 className="dashboard-title">Your Plans</h1>
            <p className="dashboard-sub">Pick up where you left off.</p>
          </div>
        </motion.div>

        {plans.length === 0 ? (
          <EmptyState onCreate={() => navigate('/plan/new')} />
        ) : (
          <motion.div
            className="plans-grid"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onClick={() => navigate(`/plan/${p.id}`)}
              />
            ))}
            {/* "Create new" ghost card */}
            <motion.button
              className="plan-card-new glass"
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => navigate('/plan/new')}
              aria-label="Create a new plan"
            >
              <span className="plan-new-icon" aria-hidden="true">+</span>
              <span className="plan-new-label">New Plan</span>
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* FAB for mobile */}
      <button
        className="fab"
        onClick={() => navigate('/plan/new')}
        aria-label="Create new plan"
      >
        <span aria-hidden="true">+</span>
      </button>

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          background: var(--bg);
          padding-top: 60px;
        }
        .dashboard-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 40px;
        }
        .dashboard-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .dashboard-title {
          font-family: var(--font-serif);
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 800;
          color: var(--text);
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .dashboard-sub {
          color: var(--text-secondary);
          font-size: 15px;
          margin: 0;
        }

        /* Grid */
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        /* Plan card */
        .plan-card {
          padding: 24px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }
        .plan-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .plan-card-icon { font-size: 24px; line-height: 1; }
        .plan-card-week {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: var(--surface);
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
        }
        .plan-card-name {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          line-height: 1.3;
        }
        .plan-card-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        /* Track pills */
        .plan-card-tracks {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .plan-track-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #fff;
        }
        .track-dsa          { background: var(--track-dsa); }
        .track-cloud        { background: var(--track-cloudcert); }
        .track-cloudcert    { background: var(--track-cloudcert); }
        .track-project      { background: var(--track-project); }
        .track-opensource   { background: var(--track-opensource); }
        .track-fundamentals { background: var(--track-fundamentals); }
        .track-systemdesign { background: var(--track-systemdesign); }
        .track-interviewprep{ background: var(--track-interviewprep); }
        .plan-track-more    { background: var(--surface-hover); color: var(--text-muted); border: 1px solid var(--border); }

        /* Progress */
        .plan-progress { display: flex; flex-direction: column; gap: 6px; }
        .plan-progress-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }
        .plan-progress-label { color: var(--text-muted); }
        .plan-progress-pct   { color: var(--text-secondary); font-weight: 600; }
        .plan-progress-track {
          height: 4px;
          background: var(--surface-hover);
          border-radius: 2px;
          overflow: hidden;
        }
        .plan-progress-fill {
          height: 100%;
          background: var(--accent-gradient);
          border-radius: 2px;
        }

        /* New plan ghost card */
        .plan-card-new {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          border: 1px dashed var(--border) !important;
          background: transparent !important;
          min-height: 180px;
          transition: border-color var(--transition), color var(--transition);
          font-family: var(--font-sans);
          color: var(--text-muted);
        }
        .plan-card-new:hover {
          border-color: var(--accent) !important;
          color: var(--accent);
        }
        .plan-new-icon { font-size: 32px; font-weight: 300; line-height: 1; }
        .plan-new-label { font-size: 14px; font-weight: 600; }

        /* FAB */
        .fab {
          display: none;
          position: fixed;
          bottom: 88px;
          right: 20px;
          z-index: 60;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent-gradient);
          color: #fff;
          font-size: 24px;
          border: none;
          cursor: pointer;
          box-shadow: var(--accent-glow);
          transition: transform 0.15s ease, box-shadow 0.2s ease;
          align-items: center;
          justify-content: center;
        }
        .fab:hover {
          transform: scale(1.08);
          box-shadow: var(--accent-glow-lg);
        }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 80px 24px;
          text-align: center;
          max-width: 480px;
          margin: 0 auto;
        }
        .empty-illustration { opacity: 0.7; }
        .empty-heading {
          font-family: var(--font-serif);
          font-size: 32px;
          font-weight: 800;
          color: var(--text);
          margin: 0;
        }
        .empty-sub {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
        }

        @media (max-width: 640px) {
          .dashboard-content { padding: 32px 16px; }
          .plans-grid { grid-template-columns: 1fr; }
          .fab { display: flex; }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          .dashboard-content { padding: 40px 24px; }
          .plans-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}

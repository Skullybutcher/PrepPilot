import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getProgress } from '../api';

/* ---- Streak heatmap: last 12 weeks × 7 days ---- */
function StreakHeatmap({ streak }) {
  const WEEKS = 12;
  const today = new Date();
  // Build array of 84 days from oldest → newest
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (WEEKS * 7 - 1 - i));
    const withinStreak = i >= (WEEKS * 7 - streak);
    return { date: d.toISOString().slice(0, 10), active: withinStreak };
  });

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="heatmap-wrap" aria-label={`Streak heatmap — ${streak} day streak`}>
      <div className="heatmap-day-labels" aria-hidden="true">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="heatmap-day-label">{d}</span>
        ))}
      </div>
      <div className="heatmap-grid">
        {days.map((d) => (
          <div
            key={d.date}
            className={`heatmap-cell ${d.active ? 'heatmap-active' : ''}`}
            title={d.date}
            aria-label={d.active ? `${d.date}: active` : d.date}
          />
        ))}
      </div>
      <style>{`
        .heatmap-wrap { margin-top: 12px; }
        .heatmap-day-labels {
          display: grid;
          grid-template-columns: repeat(7, 14px);
          gap: 3px;
          margin-bottom: 4px;
        }
        .heatmap-day-label {
          font-size: 9px;
          color: var(--text-muted);
          text-align: center;
        }
        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(7, 14px);
          grid-auto-rows: 14px;
          gap: 3px;
        }
        .heatmap-cell {
          width: 14px; height: 14px;
          border-radius: 3px;
          background: var(--surface-hover);
          transition: background 0.2s ease;
        }
        .heatmap-active {
          background: var(--accent);
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}

/* ---- Animated radial donut ---- */
function DonutChart({ percent }) {
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;

  return (
    <div className="donut-wrap" aria-label={`${percent}% DSA complete`}>
      <svg width="128" height="128" viewBox="0 0 128 128" fill="none" aria-hidden="true">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} stroke="var(--surface-hover)" strokeWidth="10" />
        {/* Fill — animated via stroke-dashoffset */}
        <motion.circle
          cx={cx} cy={cy} r={r}
          stroke="url(#donut-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <defs>
          <linearGradient id="donut-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="donut-label">
        <span className="donut-pct">{percent}%</span>
        <span className="donut-sub">DSA</span>
      </div>
      <style>{`
        .donut-wrap { position: relative; display: inline-flex; }
        .donut-label {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
        }
        .donut-pct {
          font-family: var(--font-serif);
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
        }
        .donut-sub {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
      `}</style>
    </div>
  );
}

function SkeletonProgress() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 40 }} />
      {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 36 }} />)}
    </div>
  );
}

const STATUS_COLORS = {
  'on-pace': 'var(--success)',
  'behind':  'var(--danger)',
  'ahead':   'var(--accent)',
};
const STATUS_BG = {
  'on-pace': 'rgba(34,197,94,0.1)',
  'behind':  'rgba(239,68,68,0.1)',
  'ahead':   'rgba(99,102,241,0.1)',
};

export default function ProgressView() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgress()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonProgress />;
  if (error)   return <p className="status error">Error: {error}</p>;

  const { dsa, streak = 0, tracks = [] } = data;

  return (
    <div className="progress-view">
      {/* ---- Top row: donut + streak ---- */}
      <div className="progress-top-row">
        <div className="progress-donut-section">
          <DonutChart percent={dsa.percent} />
          <div className="progress-dsa-meta">
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              DSA Progress
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              {dsa.done} / {dsa.total} problems
            </p>
            <div className="progress-bar-outer" style={{ marginBottom: 0, marginTop: 8 }}>
              <div className="progress-bar-inner" style={{ width: `${dsa.percent}%` }} />
            </div>
          </div>
        </div>

        {/* Streak badge + heatmap */}
        <div className="streak-section">
          <div className="streak-badge" aria-label={`${streak} day streak`}>
            <span style={{ fontSize: 20 }} aria-hidden="true">🔥</span>
            <div>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                {streak}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                day streak
              </div>
            </div>
          </div>
          <StreakHeatmap streak={streak} />
        </div>
      </div>

      {/* ---- Step-by-step bars ---- */}
      <section style={{ marginTop: 36 }}>
        <h3 className="section-label">Steps</h3>
        <div className="step-list">
          {dsa.byStep.map((step) => {
            const pct = step.total ? Math.round((step.done / step.total) * 100) : 0;
            return (
              <div key={step.stepId} className="step-row">
                <div className="step-row-top">
                  <span className="step-name">{step.stepId}. {step.stepName}</span>
                  <span className="step-count">{step.done}/{step.total}</span>
                </div>
                <div className="step-bar-outer">
                  <motion.div
                    className="step-bar-inner"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.05 * step.stepId }}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Active quarter tracks ---- */}
      {tracks.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h3 className="section-label">Current Quarter Tracks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tracks.map((track) => (
              <motion.div
                key={track.name}
                className="track-row glass"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className={`track-badge track-${track.name.toLowerCase()}`}>{track.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{track.weeklyHours}h / week</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{track.focus}</span>
                </div>
                <span
                  className="track-status-pill"
                  style={{
                    background: STATUS_BG[track.status] || STATUS_BG['on-pace'],
                    color: STATUS_COLORS[track.status] || STATUS_COLORS['on-pace'],
                  }}
                >
                  {track.status === 'on-pace' ? 'On Pace' : track.status === 'behind' ? 'Behind' : 'Ahead'}
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .progress-view { display: flex; flex-direction: column; }
        .progress-top-row {
          display: flex;
          gap: 32px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .progress-donut-section {
          display: flex;
          align-items: center;
          gap: 20px;
          flex: 1;
          min-width: 220px;
        }
        .progress-dsa-meta { flex: 1; }
        .streak-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .streak-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: var(--radius);
        }
        .section-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0 0 14px;
        }
        .track-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
        }
        .track-status-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

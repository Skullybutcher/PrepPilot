import { useEffect, useState } from 'react';
import { getProgress } from '../api';

export default function ProgressView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgress()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton"></div>;
  if (error) return <p className="status error">Error: {error}</p>;

  const { dsa, streak, tracks } = data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: '#f3f4f6' }}>Progress Overview</h2>
        <div style={{ background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
          🔥 {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
        </div>
      </div>

      <div className="progress-header">
        <h2>DSA Progress</h2>
        <span className="progress-overall">
          {dsa.done} / {dsa.total} ({dsa.percent}%)
        </span>
      </div>

      <div className="progress-bar-outer">
        <div
          className="progress-bar-inner"
          style={{ width: `${dsa.percent}%` }}
        />
      </div>

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
                <div className="step-bar-inner" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {tracks && tracks.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Current Quarter Tracks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tracks.map(track => (
              <div key={track.name} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500, color: '#d4d4d8' }}>{track.name}</span>
                    <span style={{ fontSize: 12, color: '#71717a' }}>{track.weeklyHours}h / wk</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>{track.focus}</span>
                </div>
                <div>
                  <span style={{ 
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                    background: track.status === 'on-pace' ? 'rgba(22, 163, 74, 0.2)' : track.status === 'behind' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(37, 99, 235, 0.2)',
                    color: track.status === 'on-pace' ? '#4ade80' : track.status === 'behind' ? '#f87171' : '#60a5fa',
                  }}>
                    {track.status === 'on-pace' ? 'On Pace' : track.status === 'behind' ? 'Behind' : 'Ahead'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
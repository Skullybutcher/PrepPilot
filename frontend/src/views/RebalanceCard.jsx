import { useEffect, useState } from 'react';
import { getLatestRebalance, approveRebalance } from '../api';

export default function RebalanceCard() {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    getLatestRebalance()
      .then(setSuggestion)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !suggestion || hidden) return null;

  const handleApprove = async () => {
    try {
      await approveRebalance();
      setHidden(true);
    } catch (err) {
      console.error('Failed to approve rebalance:', err);
    }
  };

  return (
    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#fcd34d', fontSize: 16 }}>Rebalance Suggestion</h3>
          <p style={{ margin: 0, color: '#fde68a', fontSize: 12, marginTop: 4 }}>Week {suggestion.week_number} • {suggestion.date}</p>
        </div>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, color: '#fef3c7', fontSize: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(suggestion.options || []).map((opt, i) => (
          <li key={i}>
            <strong>{opt.track}</strong>: {opt.change} — <span style={{ opacity: 0.8 }}>{opt.rationale}</span>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleApprove} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          ✓ Approve
        </button>
        <button onClick={() => setHidden(true)} style={{ background: 'transparent', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          ✗ Dismiss
        </button>
      </div>
    </div>
  );
}

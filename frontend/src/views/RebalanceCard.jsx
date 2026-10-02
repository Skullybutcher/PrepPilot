import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLatestRebalance, approveRebalance } from '../api';
import { useToast } from '../components/ToastProvider';

export default function RebalanceCard() {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [hidden, setHidden]         = useState(false);
  const toast = useToast();

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
      toast('Rebalance approved', 'success');
    } catch (err) {
      toast(err?.message || 'Failed to approve', 'error');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="rebalance-card"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        role="alert"
        aria-label="Weekly rebalance suggestion"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--warning)', fontSize: 15, fontWeight: 700 }}>
              ⚡ Rebalance Suggestion
            </h3>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
              Week {suggestion.weekNumber ?? suggestion.week_number} · {suggestion.date}
            </p>
          </div>
        </div>

        <ul style={{ margin: '0 0 14px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(suggestion.options || []).map((opt, i) => (
            <li key={i} style={{ fontSize: 14, color: 'var(--text)' }}>
              <strong style={{ color: 'var(--warning)' }}>{opt.track}</strong>:{' '}
              {opt.change}
              {opt.rationale && (
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}> — {opt.rationale}</span>
              )}
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleApprove}
            style={{
              background: 'var(--warning)', color: '#000', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontSize: 13, cursor: 'pointer', fontWeight: 700,
              fontFamily: 'var(--font-sans)',
            }}
            aria-label="Approve rebalance suggestion"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setHidden(true)}
            style={{
              background: 'transparent', color: 'var(--warning)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
            aria-label="Dismiss rebalance suggestion"
          >
            ✗ Dismiss
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

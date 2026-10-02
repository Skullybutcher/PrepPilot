import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getBoard, transitionTodo } from '../api';
import { useToast } from '../components/ToastProvider';

const COLUMNS = ['To Do', 'In Progress', 'Done'];

const COLUMN_COLORS = {
  'To Do':       'var(--text-muted)',
  'In Progress': 'var(--warning)',
  'Done':        'var(--success)',
};

function SkeletonBoard() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 24, width: '60%' }} />
          {[1, 2].map((j) => <div key={j} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ))}
    </div>
  );
}

export default function BoardView() {
  const [data, setData]         = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [dragKey, setDragKey]   = useState(null);
  const [dragFromCol, setDragFromCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    getBoard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleDrop = async (column) => {
    setDragOverCol(null);
    if (!dragKey || column === dragFromCol) { setDragKey(null); setDragFromCol(null); return; }
    const key = dragKey, fromCol = dragFromCol;
    setDragKey(null); setDragFromCol(null);

    const item = data[fromCol]?.find((i) => i.key === key);
    if (!item) return;

    setData((prev) => ({
      ...prev,
      [fromCol]: prev[fromCol].filter((i) => i.key !== key),
      [column]:  [...(prev[column] || []), item],
    }));

    try {
      await transitionTodo(key, column);
    } catch (err) {
      toast(err.message || 'Failed to move card', 'error');
      setData((prev) => ({
        ...prev,
        [column]:  prev[column].filter((i) => i.key !== key),
        [fromCol]: [...(prev[fromCol] || []), item],
      }));
    }
  };

  if (loading) return <SkeletonBoard />;
  if (error)   return <p className="status error">Error: {error}</p>;

  return (
    <div>
      <div className="view-header">
        <h2>Board</h2>
        <button className="refresh-btn" onClick={load} aria-label="Refresh board">↻ Refresh</button>
      </div>

      {/* Desktop kanban */}
      <div className="board" role="region" aria-label="Kanban board">
        {COLUMNS.map((col) => (
          <div
            key={col}
            className={`board-column ${dragOverCol === col ? `board-column-dragover col-${col.replace(/\s/g, '-').toLowerCase()}` : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }}
            onDrop={() => handleDrop(col)}
          >
            <h3 className="board-column-title" style={{ color: COLUMN_COLORS[col] }}>
              {col}
              <span className="board-count">{data[col]?.length || 0}</span>
            </h3>

            <div className="board-cards">
              {(data[col] || []).map((item) => (
                <motion.div
                  key={item.key}
                  className={`board-card ${dragKey === item.key ? 'board-card-dragging' : ''}`}
                  draggable
                  onDragStart={() => { setDragKey(item.key); setDragFromCol(col); }}
                  onDragEnd={() => { setDragKey(null); setDragFromCol(null); setDragOverCol(null); }}
                  whileHover={dragKey ? {} : {
                    y: -4,
                    boxShadow: `0 12px 32px rgba(99,102,241,0.2)`,
                    transition: { duration: 0.15 },
                  }}
                  layout
                >
                  <span className="board-card-key">{item.key}</span>
                  <p className="board-card-summary">{item.summary}</p>
                </motion.div>
              ))}
              {(data[col] || []).length === 0 && (
                <p className="board-empty">Drop cards here</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile accordion (< 640px) */}
      <div className="board-accordion" role="region" aria-label="Board accordion">
        {COLUMNS.map((col) => (
          <MobileColumn
            key={col}
            col={col}
            items={data[col] || []}
            color={COLUMN_COLORS[col]}
          />
        ))}
      </div>

      <style>{`
        .board-accordion { display: none; flex-direction: column; gap: 8px; }
        @media (max-width: 640px) {
          .board { display: none; }
          .board-accordion { display: flex; }
        }
      `}</style>
    </div>
  );
}

function MobileColumn({ col, items, color }) {
  const [open, setOpen] = useState(col === 'In Progress');
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--surface)', border: 'none',
          color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span style={{ color }}>{col}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {items.length} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {items.length === 0 && <p className="board-empty">Nothing here</p>}
          {items.map((item) => (
            <div key={item.key} className="board-card">
              <span className="board-card-key">{item.key}</span>
              <p className="board-card-summary">{item.summary}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

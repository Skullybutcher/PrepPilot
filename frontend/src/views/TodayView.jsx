import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodayTodos, transitionTodo } from '../api';
import { useToast } from '../components/ToastProvider';
import RebalanceCard from './RebalanceCard';

const listVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: 52 }} />
      ))}
    </div>
  );
}

export default function TodayView() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [bouncing, setBouncing] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    getTodayTodos()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const markDone = async (key) => {
    const prevStatus = data.todos.find((t) => t.key === key)?.status;
    setBouncing(key);
    setTimeout(() => setBouncing(null), 400);

    setData((prev) => ({
      ...prev,
      todos: prev.todos.map((t) => (t.key === key ? { ...t, status: 'Done' } : t)),
    }));

    try {
      await transitionTodo(key, 'Done');
      toast('Task marked done!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update task', 'error');
      setData((prev) => ({
        ...prev,
        todos: prev.todos.map((t) => (t.key === key ? { ...t, status: prevStatus } : t)),
      }));
    }
  };

  if (loading) return <SkeletonList />;
  if (error)   return <p className="status error">Error: {error}</p>;

  if (!data?.todos?.length) {
    return (
      <motion.div
        className="empty-today"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🎉</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: '0 0 8px', fontSize: 22 }}>
          All caught up for today
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          No todos for {data?.date}. Check back tomorrow.
        </p>
        <style>{`
          .empty-today { text-align: center; padding: 64px 24px; }
        `}</style>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="view-header">
        <h2>Today — {data.date}</h2>
        <button className="refresh-btn" onClick={load} aria-label="Refresh todos">↻ Refresh</button>
      </div>

      <RebalanceCard />

      <motion.ul
        className="todo-list"
        initial="hidden"
        animate="show"
        variants={listVariants}
        aria-label="Today's tasks"
      >
        <AnimatePresence>
          {data.todos.map((todo) => (
            <motion.li
              key={todo.key}
              className="todo-item"
              variants={itemVariants}
              layout
            >
              <motion.span
                className={`track-badge track-${todo.track?.toLowerCase()}`}
                aria-label={`Track: ${todo.track}`}
              >
                {todo.track}
              </motion.span>

              <span className="todo-summary">{todo.summary}</span>

              <span
                className={`status-badge status-${todo.status?.replace(/\s/g, '-').toLowerCase()}`}
                aria-label={`Status: ${todo.status}`}
              >
                {todo.status}
              </span>

              {todo.status !== 'Done' && (
                <motion.button
                  className="done-btn"
                  onClick={() => markDone(todo.key)}
                  animate={bouncing === todo.key ? { scale: [1, 1.3, 0.9, 1] } : {}}
                  transition={{ duration: 0.35 }}
                  aria-label={`Mark ${todo.summary} as done`}
                >
                  ✓ Done
                </motion.button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

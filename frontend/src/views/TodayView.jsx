// frontend/src/views/TodayView.jsx
import { useEffect, useState, useCallback } from 'react';
import { getTodayTodos, transitionTodo } from '../api';

export default function TodayView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getTodayTodos().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(id);
  }, [load]);

  const markDone = async (key) => {
    const prevStatus = data.todos.find((t) => t.key === key)?.status;

    // Optimistic: reflect it immediately, don't wait on the server
    setData((prev) => ({
      ...prev,
      todos: prev.todos.map((t) => (t.key === key ? { ...t, status: 'Done' } : t)),
    }));

    try {
      await transitionTodo(key, 'Done');
    } catch (err) {
      setError(err.message);
      // roll back on failure
      setData((prev) => ({
        ...prev,
        todos: prev.todos.map((t) => (t.key === key ? { ...t, status: prevStatus } : t)),
      }));
    }
  };

  if (loading) return <p className="status">Loading today's tasks...</p>;
  if (error) return <p className="status error">Error: {error}</p>;
  if (!data.todos.length) return <p className="status">No todos for {data.date} yet.</p>;

  return (
    <div>
      <div className="view-header">
        <h2>Today — {data.date}</h2>
        <button className="refresh-btn" onClick={load}>Refresh</button>
      </div>
      <ul className="todo-list">
        {data.todos.map((todo) => (
          <li key={todo.key} className="todo-item">
            <span className={`track-badge track-${todo.track.toLowerCase()}`}>{todo.track}</span>
            <span className="todo-summary">{todo.summary}</span>
            <span className={`status-badge status-${todo.status.replace(/\s/g, '-').toLowerCase()}`}>{todo.status}</span>
            {todo.status !== 'Done' && (
              <button className="done-btn" onClick={() => markDone(todo.key)}>✓ Done</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
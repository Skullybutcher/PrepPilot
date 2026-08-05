import { useEffect, useState } from 'react';
import { getTodayTodos } from '../api';

export default function TodayView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodayTodos()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="status">Loading today's tasks...</p>;
  if (error) return <p className="status error">Error: {error}</p>;
  if (!data.todos.length) return <p className="status">No todos for {data.date} yet. Run `npm run generate:today` in the backend.</p>;

  return (
    <div>
      <h2>Today — {data.date}</h2>
      <ul className="todo-list">
        {data.todos.map((todo) => (
          <li key={todo.key} className="todo-item">
            <span className={`track-badge track-${todo.track.toLowerCase()}`}>{todo.track}</span>
            <span className="todo-summary">{todo.summary}</span>
            <span className={`status-badge status-${todo.status.replace(/\s/g, '-').toLowerCase()}`}>
              {todo.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { getBoard } from '../api';

const COLUMNS = ['To Do', 'In Progress', 'Done'];

export default function BoardView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBoard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="status">Loading board...</p>;
  if (error) return <p className="status error">Error: {error}</p>;

  return (
    <div className="board">
      {COLUMNS.map((col) => (
        <div key={col} className="board-column">
          <h3 className="board-column-title">
            {col} <span className="board-count">{data[col]?.length || 0}</span>
          </h3>
          <div className="board-cards">
            {(data[col] || []).map((item) => (
              <div key={item.key} className="board-card">
                <span className="board-card-key">{item.key}</span>
                <p className="board-card-summary">{item.summary}</p>
              </div>
            ))}
            {(data[col] || []).length === 0 && (
              <p className="board-empty">Nothing here</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
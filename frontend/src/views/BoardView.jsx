// frontend/src/views/BoardView.jsx
import { useEffect, useState, useCallback } from 'react';
import { getBoard, transitionTodo } from '../api';

const COLUMNS = ['To Do', 'In Progress', 'Done'];

export default function BoardView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragKey, setDragKey] = useState(null);
  const [dragFromCol, setDragFromCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const load = useCallback(() => {
    getBoard().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleDrop = async (column) => {
  setDragOverCol(null);
  if (!dragKey || column === dragFromCol) {
    setDragKey(null);
    setDragFromCol(null);
    return;
  }
  const key = dragKey;
  const fromCol = dragFromCol;
  setDragKey(null);
  setDragFromCol(null);

  const item = data[fromCol]?.find((i) => i.key === key);
    if (!item) return;

    // Optimistic: move it in local state immediately, don't wait on the server
    setData((prev) => ({
      ...prev,
      [fromCol]: prev[fromCol].filter((i) => i.key !== key),
      [column]: [...(prev[column] || []), item],
    }));

    try {
      await transitionTodo(key, column);
      // success — state already reflects it, nothing more to do
    } catch (err) {
      setError(err.message);
      // roll back: put the card back where it came from
      setData((prev) => ({
        ...prev,
        [column]: prev[column].filter((i) => i.key !== key),
        [fromCol]: [...(prev[fromCol] || []), item],
      }));
    }
  };

  if (loading) return <div className="skeleton"></div>;
  if (error) return <p className="status error">Error: {error}</p>;

  return (
    <div>
      <div className="view-header">
        <button className="refresh-btn" onClick={load}>Refresh</button>
      </div>
      <div className="board">
        {COLUMNS.map((col) => (
          <div
            key={col}
            className={`board-column ${dragOverCol === col ? `board-column-dragover col-${col.replace(/\s/g, '-').toLowerCase()}` : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverCol !== col) setDragOverCol(col);
            }}
            onDragLeave={(e) => {
              // only clear if we're actually leaving the column, not entering a child
              if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
            }}
            onDrop={() => handleDrop(col)}
          >
            <h3 className="board-column-title">
              {col} <span className="board-count">{data[col]?.length || 0}</span>
            </h3>
            <div className="board-cards">
              {(data[col] || []).map((item) => (
                <div
                  key={item.key}
                  className={`board-card ${dragKey === item.key ? 'board-card-dragging' : ''}`}
                  draggable
                  onDragStart={() => { setDragKey(item.key); setDragFromCol(col); }}
                  onDragEnd={() => { setDragKey(null); setDragFromCol(null); setDragOverCol(null); }}
                >
                  <span className="board-card-key">{item.key}</span>
                  <p className="board-card-summary">{item.summary}</p>
                </div>
              ))}
              {(data[col] || []).length === 0 && <p className="board-empty">Nothing here</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
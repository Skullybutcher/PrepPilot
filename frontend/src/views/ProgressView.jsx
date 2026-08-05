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

  if (loading) return <p className="status">Loading progress...</p>;
  if (error) return <p className="status error">Error: {error}</p>;

  const { dsa } = data;

  return (
    <div>
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
    </div>
  );
}
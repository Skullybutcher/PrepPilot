import { useState } from 'react';
import TodayView from './views/TodayView';
import BoardView from './views/BoardView';
import ProgressView from './views/ProgressView';
import PlanView from './views/PlanView';
import './App.css';

const TABS = ['Today', 'Board', 'Progress', 'Plan'];

export default function App() {
  const [tab, setTab] = useState('Today');

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={tab === t ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'Today' && <TodayView />}
        {tab === 'Board' && <BoardView />}
        {tab === 'Progress' && <ProgressView />}
        {tab === 'Plan' && <PlanView />}
      </main>
    </div>
  );
}
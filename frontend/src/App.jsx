import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './components/ToastProvider';
import LandingPage from './views/LandingPage';
import DashboardPage from './views/DashboardPage';
import ProjectView from './views/ProjectView';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AnimatePresence mode="wait" initial={false}>
          <Routes>
            <Route path="/"           element={<LandingPage />} />
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/plan/new"   element={<ProjectView />} />
            <Route path="/plan/:id"   element={<ProjectView />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </ToastProvider>
    </BrowserRouter>
  );
}

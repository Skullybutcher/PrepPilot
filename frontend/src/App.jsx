import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './views/LandingPage';
import AuthPage from './views/AuthPage';
import DashboardPage from './views/DashboardPage';
import ProjectView from './views/ProjectView';
import JiraSetupModal from './views/JiraSetupModal';
import './App.css';

/**
 * AppShell — lives inside AuthProvider so it can read auth state.
 * Manages the post-signup Jira onboarding modal.
 *
 * The JiraSetupModal is triggered by AuthPage (signup) via the
 * `showJiraSetup` state here, passed down through location.state.
 * We keep the modal at the top level so it overlays any page.
 */
function AppShell() {
  // showJiraSetup is set to true by the signup flow via a custom event
  const [showJiraSetup, setShowJiraSetup] = useState(false);

  // Listen for the custom "jira-setup-needed" event fired from AuthPage after signup
  useState(() => {
    const handler = () => setShowJiraSetup(true);
    window.addEventListener('pp:jira-setup-needed', handler);
    return () => window.removeEventListener('pp:jira-setup-needed', handler);
  });

  return (
    <>
      {showJiraSetup && (
        <JiraSetupModal
          onDone={() => setShowJiraSetup(false)}
          onSkip={() => setShowJiraSetup(false)}
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <Routes>
          {/* Public */}
          <Route path="/"       element={<LandingPage />} />
          <Route path="/login"  element={<AuthPage mode="login"  />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan/new"
            element={
              <ProtectedRoute>
                <ProjectView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan/:id"
            element={
              <ProtectedRoute>
                <ProjectView />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

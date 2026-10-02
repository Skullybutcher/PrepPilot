import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveJiraConfig } from '../api';

/**
 * JiraSetupModal
 *
 * Shown after a user signs up (or when they visit Settings and their Jira
 * config is missing). Collects the four Jira credentials, sends them to
 * POST /api/user/jira-config (Phase D backend), and calls onDone() on success.
 *
 * Props:
 *   onDone()   — called on successful save or skip
 *   onSkip()   — alias for onDone (user can configure Jira later)
 */
export default function JiraSetupModal({ onDone, onSkip }) {
  const [form, setForm] = useState({
    jiraBaseUrl:    '',
    jiraEmail:      '',
    jiraApiToken:   '',
    jiraProjectKey: '',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const set = (key) => (e) => {
    setForm((v) => ({ ...v, [key]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey } = form;
    if (!jiraBaseUrl.trim() || !jiraEmail.trim() || !jiraApiToken.trim() || !jiraProjectKey.trim()) {
      setError('All four fields are required.');
      return;
    }

    setSaving(true);
    try {
      await saveJiraConfig(form);
      setSuccess(true);
      setTimeout(onDone, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="jira-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jira-modal-title"
      >
        <motion.div
          className="jira-modal-box glass"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {success ? (
            <motion.div
              className="jira-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="jira-success-icon" aria-hidden="true">✅</span>
              <p className="jira-success-msg">Jira connected successfully!</p>
            </motion.div>
          ) : (
            <>
              <div className="jira-modal-header">
                <div className="jira-modal-icon" aria-hidden="true">🔗</div>
                <div>
                  <h2 id="jira-modal-title" className="jira-modal-title">
                    Connect your Jira
                  </h2>
                  <p className="jira-modal-sub">
                    PrepPilot syncs todos directly to Jira subtasks. You'll need
                    an Atlassian API token to get started.
                  </p>
                </div>
              </div>

              {/* Help text */}
              <div className="jira-help glass">
                <p className="jira-help-title">Where to find these:</p>
                <ol className="jira-help-list">
                  <li><strong>Jira Base URL</strong> — your Atlassian domain, e.g. <code>https://yourorg.atlassian.net</code></li>
                  <li><strong>Email</strong> — the email you use to log into Jira</li>
                  <li><strong>API Token</strong> — go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="jira-help-link">Atlassian Account → Security → API tokens</a> → Create API token</li>
                  <li><strong>Project Key</strong> — the short code for your Jira project, e.g. <code>PREP</code></li>
                </ol>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {[
                  { key: 'jiraBaseUrl',    label: 'Jira Base URL',  placeholder: 'https://yourorg.atlassian.net', type: 'url'  },
                  { key: 'jiraEmail',      label: 'Jira Email',     placeholder: 'you@example.com',               type: 'email'},
                  { key: 'jiraApiToken',   label: 'API Token',      placeholder: 'Your Atlassian API token',      type: 'password'},
                  { key: 'jiraProjectKey', label: 'Project Key',    placeholder: 'e.g. PREP',                     type: 'text' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key} className="jira-field">
                    <label className="jira-label" htmlFor={`jira-${key}`}>{label}</label>
                    <input
                      id={`jira-${key}`}
                      className="jira-input"
                      type={type}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={set(key)}
                      disabled={saving}
                      aria-required="true"
                      autoComplete="off"
                    />
                  </div>
                ))}

                {error && (
                  <div className="jira-error" role="alert">{error}</div>
                )}

                <div className="jira-actions">
                  <button
                    type="submit"
                    className="cta-primary jira-submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Jira Config'}
                  </button>
                  <button
                    type="button"
                    className="jira-skip"
                    onClick={onSkip}
                    disabled={saving}
                  >
                    Skip for now — I'll add it in Settings
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

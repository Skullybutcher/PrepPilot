import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { planChat, planApply } from '../api';
import { useToast } from '../components/ToastProvider';
import PlanSetupModal from '../components/PlanSetupModal';

export default function PlanView() {
  const [messages, setMessages]           = useState([]);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [sending, setSending]             = useState(false);
  const [input, setInput]                 = useState('');
  // showModal: true until user submits context or clicks Skip
  const [showModal, setShowModal]         = useState(true);
  const endRef = useRef(null);
  const toast  = useToast();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingConfig, sending]);

  /**
   * Send a message.  `content` defaults to the controlled input value,
   * but can be supplied directly (used by handleModalStart to inject the
   * hidden context message without touching the visible input).
   */
  const sendMessage = async (content) => {
    const text = (content ?? input).trim();
    if (!text || sending) return;

    const userMsg     = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (content === undefined) setInput(''); // only clear controlled input for manual sends
    setSending(true);

    try {
      const { reply, proposedConfig } = await planChat(newMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (proposedConfig) setPendingConfig(proposedConfig);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || 'Failed to get response'}` },
      ]);
      toast(err.message || 'Plan chat failed', 'error');
    } finally {
      setSending(false);
    }
  };

  /** Called when the user submits the setup modal. */
  const handleModalStart = (contextMsg) => {
    setShowModal(false);
    // Fire immediately — no need to await, sendMessage handles its own state
    sendMessage(contextMsg);
  };

  /** Called when the user clicks "Skip" in the modal. */
  const handleModalSkip = () => {
    setShowModal(false);
  };

  const handleApply = async () => {
    if (!pendingConfig) return;
    try {
      await planApply(pendingConfig);
      setPendingConfig(null);
      toast('Config saved successfully', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save config', 'error');
    }
  };

  return (
    <>
      {/* Context setup modal — shown once on first open */}
      {showModal && (
        <PlanSetupModal
          onStart={handleModalStart}
          onSkip={handleModalSkip}
        />
      )}

      <div className="plan-view">
        <div className="view-header" style={{ marginBottom: 12 }}>
          <div>
            <h2>Plan Builder</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              Describe changes or paste your roadmap — the AI will propose a structured config.
            </p>
          </div>
        </div>

        {/* Message area */}
        <div className="chat-messages" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && !sending && (
            <div className="chat-empty">
              <span aria-hidden="true" style={{ fontSize: 36 }}>🧠</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '8px 0 0' }}>
                Describe what you want — "add a system design track from week 14" or paste a
                full roadmap.
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                className={`chat-row chat-row-${m.role}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div
                  className={`chat-bubble ${
                    m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {sending && (
            <motion.div
              className="chat-row chat-row-assistant"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="chat-bubble chat-bubble-assistant chat-typing">
                <span /><span /><span />
              </div>
            </motion.div>
          )}

          {/* Proposed config block */}
          {pendingConfig && (
            <motion.div
              className="chat-row chat-row-assistant"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="chat-proposal">
                <div className="chat-proposal-label">Proposed config</div>
                <pre className="chat-proposal-code">
                  {JSON.stringify(pendingConfig, null, 2)}
                </pre>
                <div className="chat-proposal-actions">
                  <button
                    className="done-btn"
                    onClick={handleApply}
                    aria-label="Apply proposed config"
                  >
                    ✓ Apply Changes
                  </button>
                  <button
                    className="refresh-btn"
                    onClick={() => setPendingConfig(null)}
                    aria-label="Discard proposal"
                  >
                    ✗ Discard
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input — pinned to bottom on mobile */}
        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask the planner…"
            disabled={sending}
            aria-label="Message input"
          />
          <button
            className="done-btn"
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            style={{ padding: '0 20px', minHeight: 44, flexShrink: 0 }}
            aria-label="Send message"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>

        <style>{`
          .plan-view {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 180px);
            min-height: 400px;
          }
          .chat-messages {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            margin-bottom: 12px;
          }
          .chat-empty {
            margin: auto;
            text-align: center;
            padding: 40px 0;
          }
          .chat-row {
            display: flex;
            max-width: 85%;
          }
          .chat-row-user      { align-self: flex-end; margin-left: auto; }
          .chat-row-assistant { align-self: flex-start; }
          .chat-bubble {
            padding: 10px 14px;
            font-size: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .chat-bubble-user {
            background: var(--accent);
            color: #fff;
            border-radius: var(--radius) var(--radius) 2px var(--radius);
          }
          .chat-bubble-assistant {
            background: var(--bg-elevated);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: var(--radius) var(--radius) var(--radius) 2px;
          }
          .chat-typing {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 14px 18px;
          }
          .chat-typing span {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--text-muted);
            animation: typing-bounce 1.2s ease-in-out infinite;
          }
          .chat-typing span:nth-child(2) { animation-delay: 0.2s; }
          .chat-typing span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30%            { transform: translateY(-6px); opacity: 1; }
          }
          .chat-proposal {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px;
            width: 100%;
            max-width: 560px;
          }
          .chat-proposal-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin-bottom: 10px;
          }
          .chat-proposal-code {
            margin: 0 0 14px;
            font-size: 12px;
            color: var(--text-secondary);
            overflow-x: auto;
            white-space: pre;
            background: var(--surface);
            padding: 10px 12px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            max-height: 240px;
            overflow-y: auto;
          }
          .chat-proposal-actions { display: flex; gap: 8px; }
          .chat-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .chat-input {
            flex: 1;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 10px 16px;
            border-radius: var(--radius);
            font-family: var(--font-sans);
            font-size: 14px;
            outline: none;
            transition: border-color var(--transition);
            min-height: 44px;
          }
          .chat-input::placeholder { color: var(--text-muted); }
          .chat-input:focus { border-color: var(--border-focus); }
          .chat-input:disabled { opacity: 0.6; cursor: not-allowed; }
          @media (max-width: 640px) {
            .plan-view { height: calc(100vh - 220px); }
            .chat-input-row {
              position: sticky;
              bottom: 0;
              background: var(--bg);
              padding: 8px 0;
            }
          }

          /* ── Modal styles ── */
          .modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 200;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .modal-box {
            width: 100%;
            max-width: 520px;
            padding: 32px;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .modal-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }
          .modal-icon {
            font-size: 32px;
            line-height: 1;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .modal-title {
            font-family: var(--font-serif);
            font-size: 22px;
            font-weight: 800;
            color: var(--text);
            margin: 0 0 4px;
            line-height: 1.2;
          }
          .modal-sub {
            font-size: 13px;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.5;
          }
          .field-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .field-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
          }
          .field-optional {
            font-size: 12px;
            font-weight: 400;
            color: var(--text-muted);
          }
          .field-required { color: var(--danger); }
          .field-input {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 10px 14px;
            border-radius: var(--radius-sm);
            font-family: var(--font-sans);
            font-size: 14px;
            outline: none;
            transition: border-color var(--transition);
          }
          .field-input::placeholder { color: var(--text-muted); }
          .field-input:focus { border-color: var(--border-focus); }
          .field-input--error { border-color: var(--danger); }
          .field-error {
            font-size: 12px;
            color: var(--danger);
          }
          .level-pills {
            display: flex;
            gap: 8px;
          }
          .level-pill {
            padding: 7px 18px;
            border-radius: 999px;
            border: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: border-color var(--transition), color var(--transition), background var(--transition);
            font-family: var(--font-sans);
          }
          .level-pill--active {
            border-color: var(--accent);
            color: var(--accent);
            background: rgba(99,102,241,0.08);
          }
          .level-pill:hover:not(.level-pill--active) {
            border-color: var(--text-muted);
            color: var(--text);
          }
          .modal-actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: flex-start;
          }
          .modal-submit { width: 100%; justify-content: center; }
          .modal-skip {
            background: none;
            border: none;
            color: var(--text-muted);
            font-family: var(--font-sans);
            font-size: 13px;
            cursor: pointer;
            padding: 0;
            text-decoration: underline;
            text-underline-offset: 3px;
            transition: color var(--transition);
            align-self: center;
          }
          .modal-skip:hover { color: var(--text-secondary); }
          .sr-only {
            position: absolute;
            width: 1px; height: 1px;
            padding: 0; margin: -1px;
            overflow: hidden;
            clip: rect(0,0,0,0);
            white-space: nowrap;
            border: 0;
          }
          @media (max-width: 480px) {
            .modal-box { padding: 24px 20px; }
            .level-pills { flex-wrap: wrap; }
          }
        `}</style>
      </div>
    </>
  );
}

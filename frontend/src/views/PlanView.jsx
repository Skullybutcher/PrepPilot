import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { planChat, planApply } from '../api';
import { useToast } from '../components/ToastProvider';

export default function PlanView() {
  const [messages, setMessages]       = useState([]);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [sending, setSending]         = useState(false);
  const [input, setInput]             = useState('');
  const endRef = useRef(null);
  const toast  = useToast();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingConfig, sending]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg    = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
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
        {messages.length === 0 && (
          <div className="chat-empty">
            <span aria-hidden="true" style={{ fontSize: 36 }}>🧠</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '8px 0 0' }}>
              Describe what you want — "add a system design track from week 14" or paste a full roadmap.
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
              <div className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
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
                <button className="done-btn" onClick={handleApply} aria-label="Apply proposed config">
                  ✓ Apply Changes
                </button>
                <button className="refresh-btn" onClick={() => setPendingConfig(null)} aria-label="Discard proposal">
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
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask the planner…"
          disabled={sending}
          aria-label="Message input"
        />
        <button
          className="done-btn"
          onClick={handleSend}
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
      `}</style>
    </div>
  );
}

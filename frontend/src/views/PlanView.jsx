import { useState, useRef, useEffect } from 'react';
import { planChat, planApply } from '../api';

export default function PlanView() {
  const [messages, setMessages] = useState([]);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [toast, setToast] = useState(null);
  
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingConfig]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    
    try {
      const { reply, proposedConfig } = await planChat(newMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (proposedConfig) {
        setPendingConfig(proposedConfig);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message || 'Failed to get response'}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleApply = async () => {
    if (!pendingConfig) return;
    try {
      await planApply(pendingConfig);
      setToast('✓ Config saved');
      setPendingConfig(null);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast(`Error: ${err.message || 'Failed to save config'}`);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="view-header" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#f3f4f6' }}>Plan Builder</h2>
          <p style={{ color: '#a1a1aa', fontSize: 13 }}>Paste roadmap or describe changes</p>
        </div>
      </div>
      
      {toast && (
        <div style={{ background: toast.startsWith('✓') ? '#16a34a' : '#dc2626', color: '#fff', padding: '8px 16px', borderRadius: 6, marginBottom: 16, fontSize: 13, textAlign: 'center' }}>
          {toast}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: '#71717a', fontSize: 14, textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
            Describe the tracks you want to add, remove, or modify.
          </p>
        )}
        
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'capitalize' }}>{m.role}</div>
            <div style={{ 
              background: m.role === 'user' ? '#6366f1' : '#18181b', 
              color: m.role === 'user' ? '#fff' : '#d4d4d8', 
              padding: '10px 14px', 
              borderRadius: 12,
              border: m.role === 'assistant' ? '1px solid #27272a' : 'none',
              fontSize: 14,
              whiteSpace: 'pre-wrap'
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {pendingConfig && (
          <div style={{ alignSelf: 'flex-start', width: '100%' }}>
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>proposed changes</div>
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 16 }}>
              <pre style={{ margin: 0, fontSize: 12, color: '#d4d4d8', overflowX: 'auto', marginBottom: 12 }}>
                {JSON.stringify(pendingConfig, null, 2)}
              </pre>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="done-btn" onClick={handleApply}>✓ Apply</button>
                <button className="refresh-btn" onClick={() => setPendingConfig(null)}>✗ Discard</button>
              </div>
            </div>
          </div>
        )}
        
        {sending && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Assistant</div>
            <div className="skeleton" style={{ width: 100, height: 36, minHeight: 0, marginBottom: 0 }}></div>
          </div>
        )}
        
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask the planner..."
          disabled={sending}
          style={{ 
            flex: 1, 
            background: '#18181b', 
            border: '1px solid #27272a', 
            color: '#fff', 
            padding: '10px 16px', 
            borderRadius: 8, 
            outline: 'none',
            fontSize: 14
          }}
        />
        <button 
          className="done-btn" 
          onClick={handleSend} 
          disabled={sending || !input.trim()}
          style={{ padding: '0 20px', opacity: (sending || !input.trim()) ? 0.5 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

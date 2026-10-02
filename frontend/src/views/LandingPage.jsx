import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Aurora from '../components/Aurora';
import NavBar from '../components/NavBar';

/* ---- SVG tech logos (inline, no external URLs) ---- */
const NvidiaLogo = () => (
  <svg viewBox="0 0 120 24" fill="currentColor" height="20" aria-label="NVIDIA NIM">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">NVIDIA NIM</text>
  </svg>
);
const JiraLogo = () => (
  <svg viewBox="0 0 60 24" fill="currentColor" height="20" aria-label="Jira">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">Jira</text>
  </svg>
);
const ReactLogo = () => (
  <svg viewBox="0 0 60 24" fill="currentColor" height="20" aria-label="React">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">React</text>
  </svg>
);
const ViteLogo = () => (
  <svg viewBox="0 0 60 24" fill="currentColor" height="20" aria-label="Vite">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">Vite</text>
  </svg>
);
const NodeLogo = () => (
  <svg viewBox="0 0 80 24" fill="currentColor" height="20" aria-label="Node.js">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">Node.js</text>
  </svg>
);
const SqliteLogo = () => (
  <svg viewBox="0 0 80 24" fill="currentColor" height="20" aria-label="SQLite">
    <text x="0" y="18" fontSize="14" fontWeight="700" fontFamily="system-ui">SQLite</text>
  </svg>
);

const TECH_LOGOS = [
  { id: 'nvidia', Label: NvidiaLogo },
  { id: 'jira',   Label: JiraLogo },
  { id: 'react',  Label: ReactLogo },
  { id: 'vite',   Label: ViteLogo },
  { id: 'node',   Label: NodeLogo },
  { id: 'sqlite', Label: SqliteLogo },
];

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Planner',
    desc: 'Chat with an LLM that knows your full roadmap and Striver progress. Describe what you want — get a structured plan back.',
    color: 'var(--track-dsa)',
  },
  {
    icon: '🔁',
    title: 'Jira Sync',
    desc: 'Daily todos are written directly as Jira subtasks. Board state, velocity, and worklogs feed back into your pace calculations.',
    color: 'var(--track-cloudcert)',
  },
  {
    icon: '⚡',
    title: 'Adaptive Pacing',
    desc: 'A weekly rebalancing agent detects drift and surfaces 1–2 concrete options. You approve — it never rewrites your plan silently.',
    color: 'var(--track-project)',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <NavBar />

      {/* ====================== HERO ====================== */}
      <section className="hero">
        <Aurora />

        <motion.div
          className="hero-content"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.div className="hero-eyebrow" variants={fadeUp}>
            <span className="eyebrow-pill">✦ AI-Powered Placement Prep</span>
          </motion.div>

          <motion.h1 className="hero-headline" variants={fadeUp}>
            Navigate your{' '}
            <em className="hero-accent">career</em>{' '}
            with clarity
          </motion.h1>

          <motion.p className="hero-sub" variants={fadeUp}>
            PrepPilot turns your 12-month placement roadmap into daily adaptive
            todos — synced with Jira, rebalanced weekly by AI, and always under
            your control.
          </motion.p>

          <motion.div className="hero-cta-row" variants={fadeUp}>
            <button
              className="cta-primary"
              onClick={() => navigate('/dashboard')}
              aria-label="Start your journey"
            >
              Start Your Journey
              <span className="cta-arrow" aria-hidden="true">→</span>
            </button>
            <a
              className="cta-secondary"
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </motion.div>
        </motion.div>

        {/* Glass card floating in hero */}
        <motion.div
          className="hero-card glass"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
          aria-hidden="true"
        >
          <div className="hero-card-row">
            <span className="hc-badge hc-dsa">DSA</span>
            <span className="hc-text">Two Sum — Sliding Window</span>
            <span className="hc-done">✓</span>
          </div>
          <div className="hero-card-row">
            <span className="hc-badge hc-cloud">Cloud</span>
            <span className="hc-text">AZ-900 Module 3 — Core Azure Services</span>
            <span className="hc-status">In Progress</span>
          </div>
          <div className="hero-card-row">
            <span className="hc-badge hc-proj">Project</span>
            <span className="hc-text">REST API — Auth endpoints</span>
            <span className="hc-status">To Do</span>
          </div>
          <div className="hero-card-divider" />
          <div className="hero-card-meta">
            <span className="hc-streak">🔥 7-day streak</span>
            <span className="hc-week">Week 5 of 52</span>
          </div>
        </motion.div>
      </section>

      {/* ====================== MARQUEE ====================== */}
      <section className="marquee-section" aria-label="Integrated technologies">
        <div className="marquee-label">Powered by</div>
        <div className="marquee-track-wrap">
          <div className="marquee-track">
            {[...TECH_LOGOS, ...TECH_LOGOS].map((logo, i) => (
              <div key={i} className="marquee-item">
                <logo.Label />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== FEATURES ====================== */}
      <section className="features-section">
        <motion.div
          className="features-header"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.p className="section-eyebrow" variants={fadeUp}>What PrepPilot does</motion.p>
          <motion.h2 className="section-title" variants={fadeUp}>
            Your roadmap,{' '}
            <em className="hero-accent">alive</em>
          </motion.h2>
          <motion.p className="section-sub" variants={fadeUp}>
            Three tightly integrated systems that turn a static plan into a
            living, self-correcting prep engine.
          </motion.p>
        </motion.div>

        <motion.div
          className="features-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              className="feature-card glass"
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div
                className="feature-icon"
                style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}
                aria-hidden="true"
              >
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ====================== FOOTER CTA ====================== */}
      <section className="footer-cta">
        <Aurora />
        <motion.div
          className="footer-cta-content"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.h2 className="footer-cta-title" variants={fadeUp}>
            Ready to stop winging it?
          </motion.h2>
          <motion.p className="footer-cta-sub" variants={fadeUp}>
            Set up takes under 5 minutes. Connect your Jira, paste your roadmap,
            and your first day's todos are ready.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button
              className="cta-primary"
              onClick={() => navigate('/dashboard')}
              aria-label="Get started with PrepPilot"
            >
              Get Started Free
              <span className="cta-arrow" aria-hidden="true">→</span>
            </button>
          </motion.div>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} PrepPilot</span>
        <span style={{ color: 'var(--text-muted)' }}>Built in public · Open source</span>
      </footer>

      <style>{`
        /* ====== LANDING LAYOUT ====== */
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        /* ====== HERO ====== */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 48px;
          padding: 120px 24px 80px;
          text-align: center;
          overflow: hidden;
        }
        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .hero-eyebrow { display: flex; justify-content: center; }
        .eyebrow-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 999px;
          background: var(--surface);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          font-size: 13px;
          letter-spacing: 0.04em;
          backdrop-filter: blur(8px);
        }
        .hero-headline {
          font-family: var(--font-serif);
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: var(--text);
          margin: 0;
        }
        .hero-accent {
          font-style: italic;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: clamp(15px, 2vw, 18px);
          color: var(--text-secondary);
          max-width: 560px;
          line-height: 1.7;
          margin: 0;
        }
        .hero-cta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
        }

        /* ====== CTAs ====== */
        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 999px;
          background: var(--accent-gradient);
          color: #fff;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: var(--accent-glow);
          transition: box-shadow 0.2s ease, transform 0.15s ease;
          letter-spacing: 0.01em;
        }
        .cta-primary:hover {
          box-shadow: var(--accent-glow-lg);
          transform: translateY(-1px);
        }
        .cta-primary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
        }
        .cta-arrow {
          transition: transform 0.2s ease;
        }
        .cta-primary:hover .cta-arrow {
          transform: translateX(3px);
        }
        .cta-secondary {
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          border-bottom: 1px solid var(--border);
          padding-bottom: 1px;
          transition: color var(--transition), border-color var(--transition);
        }
        .cta-secondary:hover { color: var(--text); border-color: var(--text-secondary); }

        /* ====== HERO GLASS CARD ====== */
        .hero-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          padding: 20px 24px;
          text-align: left;
        }
        .hero-card-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .hero-card-row:last-of-type { border-bottom: none; }
        .hc-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
          letter-spacing: 0.04em;
        }
        .hc-dsa   { background: rgba(99,102,241,0.2);  color: var(--track-dsa); }
        .hc-cloud { background: rgba(14,165,233,0.2);  color: var(--track-cloudcert); }
        .hc-proj  { background: rgba(16,185,129,0.2);  color: var(--track-project); }
        .hc-text  { flex: 1; font-size: 13px; color: var(--text); }
        .hc-done  { font-size: 12px; color: var(--success); font-weight: 700; }
        .hc-status { font-size: 11px; color: var(--text-muted); }
        .hero-card-divider { height: 1px; background: var(--border); margin: 8px 0; }
        .hero-card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          padding-top: 4px;
        }
        .hc-streak { color: var(--warning); font-weight: 600; }
        .hc-week   { color: var(--text-muted); }

        /* ====== MARQUEE ====== */
        .marquee-section {
          padding: 32px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }
        .marquee-label {
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 20px;
        }
        .marquee-track-wrap {
          overflow: hidden;
          -webkit-mask: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
          mask: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
        }
        .marquee-track {
          display: flex;
          gap: 48px;
          width: max-content;
          animation: marquee-scroll 18s linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }
        .marquee-item {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          white-space: nowrap;
          transition: color var(--transition);
        }
        .marquee-item:hover { color: var(--text); }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* ====== FEATURES ====== */
        .features-section {
          padding: 100px 24px;
          max-width: 1080px;
          margin: 0 auto;
          width: 100%;
        }
        .features-header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 64px;
        }
        .section-eyebrow {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin: 0 0 12px;
          font-weight: 600;
        }
        .section-title {
          font-family: var(--font-serif);
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          color: var(--text);
          margin: 0 0 16px;
          line-height: 1.15;
        }
        .section-sub {
          font-size: 16px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .feature-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          cursor: default;
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .feature-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          font-family: var(--font-sans);
        }
        .feature-desc {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
        }

        /* ====== FOOTER CTA ====== */
        .footer-cta {
          position: relative;
          padding: 120px 24px;
          text-align: center;
          overflow: hidden;
          border-top: 1px solid var(--border);
        }
        .footer-cta-content {
          position: relative;
          z-index: 1;
          max-width: 560px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .footer-cta-title {
          font-family: var(--font-serif);
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          color: var(--text);
          margin: 0;
          line-height: 1.15;
        }
        .footer-cta-sub {
          font-size: 16px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
        }

        /* ====== FOOTER ====== */
        .landing-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-secondary);
        }

        /* ====== RESPONSIVE ====== */
        @media (max-width: 768px) {
          .features-grid { grid-template-columns: 1fr; }
          .hero { padding: 100px 16px 60px; }
          .features-section { padding: 60px 16px; }
          .landing-footer { flex-direction: column; gap: 8px; text-align: center; padding: 20px 16px; }
        }
        @media (min-width: 769px) and (max-width: 1023px) {
          .features-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}

import { useEffect, useRef } from 'react';

/**
 * Aurora animated gradient background.
 * Pure CSS animation — no canvas, no WebGL, no external lib needed.
 */
export default function Aurora({ className = '' }) {
  return (
    <div className={`aurora-root ${className}`} aria-hidden="true">
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="aurora-orb aurora-orb-4" />
      <style>{`
        .aurora-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .aurora-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          animation: aurora-float 18s ease-in-out infinite;
        }
        html.light .aurora-orb { opacity: 0.18; }

        .aurora-orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #6366f1 0%, transparent 70%);
          top: -200px; left: -100px;
          animation-duration: 20s;
        }
        .aurora-orb-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #a855f7 0%, transparent 70%);
          top: -100px; right: -150px;
          animation-duration: 25s;
          animation-delay: -5s;
        }
        .aurora-orb-3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
          bottom: -100px; left: 30%;
          animation-duration: 22s;
          animation-delay: -10s;
        }
        .aurora-orb-4 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, #ec4899 0%, transparent 70%);
          bottom: -50px; right: 10%;
          animation-duration: 28s;
          animation-delay: -15s;
        }
        @keyframes aurora-float {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(40px, -30px) scale(1.08); }
          66%  { transform: translate(-30px, 20px) scale(0.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @media (max-width: 640px) {
          .aurora-orb { filter: blur(50px); }
          .aurora-orb-1 { width: 300px; height: 300px; }
          .aurora-orb-2 { width: 250px; height: 250px; }
          .aurora-orb-3 { width: 200px; height: 200px; }
          .aurora-orb-4 { display: none; }
        }
      `}</style>
    </div>
  );
}

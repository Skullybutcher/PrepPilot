import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * PlanSetupModal
 *
 * A glass overlay modal that collects upfront context before the AI
 * planner starts a conversation. On submit it calls `onStart(contextMsg)`
 * with a fully-formatted hidden user message that becomes the first turn
 * sent to /api/plan/chat, giving the LLM rich context immediately.
 *
 * Props:
 *   onStart(contextMsg: string) — called when the user submits the form
 *   onSkip()                    — called when the user wants to type freely
 */
export default function PlanSetupModal({ onStart, onSkip }) {
  const [goal, setGoal]         = useState('');
  const [duration, setDuration] = useState('');
  const [materials, setMaterials] = useState('');
  const [level, setLevel]       = useState('Intermediate');
  const [errors, setErrors]     = useState({});

  const validate = () => {
    const e = {};
    if (!goal.trim())     e.goal     = 'Please describe your goal.';
    if (!duration.trim()) e.duration = 'Please specify a duration.';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }

    // Build a structured context message the backend system prompt will parse
    const lines = [
      `Goal: ${goal.trim()}`,
      `Duration: ${duration.trim()}`,
      `Current level: ${level}`,
    ];
    if (materials.trim()) lines.push(`Course materials / platforms: ${materials.trim()}`);
    lines.push(
      'Based on this context, please generate a comprehensive, structured roadmap config ' +
      'tailored to my preparation goals. Walk me through the plan and ask any clarifying ' +
      'questions you need before generating the final config.'
    );

    onStart(lines.join('\n'));
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <motion.div
          className="modal-box glass"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="modal-header">
            <div className="modal-icon" aria-hidden="true">🧠</div>
            <div>
              <h2 id="modal-title" className="modal-title">Set up your plan</h2>
              <p className="modal-sub">
                A little context helps the AI build a far better roadmap for you.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Goal */}
            <div className="field-group">
              <label className="field-label" htmlFor="plan-goal">
                What are you preparing for?
                <span className="field-required" aria-hidden="true"> *</span>
              </label>
              <input
                id="plan-goal"
                className={`field-input ${errors.goal ? 'field-input--error' : ''}`}
                type="text"
                placeholder="e.g. SDE-1 at Amazon, FAANG backend role, ML engineer at a startup"
                value={goal}
                onChange={(e) => { setGoal(e.target.value); setErrors(v => ({ ...v, goal: '' })); }}
                aria-describedby={errors.goal ? 'plan-goal-err' : undefined}
                aria-required="true"
                autoFocus
              />
              {errors.goal && (
                <span id="plan-goal-err" className="field-error" role="alert">{errors.goal}</span>
              )}
            </div>

            {/* Duration */}
            <div className="field-group">
              <label className="field-label" htmlFor="plan-duration">
                How long do you have?
                <span className="field-required" aria-hidden="true"> *</span>
              </label>
              <input
                id="plan-duration"
                className={`field-input ${errors.duration ? 'field-input--error' : ''}`}
                type="text"
                placeholder="e.g. 6 months, 12 weeks, until March 2026"
                value={duration}
                onChange={(e) => { setDuration(e.target.value); setErrors(v => ({ ...v, duration: '' })); }}
                aria-describedby={errors.duration ? 'plan-duration-err' : undefined}
                aria-required="true"
              />
              {errors.duration && (
                <span id="plan-duration-err" className="field-error" role="alert">{errors.duration}</span>
              )}
            </div>

            {/* Materials */}
            <div className="field-group">
              <label className="field-label" htmlFor="plan-materials">
                Course materials / platforms <span className="field-optional">(optional)</span>
              </label>
              <input
                id="plan-materials"
                className="field-input"
                type="text"
                placeholder="e.g. Striver A2Z, NeetCode 150, AWS Skill Builder, CLRS"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            </div>

            {/* Level */}
            <div className="field-group">
              <span className="field-label" id="level-label">Current level</span>
              <div className="level-pills" role="radiogroup" aria-labelledby="level-label">
                {LEVELS.map((l) => (
                  <label
                    key={l}
                    className={`level-pill ${level === l ? 'level-pill--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={l}
                      checked={level === l}
                      onChange={() => setLevel(l)}
                      className="sr-only"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button type="submit" className="cta-primary modal-submit">
                Start Planning
                <span aria-hidden="true"> →</span>
              </button>
              <button
                type="button"
                className="modal-skip"
                onClick={onSkip}
                aria-label="Skip setup and start chat directly"
              >
                Skip — I'll describe it myself
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

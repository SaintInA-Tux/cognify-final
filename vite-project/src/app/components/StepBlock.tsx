import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Check, X, Lightbulb, Lock, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export type StepPhase = 'understand' | 'identify' | 'apply' | 'solve';
export type StepState = 'pending' | 'active' | 'correct' | 'incorrect';

const PHASE_LABELS: Record<StepPhase, string> = {
  understand: 'UNDERSTAND',
  identify: 'IDENTIFY',
  apply: 'APPLY',
  solve: 'SOLVE',
};

const PHASE_PROMPTS: Record<StepPhase, string> = {
  understand: 'What is given? What are you asked to find?',
  identify: 'What concept or pattern applies here?',
  apply: 'Set up the method. Write the key equation or approach.',
  solve: 'Execute. Show your final calculation.',
};

export interface StepBlockProps {
  stepNumber: number;
  phase: StepPhase;
  prompt?: string;
  state: StepState;
  feedback?: string;
  errorType?: string;
  hints: { level: number; text: string }[];
  maxHintLevel: number;
  isChecking?: boolean;
  onSubmit: (answer: string) => void;
  onRetry?: () => void;
  onRequestHint: (level: number) => void;
  disabled?: boolean;
  variables?: string[]; // NEW: variables identified for 'Understand' phase
}

export function StepBlock({
  stepNumber,
  phase,
  prompt,
  state,
  feedback,
  errorType,
  hints,
  maxHintLevel,
  isChecking,
  onSubmit,
  onRetry,
  onRequestHint,
  disabled,
  variables,
}: StepBlockProps) {
  const [input, setInput] = useState('');
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({});
  const [hintsOpen, setHintsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state === 'active' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  // Fix #3: Reset input when state changes back to active (retry)
  useEffect(() => {
    if (state === 'active') {
      setInput('');
    }
  }, [state]);

  const handleSubmit = () => {
    if (phase === 'understand' && variables?.length) {
      const allFilled = variables.every(v => variableInputs[v]?.trim());
      const summary = variables.map(v => `${v} = ${variableInputs[v]}`).join(', ');
      if (!allFilled || state !== 'active' || isChecking) return;
      onSubmit(summary);
      return;
    }

    if (!input.trim() || state !== 'active' || isChecking) return;
    onSubmit(input.trim());
  };

  const stateClass =
    state === 'active' ? 'step-block--active' :
    state === 'correct' ? 'step-block--correct' :
    state === 'incorrect' ? 'step-block--incorrect' :
    'step-block--pending';

  return (
    <motion.div
      className={`step-block ${stateClass} ${isChecking ? 'step-block--checking' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="step-block__header">
        <div className="step-block__number">
          {state === 'correct' ? (
            <Check size={14} />
          ) : state === 'incorrect' ? (
            <X size={14} />
          ) : isChecking ? (
            <div className="step-block__spinner" />
          ) : (
            <span>{String(stepNumber).padStart(2, '0')}</span>
          )}
        </div>
        <div className="step-block__phase">{PHASE_LABELS[phase]}</div>
        {state === 'correct' && <div className="step-block__badge step-block__badge--correct">Correct</div>}
        {state === 'incorrect' && <div className="step-block__badge step-block__badge--incorrect">{errorType || 'Incorrect'}</div>}
      </div>

      {/* Prompt */}
      <div className="step-block__prompt">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {prompt || PHASE_PROMPTS[phase]}
        </ReactMarkdown>
      </div>

      {/* Input (only for active state) */}
      {state === 'active' && (
        <div className="step-block__input-area">
          {phase === 'understand' && variables && variables.length > 0 ? (
            <div className="step-block__variables">
              <p className="step-block__variable-label">Enter the identified values:</p>
              <div className="step-block__variable-grid">
                {variables.map(v => (
                  <div key={v} className="step-block__variable-item">
                    <span className="step-block__variable-name">{v} = </span>
                    <input
                      className="step-block__variable-input"
                      value={variableInputs[v] || ''}
                      onChange={(e) => setVariableInputs(prev => ({ ...prev, [v]: e.target.value }))}
                      placeholder="?"
                      disabled={isChecking || disabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              className="step-block__input"
              placeholder="Type your answer..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={2}
              disabled={isChecking || disabled}
            />
          )}
          <button
            className="step-block__submit"
            onClick={handleSubmit}
            disabled={
              isChecking || disabled || 
              (phase === 'understand' && variables && variables.length > 0 
                ? !variables.every(v => variableInputs[v]?.trim()) 
                : !input.trim())
            }
          >
            {isChecking ? 'Checking...' : 'Check →'}
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (state === 'correct' || state === 'incorrect') && (
        <motion.div
          className={`step-block__feedback ${state === 'correct' ? 'step-block__feedback--correct' : 'step-block__feedback--incorrect'}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {feedback}
          </ReactMarkdown>
        </motion.div>
      )}

      {/* Fix #3: Retry button on incorrect state */}
      {state === 'incorrect' && onRetry && (
        <motion.button
          className="step-block__retry"
          onClick={onRetry}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <RotateCcw size={13} />
          Retry Approach
        </motion.button>
      )}

      {/* Hints (collapsible, only for active/incorrect states) */}
      {(state === 'active' || state === 'incorrect') && (
        <div className="step-block__hints">
          <button
            className="step-block__hints-toggle"
            onClick={() => setHintsOpen(!hintsOpen)}
          >
            <Lightbulb size={14} />
            <span>Hints ({hints.length}/{maxHintLevel})</span>
            <ChevronDown size={14} className={`step-block__hints-chevron ${hintsOpen ? 'open' : ''}`} />
          </button>

          {hintsOpen && (
            <motion.div
              className="step-block__hints-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[1, 2, 3].map((level) => {
                const hint = hints.find(h => h.level === level);
                const isUnlocked = !!hint;
                const canUnlock = !isUnlocked && (level === 1 || hints.some(h => h.level === level - 1));

                return (
                  <div
                    key={level}
                    className={`step-block__hint ${isUnlocked ? 'unlocked' : canUnlock ? 'available' : 'locked'}`}
                    onClick={() => {
                      if (canUnlock && !disabled) onRequestHint(level);
                    }}
                  >
                    <div className="step-block__hint-level">H{level}</div>
                    <div className="step-block__hint-content">
                      {isUnlocked ? (
                        hint.text
                      ) : canUnlock ? (
                        <span className="step-block__hint-unlock">Click to reveal</span>
                      ) : (
                        <span className="step-block__hint-locked">
                          <Lock size={12} /> Unlock H{level - 1} first
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* Pending overlay */}
      {state === 'pending' && (
        <div className="step-block__pending-overlay" />
      )}
    </motion.div>
  );
}

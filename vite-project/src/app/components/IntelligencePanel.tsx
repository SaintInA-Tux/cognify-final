import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { StepPhase } from './StepBlock';
import type { ClassificationResult, TopicWeakness } from '../../api';

export interface IntelligencePanelProps {
  classification: ClassificationResult | null;
  currentPhase: StepPhase | null;
  currentStepNumber: number;
  totalSteps: number;
  errorCount: number;
  lastErrorType: string | null;
  hintsUsed: number;
  maxHints: number;
  topicStats: TopicWeakness[];
  isActive: boolean;
  brainDetails?: { pattern: string; method: string; setup: string; firstStep: string } | null;
  onClose?: () => void;
  isMobile?: boolean;
}

const PHASE_DESCRIPTIONS: Record<StepPhase, string> = {
  understand: 'Breaking down the problem',
  identify: 'Recognizing the pattern',
  apply: 'Setting up the method',
  solve: 'Computing the answer',
};

export function IntelligencePanel({
  classification,
  currentPhase,
  currentStepNumber,
  totalSteps,
  errorCount,
  lastErrorType,
  hintsUsed,
  topicStats,
  isActive,
  brainDetails,
  onClose,
  isMobile,
}: IntelligencePanelProps) {

  // Fix #2: Mastery starts at 0%. Only count COMPLETED steps (currentStepNumber - 1).
  const completedSteps = isActive ? Math.max(0, currentStepNumber - 1) : 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className={`intel-panel ${isMobile ? 'intel-panel--mobile' : ''}`}>
      {/* Mobile close button */}
      {isMobile && onClose && (
        <div className="intel-panel__mobile-header">
          <span>Phi Intelligence</span>
          <button onClick={onClose} className="intel-panel__close">✕</button>
        </div>
      )}

      {/* Current Step */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Current Step</div>
        {isActive && currentPhase ? (
          <div className="intel-panel__step-indicator">
            <div className="intel-panel__step-number">{currentStepNumber}/{totalSteps}</div>
            <div className="intel-panel__step-phase">{currentPhase.toUpperCase()}</div>
            <div className="intel-panel__step-desc">{PHASE_DESCRIPTIONS[currentPhase]}</div>
            <div className="intel-panel__step-dots">
              {(['understand', 'identify', 'apply', 'solve'] as StepPhase[]).map((phase, i) => (
                <div
                  key={phase}
                  className={`intel-panel__dot ${
                    i + 1 < currentStepNumber ? 'intel-panel__dot--done' :
                    i + 1 === currentStepNumber ? 'intel-panel__dot--active' :
                    'intel-panel__dot--pending'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="intel-panel__empty-state">Waiting for a problem...</div>
        )}
      </div>

      {/* Topic Detection */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Detected Topic</div>
        {classification ? (
          <div className="intel-panel__topic">
            <div className="intel-panel__topic-row">
              <span className="intel-panel__topic-key">Subject</span>
              <span className="intel-panel__topic-val intel-panel__topic-val--highlight">{classification.subject}</span>
            </div>
            <div className="intel-panel__topic-row">
              <span className="intel-panel__topic-key">Topic</span>
              <span className="intel-panel__topic-val">{classification.topic}</span>
            </div>
            <div className="intel-panel__topic-row">
              <span className="intel-panel__topic-key">Subtopic</span>
              <span className="intel-panel__topic-val">{classification.subtopic}</span>
            </div>
            <div className="intel-panel__topic-row">
              <span className="intel-panel__topic-key">Difficulty</span>
              <div className="intel-panel__difficulty">
                <span className="intel-panel__topic-val">{classification.difficulty.replace('_', ' ')}</span>
                <div className="intel-panel__diff-dots">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className={`intel-panel__diff-dot ${
                      (classification.difficulty === 'easy' && n <= 1) ||
                      (classification.difficulty === 'medium' && n <= 2) ||
                      (classification.difficulty === 'hard' && n <= 3) ||
                      (classification.difficulty === 'jee_advanced' && n <= 4)
                        ? 'intel-panel__diff-dot--on' : ''
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="intel-panel__empty-state">No topic detected yet</div>
        )}
      </div>

      {/* Fix #5: Concept Clarification Section */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Concept Clarification</div>
        {isActive && brainDetails ? (
          <div className="intel-panel__concept">
            <div className="intel-panel__concept-block">
              <div className="intel-panel__concept-label">Pattern</div>
              <div className="intel-panel__concept-value intel-panel__concept-value--mono">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {brainDetails.pattern}
                </ReactMarkdown>
              </div>
            </div>
            <div className="intel-panel__concept-block">
              <div className="intel-panel__concept-label">Method</div>
              <div className="intel-panel__concept-value">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {brainDetails.method}
                </ReactMarkdown>
              </div>
            </div>
            <div className="intel-panel__concept-block">
              <div className="intel-panel__concept-label">First Move</div>
              <div className="intel-panel__concept-value">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {brainDetails.firstStep || '—'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="intel-panel__empty-state">Submit a problem to see concepts</div>
        )}
      </div>

      {/* Mistake Signals */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Signals</div>
        <div className="intel-panel__signals">
          {errorCount > 0 ? (
            <>
              <div className="intel-panel__signal intel-panel__signal--error">
                <span className="intel-panel__signal-count">{errorCount}</span>
                <span>mistake{errorCount > 1 ? 's' : ''}</span>
              </div>
              {lastErrorType && (
                <div className="intel-panel__signal intel-panel__signal--type">
                  {lastErrorType.replace('_', ' ')}
                </div>
              )}
            </>
          ) : isActive ? (
            <div className="intel-panel__signal intel-panel__signal--clean">Clean run so far</div>
          ) : (
            <div className="intel-panel__empty-state">—</div>
          )}
        </div>
      </div>

      {/* Hint Level */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Hints Used</div>
        <div className="intel-panel__hints">
          {[1, 2, 3].map(level => (
            <div
              key={level}
              className={`intel-panel__hint-pip ${level <= hintsUsed ? 'intel-panel__hint-pip--used' : ''}`}
            >
              H{level}
            </div>
          ))}
        </div>
        <div className="intel-panel__hint-note">
          {hintsUsed === 0 && isActive && 'No hints used — great discipline!'}
          {hintsUsed > 0 && hintsUsed < 3 && `${3 - hintsUsed} hint${3 - hintsUsed > 1 ? 's' : ''} remaining`}
          {hintsUsed === 3 && 'All hints revealed'}
          {!isActive && '—'}
        </div>
      </div>

      {/* Mastery / Confidence */}
      <div className="intel-panel__section">
        <div className="intel-panel__section-label">Mastery</div>
        <div className="intel-panel__mastery">
          <div className="intel-panel__mastery-bar">
            <motion.div
              className="intel-panel__mastery-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <div className="intel-panel__mastery-label">
            <span>Problem Mastery</span>
            <span>{progressPct}%</span>
          </div>
        </div>

        {isActive && (
          <div className="intel-panel__formulas" style={{ marginTop: 20 }}>
            <div className="intel-panel__section-label">Key Formulas</div>
            <div className="intel-panel__formula-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', marginTop: '8px' }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {brainDetails?.setup || (classification?.topic === 'Integration' ? '$ \\int u \\, dv = uv - \\int v \\, du $' : '—')}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {topicStats.length > 0 && !isMobile && (
          <div className="intel-panel__topic-stats" style={{ marginTop: 24 }}>
            <div className="intel-panel__topic-stats-label">Recent Performance</div>
            {topicStats.slice(0, 3).map((stat, i) => (
              <div key={i} className="intel-panel__stat-row">
                <div className={`intel-panel__stat-dot intel-panel__stat-dot--${stat.status}`} />
                <div className="intel-panel__stat-topic">{stat.topic}</div>
                <div className="intel-panel__stat-bar">
                  <div
                    className={`intel-panel__stat-fill intel-panel__stat-fill--${stat.status}`}
                    style={{ width: `${stat.accuracy_pct}%` }}
                  />
                </div>
                <div className="intel-panel__stat-pct">{Math.round(stat.accuracy_pct)}%</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

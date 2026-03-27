import { motion, AnimatePresence } from 'motion/react';
import { Zap, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { StepBlock } from './StepBlock';
import type { StepPhase, StepState } from './StepBlock';
import type { ClassificationResult } from '../../api';

// Helper to extract variables from setup text
const extractVariables = (text: string): string[] => {
  if (!text) return [];
  // Matches patterns like $v = 10$, v=5, or [v] = 10 inside setup blocks
  const regex = /(?:\$)?\b([a-zA-Z_\theta\phi\alpha\beta])\s*=\s*(?:[^,$]+)(?:\$)?/g;
  const matches = [...text.matchAll(regex)];
  const vars = matches.map(m => m[1]);
  return [...new Set(vars)]; // Return unique variables
};

export interface ThinkingStep {
  phase: StepPhase;
  prompt?: string;
  state: StepState | 'correct';
  feedback?: string;
  errorType?: string;
  userAnswer?: string;
  hints: { level: number; text: string }[];
  isRevealed?: boolean;
}

export interface ThinkingFlowProps {
  steps: ThinkingStep[];
  brainData: {
    pattern: string;
    method: string;
    setup: string;
    firstStep: string;
    variables: string[] | null;
  } | null;
  classification: ClassificationResult | null;
  activeAttemptId: string | null;
  isLoading: boolean;
  onStepSubmit: (stepIndex: number, answer: string) => void;
  onStepRetry: (stepIndex: number) => void;
  onStepSkip: (stepIndex: number) => void;
  onRequestHint: (stepIndex: number, level: number) => void;
  sosSolution: string | null;
  onRetryProblem: () => void;
  onSwitchToGeneral: () => void;
  modeSwitchCandidate: string | null;
}

export function ThinkingFlow({
  steps,
  brainData,
  classification,
  activeAttemptId,
  isLoading,
  onStepSubmit,
  onStepRetry,
  onStepSkip,
  onRequestHint,
  sosSolution,
  onRetryProblem,
  onSwitchToGeneral,
  modeSwitchCandidate,
}: ThinkingFlowProps) {

  if (!activeAttemptId || !brainData) {
    return (
      <div className="thinking-flow">
        <div className="thinking-flow__empty">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="thinking-flow__empty-icon"
          >
            Φ
          </motion.div>
          <h2 className="thinking-flow__empty-title">Brain Mode Active</h2>
          <p className="thinking-flow__empty-sub">
            Enter a problem below. I won't give you the answer — I'll train you to find it.
          </p>
        </div>
      </div>
    );
  }

  const variables = brainData?.variables || (brainData?.setup ? extractVariables(brainData.setup) : []);

  return (
    <div className="thinking-flow">
      <motion.div
        className="thinking-flow__header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="thinking-flow__header-badge">THINKING FLOW</div>
        <div className="thinking-flow__header-topic">
          {classification?.topic || 'Problem'}
          {classification?.subtopic && (
            <span className="thinking-flow__header-subtopic"> → {classification.subtopic}</span>
          )}
        </div>
      </motion.div>

      <motion.div
        className="thinking-flow__summary"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="thinking-flow__summary-row">
          <span className="thinking-flow__summary-key">Pattern</span>
          <div className="thinking-flow__summary-val">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {brainData.pattern}
            </ReactMarkdown>
          </div>
        </div>
        <div className="thinking-flow__summary-row">
          <span className="thinking-flow__summary-key">Method</span>
          <div className="thinking-flow__summary-val">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {brainData.method}
            </ReactMarkdown>
          </div>
        </div>
        <div className="thinking-flow__summary-row">
          <span className="thinking-flow__summary-key">First move</span>
          <div className="thinking-flow__summary-val">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {brainData.firstStep}
            </ReactMarkdown>
          </div>
        </div>
      </motion.div>

      <div className="thinking-flow__steps">
        {steps.map((step, idx) => (
          <StepBlock
            key={idx}
            stepNumber={idx + 1}
            phase={step.phase}
            prompt={step.prompt}
            state={step.state === 'correct' ? 'correct' : (step.isRevealed ? 'correct' : step.state)}
            feedback={step.feedback}
            errorType={step.errorType}
            hints={step.hints}
            maxHintLevel={3}
            isChecking={isLoading && step.state === 'active'}
            onSubmit={(answer) => !step.isRevealed && onStepSubmit(idx, answer)}
            onRetry={() => onStepRetry(idx)}
            onSkip={() => onStepSkip(idx)}
            onRequestHint={(level) => onRequestHint(idx, level)}
            disabled={!!sosSolution}
            variables={step.phase === 'understand' ? variables : undefined}
          />
        ))}

        <AnimatePresence>
          {sosSolution && (
            <motion.div 
              className="thinking-flow__sos-reveal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="sos-reveal__header">
                <Zap size={16} fill="#FFD700" />
                SOS Solution Revealed
              </div>
              <div className="sos-reveal__content">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {sosSolution}
                </ReactMarkdown>
              </div>
              <button className="sos-reveal__retry" onClick={onRetryProblem}>
                <RefreshCw size={14} /> Retry Problem
              </button>
            </motion.div>
          )}

          {modeSwitchCandidate && !sosSolution && (
            <motion.div 
              className="thinking-flow__mode-suggestion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="suggestion__text">
                <span className="suggestion__quote">" {modeSwitchCandidate.substring(0, 45)}{modeSwitchCandidate.length > 45 ? '...' : ''} "</span>
                <p>This sounds like a general question. Wanna switch to general mode?</p>
              </div>
              <button onClick={onSwitchToGeneral}>Switch to General Mode</button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="thinking-flow__loading">
            <div className="thinking-flow__loading-dot" />
            <div className="thinking-flow__loading-dot" />
            <div className="thinking-flow__loading-dot" />
          </div>
        )}
      </div>

    </div>
  );
}

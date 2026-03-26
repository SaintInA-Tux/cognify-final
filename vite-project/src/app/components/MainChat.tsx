import { useState, useRef, useEffect } from 'react';
import { Menu, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SciCalculator } from './Calculator';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThinkingFlow } from './ThinkingFlow';
import { IntelligencePanel } from './IntelligencePanel';
import type { Message } from './MessageList';
import type { ThinkingStep } from './ThinkingFlow';
import type { StepPhase } from './StepBlock';
import type { ClassificationResult, TopicWeakness } from '../../api';
import './MainChat.css';

// --- Topic switch detection ---
function detectTopicSwitch(input: string): boolean {
  const lower = input.toLowerCase();
  const continuationWords = ['next', 'step', 'continue', 'again', 'above', 'previous'];
  const problemWords = ['solve', 'integrate', 'differentiate', 'find', 'evaluate'];
  const isCont = continuationWords.some(w => lower.includes(w));
  const isProb = problemWords.some(w => lower.includes(w));
  const words = lower.split(' ').length;
  const isLikelyConcept = words <= 6 || lower.startsWith('what') || lower.startsWith('define');
  return !isCont && isLikelyConcept && !isProb;
}

export interface MainChatProps {
  activeChatId?: string | null;
  onChatCreated?: (id: string) => void;
  onMenuClick?: () => void;
  isSidebarCollapsed?: boolean;
}

const PHASE_ORDER: StepPhase[] = ['understand', 'identify', 'apply', 'solve'];

export function MainChat({ activeChatId, onChatCreated, onMenuClick }: MainChatProps) {
  const { profile } = useAuth();

  // Mode
  const [mode, setMode] = useState<'general' | 'brain'>('general');

  // General mode state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Brain mode state
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [brainDetails, setBrainDetails] = useState<{ pattern: string; method: string; setup: string; firstStep: string; variables: string[] | null } | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [currentStepNumber, setCurrentStepNumber] = useState(1);
  const [previousSteps, setPreviousSteps] = useState<string[]>([]);
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [lastErrorType, setLastErrorType] = useState<string | null>(null);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);

  // Shared state
  const [topicStats, setTopicStats] = useState<TopicWeakness[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showIntel, setShowIntel] = useState(false);
  const [sosSolution, setSosSolution] = useState<string | null>(null);
  const [modeSwitchCandidate, setModeSwitchCandidate] = useState<string | null>(null);
  const [draftInput, setDraftInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, steps, isLoading]);

  // Load dashboard stats
  useEffect(() => {
    import('../../api').then(({ getDashboard }) => {
      getDashboard().then(data => {
        setTopicStats([...data.weakest_topics, ...data.improving_topics, ...data.strong_topics].slice(0, 3));
      }).catch(err => console.error('Failed to load dashboard', err));
    });
  }, []);

  // Load chat messages on chat switch
  useEffect(() => {
    let cancelled = false;
    if (activeChatId) {
      setIsLoading(true);
      import('../../api').then(({ getChatMessages }) => {
        getChatMessages(activeChatId).then(msgs => {
          if (cancelled) return;
          const mappedMsgs = msgs?.length ? msgs.map(m => ({ role: m.role, content: m.content, mode: m.mode })) : [];
          setMessages(mappedMsgs as Message[]);

          // Smart Mode Detection: Use the mode of the last message if available
          if (msgs?.length) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.mode === 'brain' || lastMsg.mode === 'sos') {
              setMode('brain');
            } else {
              setMode('general');
            }
          }
        }).catch(err => {
          console.error('Failed to load messages', err);
          if (!cancelled) setMessages([]);
        }).finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      });
    } else {
      setMessages([]);
    }
    // Reset brain state on chat switch
    resetBrainState();
    return () => { cancelled = true; };
  }, [activeChatId]);

  const resetBrainState = () => {
    setActiveAttemptId(null);
    setClassification(null);
    setBrainDetails(null);
    setCurrentStepNumber(1);
    setPreviousSteps([]);
    setSteps([]);
    setErrorCount(0);
    setLastErrorType(null);
    setHintsUsedCount(0);
    setSosSolution(null);
    setModeSwitchCandidate(null);
    setModeSwitchCandidate(null);
  };

  const initializeSteps = (): ThinkingStep[] => {
    return PHASE_ORDER.map((phase, i) => ({
      phase,
      state: i === 0 ? 'active' : 'pending',
      hints: [],
    }));
  };

  // --- Core send (General Mode) ---
  const handleSendGeneral = async (userMsg: string) => {
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      let currentSessionId = activeChatId;
      if (!currentSessionId) {
        const { createChat } = await import('../../api');
        const newChat = await createChat(userMsg.substring(0, 30) || 'New Chat');
        currentSessionId = newChat.id;
        if (onChatCreated) onChatCreated(newChat.id);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { askGeneral } = await import('../../api');
      const data = await askGeneral(userMsg, currentSessionId, controller.signal);

      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Generation stopped.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // --- Core send (Brain Mode — new problem) ---
  const handleSendBrain = async (userMsg: string) => {
    setIsLoading(true);

    try {
      let currentSessionId = activeChatId;
      if (!currentSessionId) {
        const { createChat } = await import('../../api');
        const newChat = await createChat(userMsg.substring(0, 30) || 'New Chat');
        currentSessionId = newChat.id;
        if (onChatCreated) onChatCreated(newChat.id);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { askQuestion, askImage } = await import('../../api');
      const data = selectedImage
        ? await askImage(selectedImage, currentSessionId)
        : await askQuestion(userMsg, currentSessionId, controller.signal);

      setActiveAttemptId(data.attempt_id);
      setCurrentStepNumber(1);
      setPreviousSteps([]);
      setClassification(data.classification);
      setBrainDetails({
        pattern: data.pattern,
        method: data.method,
        setup: data.setup,
        firstStep: data.first_step,
        variables: data.variables || null,
      });
      setSteps(initializeSteps());
      setSelectedImage(null);
    } catch (error: any) {
      console.error('Brain mode error:', error);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // --- Handle step submission in Brain Mode ---
  const handleStepSubmit = async (stepIndex: number, answer: string) => {
    if (!activeAttemptId) return;
    setIsLoading(true);

    try {
      const { checkStep } = await import('../../api');
      const data = await checkStep(activeAttemptId, currentStepNumber, answer, previousSteps);

      setSteps(prev => {
        const updated = [...prev];
        if (data.is_correct) {
          updated[stepIndex] = {
            ...updated[stepIndex],
            state: 'correct',
            feedback: data.explanation || 'Correct! Great thinking.',
            userAnswer: answer,
          };
          // Activate next step
          if (stepIndex + 1 < updated.length) {
            updated[stepIndex + 1] = {
              ...updated[stepIndex + 1],
              state: 'active',
            };
          }
        } else {
          updated[stepIndex] = {
            ...updated[stepIndex],
            state: 'incorrect',
            feedback: data.explanation || 'Not quite. Try again.',
            errorType: data.error_type || 'conceptual',
            userAnswer: answer,
          };
          setErrorCount(prev => prev + 1);
          setLastErrorType(data.error_type || 'conceptual');
        }
        return updated;
      });

      if (data.is_correct) {
        setPreviousSteps(prev => [...prev, answer]);
        setCurrentStepNumber(prev => prev + 1);
      }
    } catch (error) {
      console.error('Step check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix #3: Retry a failed step — reset it back to active
  const handleStepRetry = (stepIndex: number) => {
    setSteps(prev => {
      const updated = [...prev];
      updated[stepIndex] = {
        ...updated[stepIndex],
        state: 'active',
        feedback: undefined,
        errorType: undefined,
        userAnswer: undefined,
      };
      return updated;
    });
  };

  // --- Handle hint request ---
  const handleRequestHint = async (stepIndex: number, level: number) => {
    if (!activeAttemptId) return;

    try {
      const { getHint } = await import('../../api');
      const data = await getHint(activeAttemptId, level);

      setSteps(prev => {
        const updated = [...prev];
        updated[stepIndex] = {
          ...updated[stepIndex],
          hints: [...updated[stepIndex].hints, { level, text: data.hint_text }],
        };
        return updated;
      });
      setHintsUsedCount(prev => prev + 1);
    } catch (e) {
      console.error('Failed to fetch hint');
    }
  };

  // --- Entry point for sending messages ---
  const handleSend = (userMsg: string) => {
    if (mode === 'general') {
      handleSendGeneral(userMsg);
      return;
    }

    // Brain mode: Detect if it's a general question instead of a step
    if (activeAttemptId && detectTopicSwitch(userMsg)) {
      setModeSwitchCandidate(userMsg);
      return;
    }

    // Normal brain mode problem initialization or step
    handleSendBrain(userMsg);
  };

  const handleApplySwitchSuggestion = () => {
    const msg = modeSwitchCandidate;
    setModeSwitchCandidate(null);
    setMode('general');
    if (msg) handleSendGeneral(msg);
  };

  const handleRetryProblem = () => {
    if (!classification) return;
    setSteps(initializeSteps());
    setCurrentStepNumber(1);
    setPreviousSteps([]);
    setErrorCount(0);
    setLastErrorType(null);
    setHintsUsedCount(0);
    setSosSolution(null);
  };

  // Legacy topic switch handlers removed in favor of modeSwitchCandidate suggestions.

  // --- Mode change ---
  const handleModeChange = (newMode: 'general' | 'brain') => {
    if (newMode === mode) return;
    setMode(newMode);
    // draftInput is NO LONGER reset here. It stays in state.
    // resetBrainState() REMOVED to allow switching back and forth.
  };

  // --- SOS ---
  const handleSos = async () => {
    if (!activeAttemptId) return;
    setIsLoading(true);
    try {
      const { getSos } = await import('../../api');
      const data = await getSos(activeAttemptId);
      
      // Update steps to show SOS state
      setSteps(prev => {
        const updated = [...prev];
        // Mark all remaining steps as 'sos' or 'revealed'
        return updated.map(s => (s.state === 'pending' || s.state === 'active' || s.state === 'incorrect') 
          ? { ...s, state: 'correct' as const, isRevealed: true } : s);
      });

      const lines: string[] = [];
      if (data.solution_steps?.length > 0) {
        data.solution_steps.forEach((step: any) => {
          lines.push(`**Step ${step.step_number}:** ${step.expression}\n_${step.explanation}_`);
        });
      }
      lines.push(`\n**Final Answer:** ${data.final_answer}`);
      
      // Add as a special assistant message in Brain context? 
      // For now, let's store it in a dedicated "result" state in MainChat
      const solution = lines.join('\n\n');
      setSosSolution(solution);
      setClassification(prev => prev ? { ...prev, sosRevealed: true, solution } : null);
    } catch (err) {
      console.error('SOS error:', err);
    } finally {
      setIsLoading(true); // Wait for ThinkingFlow to react
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  // Determine current phase for intelligence panel
  const currentPhase = steps.find(s => s.state === 'active')?.phase || null;

  return (
    <div className={`phi-layout ${mode === 'brain' ? 'phi-layout--brain' : 'phi-layout--general'}`}>
      {showCalculator && (
        <SciCalculator
          onClose={() => setShowCalculator(false)}
          onInsert={() => {}}
        />
      )}

      {/* Header */}
      <div className="phi-header">
        <button onClick={onMenuClick} className="phi-header__menu" aria-label="Open menu">
          <Menu size={20} />
        </button>

        <div className="phi-header__brand">
          <div className="phi-header__logo">Φ</div>
          <span className="phi-header__title">
            Phi<em>Prep</em>
          </span>
        </div>

        <div className="phi-header__spacer" />

        <div className="phi-header__actions">
          {mode === 'brain' && (
            <button
              onClick={() => setShowIntel(!showIntel)}
              className={`phi-header__intel-btn md:hidden ${showIntel ? 'active' : ''}`}
            >
              <Zap size={18} fill={showIntel ? 'currentColor' : 'none'} />
            </button>
          )}
          <div className="phi-header__avatar">
            {profile?.name?.[0]?.toUpperCase() || 'G'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="phi-content">
        {mode === 'general' ? (
          /* === GENERAL MODE === */
          <div className="phi-chat-area">
            <div className="phi-chat-scroll">
              <MessageList
                messages={messages}
                userName={profile?.name}
                isLoading={isLoading}
              />
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          /* === BRAIN MODE === */
          <>
            <div className="phi-thinking-area">
              <div className="phi-thinking-scroll">
                <ThinkingFlow
                  steps={steps}
                  brainData={brainDetails}
                  classification={classification}
                  activeAttemptId={activeAttemptId}
                  isLoading={isLoading}
                  onStepSubmit={handleStepSubmit}
                  onStepRetry={handleStepRetry}
                  onRequestHint={handleRequestHint}
                  sosSolution={sosSolution}
                  onRetryProblem={handleRetryProblem}
                  onSwitchToGeneral={handleApplySwitchSuggestion}
                  modeSwitchCandidate={modeSwitchCandidate}
                />
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Desktop right panel */}
            <div className="phi-intel-desktop">
              <IntelligencePanel
                classification={classification}
                currentPhase={currentPhase}
                currentStepNumber={currentStepNumber}
                totalSteps={4}
                errorCount={errorCount}
                lastErrorType={lastErrorType}
                hintsUsed={hintsUsedCount}
                maxHints={3}
                topicStats={topicStats}
                isActive={!!activeAttemptId}
                brainDetails={brainDetails}
              />
            </div>

            {/* Mobile overlay */}
            {showIntel && (
              <div className="phi-intel-mobile">
                <IntelligencePanel
                  classification={classification}
                  currentPhase={currentPhase}
                  currentStepNumber={currentStepNumber}
                  totalSteps={4}
                  errorCount={errorCount}
                  lastErrorType={lastErrorType}
                  hintsUsed={hintsUsedCount}
                  maxHints={3}
                  topicStats={topicStats}
                  isActive={!!activeAttemptId}
                  brainDetails={brainDetails}
                  isMobile
                  onClose={() => setShowIntel(false)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Bar — always at bottom */}
      <div className="phi-input-wrapper">
        <MessageInput
          mode={mode}
          isLoading={isLoading}
          hasActiveAttempt={!!activeAttemptId}
          draftInput={draftInput}
          onDraftChange={setDraftInput}
          onSend={handleSend}
          onStop={handleStop}
          onModeChange={handleModeChange}
          onImageUpload={(file) => setSelectedImage(file)}
          onSos={handleSos}
          onOpenCalculator={() => setShowCalculator(true)}
        />
      </div>
    </div>
  );
}
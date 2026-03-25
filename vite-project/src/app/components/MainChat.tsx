import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { Send, X, Menu, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PhyPrepLogo } from './PhyPrepLogo';
import { SciCalculator } from './Calculator';
import './MainChat.css';
import { useAuth } from '../context/AuthContext';
import type { ClassificationResult, TopicWeakness } from '../../api';

import { usePhiCursor, PhiCursor } from './usePhiCursor';

// --- Task 1: Smart context switching helpers ---
type ChatType = 'problem' | 'general';

function isNewProblem(input: string): boolean {
  const triggers = ['solve', 'find', 'integrate', 'evaluate', 'derive', 'explain'];
  return triggers.some(t => input.toLowerCase().includes(t));
}

function isContinuation(input: string): boolean {
  const continuationWords = ['next', 'then', 'continue', 'after', 'step', 'now', 'again', 'this', 'previous', 'above'];
  return continuationWords.some(w => input.toLowerCase().includes(w));
}

// --- Task 4: User-friendly error messages ---
function getErrorMessage(type: string): string {
  const map: Record<string, string> = {
    method_selection: "You're solving a different type of problem.",
    conceptual: "There's a conceptual mistake in your approach.",
    calculation: "Check your calculations carefully.",
  };
  return map[type] || 'Something seems off. Try again step by step.';
}

export interface MainChatProps {
  activeChatId?: string | null;
  onChatCreated?: (id: string) => void;
  onMenuClick?: () => void;
  isSidebarCollapsed?: boolean;
}

export function MainChat({ activeChatId, onChatCreated, onMenuClick, isSidebarCollapsed }: MainChatProps) {
  usePhiCursor();
  const { profile } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string, isBrain?: boolean, brainData?: any}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'brain' | 'sos'>('brain');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  
  // Intelligence State
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [brainDetails, setBrainDetails] = useState<{pattern: string, method: string, setup: string, firstStep: string} | null>(null);
  const [topicStats, setTopicStats] = useState<TopicWeakness[]>([]);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [currentStepNumber, setCurrentStepNumber] = useState<number>(1);
  const [previousSteps, setPreviousSteps] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState<Record<number, string>>({});
  const [showIntel, setShowIntel] = useState(false);
  const [chatType, setChatType] = useState<ChatType>('general');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Load dashboard stats on mount
    import('../../api').then(({ getDashboard }) => {
      getDashboard().then(data => {
        setTopicStats([...data.weakest_topics, ...data.improving_topics, ...data.strong_topics].slice(0, 3));
      }).catch(err => console.error("Failed to load dashboard", err));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (activeChatId) {
      setIsLoading(true);
      import('../../api').then(({ getChatMessages }) => {
        getChatMessages(activeChatId).then(msgs => {
          if (cancelled) return;
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
          } else {
            // Fallback to localStorage if backend returns empty
            const saved = localStorage.getItem(`chat_${activeChatId}`);
            if (saved) {
              try { setMessages(JSON.parse(saved)); } catch { setMessages([]); }
            } else {
              setMessages([]);
            }
          }
        }).catch(err => {
          if (cancelled) return;
          console.error('Failed to load messages', err);
          // Fallback to localStorage on API failure
          const saved = localStorage.getItem(`chat_${activeChatId}`);
          if (saved) {
            try { setMessages(JSON.parse(saved)); } catch { setMessages([]); }
          } else {
            setMessages([]);
          }
        }).finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      });
      // Clear pedagogical state on chat switch
      setClassification(null);
      setBrainDetails(null);
      setActiveAttemptId(null);
      setCurrentStepNumber(1);
      setPreviousSteps([]);
      setRevealedHints({});
      setChatType('general');
    }
    return () => { cancelled = true; };
  }, [activeChatId]);

  // Task 3: Save messages to localStorage whenever they change
  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      localStorage.setItem(`chat_${activeChatId}`, JSON.stringify(messages));
    }
  }, [messages, activeChatId]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    
    let userMsg = input.trim();
    if (selectedImage) userMsg = `[Image Uploaded: ${selectedImage.name}]\n` + userMsg;

    // Smart context switching — reset only when a genuinely new problem is detected
    const isProblem = isNewProblem(userMsg);
    const continuation = isContinuation(userMsg);

    let isFreshProblem = false;

    if (activeAttemptId) {
      if (isProblem && !continuation) {
        setActiveAttemptId(null);
        setCurrentStepNumber(1);
        setPreviousSteps([]);
        setRevealedHints({});
        setClassification(null);
        setBrainDetails(null);

        isFreshProblem = true;

        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: "🧠 Starting a new problem..."
          }
        ]);
      }

      if (chatType !== "problem") setChatType("problem");
    } else {
      if (isProblem) setChatType("problem");
    }
    
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '32px';
    }
    setSelectedImage(null);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      let currentSessionId = activeChatId;
      if (!currentSessionId) {
        const { createChat } = await import('../../api');
        const newChat = await createChat(userMsg.substring(0, 30) || "New Chat");
        currentSessionId = newChat.id;
        if (onChatCreated) onChatCreated(newChat.id);
      }

      let responseText = "";
      let isBrainMode = false;
      let brainData = null;
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (activeAttemptId && !isFreshProblem) {
        const { checkStep } = await import('../../api');
        const data = await checkStep(activeAttemptId, currentStepNumber, userMsg, previousSteps);
        
        if (data.is_correct) {
          responseText = `✅ **Correct!**\n\n${data.explanation || "Great job. Keep going."}`;
          setPreviousSteps(prev => [...prev, userMsg]);
          setCurrentStepNumber(prev => prev + 1);
        } else {
          // Task 4: User-friendly error messages
          const friendlyError = getErrorMessage(data.error_type || "conceptual");
          responseText = `❌ **Incorrect**\n\n${friendlyError}`;
          if (data.corrective_guidance) {
            responseText += `\n\n💡 ${data.corrective_guidance}`;
          }
          if (data.correct_step) responseText += `\n\n**Correct Step Revealed:**\n\n$$${data.correct_step}$$`;
        }
      } else {
        if (mode === 'brain') {
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
            firstStep: data.first_step
          });
          
          isBrainMode = true;
          brainData = data;
          responseText = "Let's build your thinking — not hand you the answer.";
        } else {
          const { askDirect } = await import('../../api');
          const data = await askDirect(userMsg, currentSessionId, controller.signal);
          setActiveAttemptId(null);
          responseText = `${data.final_answer}`;
        }
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText, isBrain: isBrainMode, brainData }]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: "Generation stopped by user." }]);
      } else {
        console.error("Failed to send message:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred. Check if the local server is running." }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const renderMessage = (msg: any, idx: number) => {
    return (
      <motion.div 
        key={idx} 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mr ${msg.role === 'user' ? 'u' : 'ai'}`}
      >
        <div className={`mav ${msg.role === 'user' ? 'u' : 'ai'}`}>
          {msg.role === 'user' ? 'D' : 'Φ'}
        </div>
        <div style={{ maxWidth: '86%' }}>
          <div className="bbl">
            <ReactMarkdown 
              remarkPlugins={[remarkMath]} 
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({node, ...props}) => <span {...props} />, // Prevent nested p tags if needed
              }}
            >
              {msg.content.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')}
            </ReactMarkdown>
            
            {msg.isBrain && msg.brainData && (
              <div className="brain-card">
                <div className="bc-lbl">Brain Mode</div>
                <div className="stp">
                  <span className="sn" style={{ fontSize: 11.5 }}>01</span>
                  <span className="st" style={{ fontSize: 12.5 }}><b>Pattern:</b> {msg.brainData.pattern}</span>
                </div>
                <div className="stp">
                  <span className="sn" style={{ fontSize: 11.5 }}>02</span>
                  <span className="st" style={{ fontSize: 12.5 }}><b>Method:</b> {msg.brainData.method}</span>
                </div>
                <div className="stp">
                  <span className="sn">03</span>
                  <span className="st"><b>Setup:</b> {msg.brainData.setup}</span>
                </div>
                <div className="stp">
                  <span className="sn">→</span>
                  <span className="st"><b>First move:</b> {msg.brainData.first_step}</span>
                </div>
                <div className="wh">Answer withheld — work it out ↑ </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="main-container">
      <PhiCursor />
      {showCalculator && (
        <SciCalculator onClose={() => setShowCalculator(false)} onInsert={(val) => setInput(prev => prev + val)} />
      )}

      {/* LEFT: Chat Column */}
      <div className="chat-col">
        {/* New Pro Header */}
        <div className="chat-header" style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--bdr)', background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(20px)', zIndex: 30 }}>
          <button onClick={onMenuClick} className="p-2 text-tlo hover:text-thi transition-colors md:hidden mr-2">
            <Menu size={20}/>
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'var(--bg)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700 }}>Φ</div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--thi)', letterSpacing: '.03em' }}>
              Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button 
              onClick={() => setShowIntel(!showIntel)} 
              className={`p-2 rounded-lg transition-all md:hidden ${showIntel ? 'bg-thi text-bg' : 'text-tlo hover:text-thi'}`}
              title="Show Analysis"
            >
              <Zap size={20} fill={showIntel ? "currentColor" : "none"} />
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--bdr)', margin: '0 4px' }} className="md:hidden" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="pp-nav-btn">Contact</button>
              <button className="pp-nav-btn">About</button>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--s3)', border: '1px solid var(--bdrhi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--thi)' }}>
                {profile?.name ? profile.name[0].toUpperCase() : 'G'}
              </div>
            </div>
          </div>
        </div>

        <div className="msgs-area" style={{ marginLeft: isSidebarCollapsed ? 0 : 0 }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-16 h-16 mb-6 rounded-2xl bg-s4 flex items-center justify-center border border-bdrhi shadow-lg"
              >
                <PhyPrepLogo className="w-10 h-10" />
              </motion.div>
              <h2 className="text-2xl font-bold text-thi mb-2 tracking-tight">How can I help you today?</h2>
              <p className="text-tlo max-w-sm font-medium" style={{ fontSize: 13 }}>Ask any question in Calculus, Algebra, or Mechanics and I'll help you solve it step-by-step.</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => renderMessage(msg, idx))}
              {isLoading && (
                <div className="mr ai">
                  <div className="mav ai">Φ</div>
                  <div className="tbbl">
                    <div className="td"></div><div className="td"></div><div className="td"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="input-bar">
          <div className="input-row">
            <div className="input-icons">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              <button className="iico" onClick={() => fileInputRef.current?.click()} title="Upload image">📷</button>
              <button className="iico" onClick={() => setShowCalculator(true)} title="Calculator">∑</button>
            </div>
            <textarea 
              ref={textareaRef}
              className="main-input" 
              placeholder="Enter something!!" 
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (textareaRef.current) {
                  textareaRef.current.style.height = '32px';
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                }
              }}
              style={{ fontSize: 13 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {isLoading ? (
              <button onClick={handleStop} className="send-btn" style={{background: 'var(--danger)'}}>
                <X size={14} color="white" />
              </button>
            ) : (
              <button className="send-btn" onClick={handleSend} disabled={!input.trim() && !selectedImage}>
                <Send size={13} color="var(--bg)" />
              </button>
            )}
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <div className="mode-tog">
              <button 
                className={`mb-tog brain ${mode === 'brain' ? 'act' : ''}`}
                onClick={() => setMode('brain')}
              >Brain</button>
              <button 
                className={`mb-tog sos ${mode === 'sos' ? 'act' : ''}`}
                onClick={() => setMode('sos')}
              >SOS</button>
            </div>
            {activeAttemptId && (
              <button className="sos-button" onClick={async () => {
                const { getSos } = await import('../../api');
                const data = await getSos(activeAttemptId);
                setMessages(prev => [...prev, { role: 'assistant', content: `**Instant Solution:**\n\n${data.final_answer}` }]);
                setActiveAttemptId(null);
              }}>
                🆘 SOS — show full solution
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Intelligence Column */}
      <div className={`right-grid ${showIntel ? 'mobile-open' : ''}`}>
        {showIntel && (
          <div className="md:hidden flex items-center justify-between p-4 border-bottom border-bdr" style={{ background: 'var(--card)', borderBottom: '1px solid var(--bdr)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--thi)' }}>Phi Intelligence</span>
            <button onClick={() => setShowIntel(false)} className="p-1 text-tlo">
              <X size={18} />
            </button>
          </div>
        )}
        
        {/* Card 1: Concept Clarification */}
        <div className="info-card">
          <div className="card-hd">Concept clarification</div>
          <div className="cc-meta">
            <div className="cc-row">
              <span className="cc-key">Subject</span>
              <span className="cc-val hl">{classification?.subject || '—'}</span>
            </div>
            <div className="cc-row">
              <span className="cc-key">Topic</span>
              <span className="cc-val">{classification?.topic || '—'}</span>
            </div>
            <div className="cc-row">
              <span className="cc-key">Subtopic</span>
              <span className="cc-val">{classification?.subtopic || '—'}</span>
            </div>
            <div className="cc-row">
              <span className="cc-key">Difficulty</span>
              <div>
                <span className="cc-val" style={{textTransform: 'capitalize'}}>{classification?.difficulty.replace('_', ' ') || '—'}</span>
                <div className="diff-row">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className={`dd ${classification ? (
                      (classification.difficulty === 'easy' && n <= 1) ||
                      (classification.difficulty === 'medium' && n <= 2) ||
                      (classification.difficulty === 'hard' && n <= 3) ||
                      (classification.difficulty === 'jee_advanced' && n <= 4)
                    ) ? 'on' : '' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card-divider"></div>
          <div className="cc-section-lbl">Pattern</div>
          <div className="cc-pattern">{brainDetails?.pattern || 'Waiting for input...'}</div>
          <div className="cc-section-lbl" style={{marginTop:8}}>Method</div>
          <div className="cc-method">
            <div className="cc-method-lbl">Approach</div>
            {brainDetails?.method || 'The pedagogical strategy will appear here.'}
          </div>
        </div>

        {/* Card 2: Formula or Definition */}
        <div className="info-card">
          <div className="card-hd" style={{ fontSize: 12.5 }}>Formula or definition</div>
          <div className="formula-item">
            <div className="fi-label">TOPIC DEFINITION</div>
            <div className="fi-val">
              {classification?.definition ?? (classification
                ? `${classification.topic}: A core concept in ${classification.subject}.`
                : 'Knowledge base is idle.')}
            </div>
          </div>
          <div className="formula-item">
            <div className="fi-label">KEY FORMULA</div>
            <div className="fi-val formula scrollable-box">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {classification?.formula ?? (
                  classification
                    ? classification.subject === 'Mathematics'
                      ? '$∫ u \, dv = uv - ∫ v \, du$'
                      : classification.subject === 'Physics'
                        ? '$F = ma$'
                        : '$PV = nRT$'
                    : '—')}
              </ReactMarkdown>
            </div>
          </div>
          <div className="formula-item">
            <div className="fi-label">RELATED CASES</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {['Standard Case', 'Advanced', 'Corner case'].map(tag => (
                <span key={tag} className="related-tag" style={{ fontSize: 11.5 }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Hints (Redesigned) */}
        <div className="info-card">
          <div className="card-hd" style={{ fontSize: 12.5 }}>Hints</div>
          
          <div className="hint-card-new">
            {[1, 2, 3].map(lvl => (
              <div 
                key={lvl} 
                className="hint-row"
                style={{ cursor: (!activeAttemptId || revealedHints[lvl]) ? 'default' : 'pointer' }}
                onClick={async () => {
                  if (!activeAttemptId || revealedHints[lvl]) return;
                  if (lvl > 1 && !revealedHints[lvl - 1]) return; // sequential constraint
                  
                  const { getHint } = await import('../../api');
                  try {
                    const data = await getHint(activeAttemptId, lvl);
                    setRevealedHints(prev => ({ ...prev, [lvl]: data.hint_text }));
                  } catch (e) {
                    console.error("Failed to fetch hint");
                  }
                }}
              >
                <div className="hint-lvl">H{lvl}</div>
                <div className="hint-body">
                  {revealedHints[lvl] ? (
                    <div style={{ color: 'var(--thi)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tlo)', marginBottom: 2 }}>{lvl === 1 ? 'Concept hint' : lvl === 2 ? 'Approach hint' : 'Final hint'}</div>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {revealedHints[lvl]}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--tlo)' }}>{lvl === 1 ? 'Concept hint' : lvl === 2 ? 'Approach hint' : 'Final hint'}</span>
                  )}
                </div>
                {revealedHints[lvl] && <div className="hint-check">✓</div>}
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--tlo)', textAlign: 'center', fontStyle: 'italic' }}>
            {Object.keys(revealedHints).length === 3 
              ? "You've seen all hints — now trust yourself and solve it. You're got this. 💪"
              : "Hints unlock as you progress"}
          </div>
        </div>

        {/* Card 4: Topic Understanding */}
        <div className="info-card">
          <div className="card-hd">Topic Understanding</div>
          <div className="tu-topic">
            Strength in <strong>{classification?.topic || 'current topic'}</strong>:
          </div>
          
          <div className="tu-bar-wrap">
            <div className="tu-bar-label">
              <span>Overall Accuracy</span>
              <span>{classification ? '68%' : '—'}</span>
            </div>
            <div className="tu-track">
              <div className="tu-fill" style={{width: classification ? '68%' : '0%'}}></div>
            </div>
          </div>

          <div className="tu-tags">
            <span className="tu-tag strong">Concept Ready</span>
            <span className="tu-tag ok">Calculation</span>
            <span className="tu-tag weak">IBP Patterns</span>
          </div>

          <div className="tu-sessions">
            <div className="tu-sessions-lbl">Recent Activity</div>
            {topicStats.length > 0 ? topicStats.map((s, i) => (
              <div key={i} className="tu-session-row">
                <div className={`ts-dot ${s.status === 'green' ? 'g' : s.status === 'yellow' ? 'y' : 'r'}`}></div>
                <div className="ts-topic">{s.topic}</div>
                <div className="ts-track">
                  <div className={`ts-fill ${s.status === 'green' ? 'g' : s.status === 'yellow' ? 'y' : 'r'}`} style={{width: `${s.accuracy_pct}%`}}></div>
                </div>
                <div className="ts-pct">{Math.round(s.accuracy_pct)}%</div>
              </div>
            )) : [
              { t: 'Integration', p: 85, s: 'g' },
              { t: 'Differentiation', p: 40, s: 'y' },
              { t: 'Limits', p: 20, s: 'r' }
            ].map((s, i) => (
              <div key={i} className="tu-session-row">
                <div className={`ts-dot ${s.s}`}></div>
                <div className="ts-topic">{s.t}</div>
                <div className="ts-track">
                  <div className={`ts-fill ${s.s}`} style={{width: `${s.p}%`}}></div>
                </div>
                <div className="ts-pct">{s.p}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

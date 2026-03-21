import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { AlignLeft, BookOpen, Code, Lightbulb, Send, Sparkles, Loader2, Image as ImageIcon, X, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CognifyLogo } from './CognifyLogo';
import { FloatingKeyboard } from './FloatingKeyboard';
import { SciCalculator } from './Calculator';

const suggestions = [
  { icon: AlignLeft, text: "JEE Advanced", desc: "Solve complex multi-concept mechanics problems", color: "text-[#3B82F6]" },
  { icon: Code, text: "Step-by-step", desc: "Break down integration by parts", color: "text-[#10B981]" },
  { icon: Lightbulb, text: "SOS Mode", desc: "Get an instant direct solution", color: "text-[#F59E0B]" },
  { icon: BookOpen, text: "Explain a Concept", desc: "Understand the basics of Electromagnetism", color: "text-[#8B5CF6]" }
];

export interface MainChatProps {
  activeChatId?: string | null;
  onChatCreated?: (id: string) => void;
  onMenuClick?: () => void;
}

export function MainChat({ activeChatId, onChatCreated, onMenuClick }: MainChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'brain' | 'sos'>('brain');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  
  // F5/F6 Interactive State
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [currentStepNumber, setCurrentStepNumber] = useState<number>(1);
  const [previousSteps, setPreviousSteps] = useState<string[]>([]);
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [hasUsedAllHints, setHasUsedAllHints] = useState<boolean>(false);
  
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
    if (activeChatId) {
      setIsLoading(true);
      import('../../api').then(({ getChatMessages }) => {
        getChatMessages(activeChatId).then(msgs => {
          setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
        }).catch(err => {
          console.error('Failed to load messages', err);
          setMessages([]);
        }).finally(() => {
          setIsLoading(false);
        });
      });
      setMessages([]);
      setActiveAttemptId(null);
      setCurrentStepNumber(1);
      setPreviousSteps([]);
      setHintLevel(1);
      setHasUsedAllHints(false);
    }
  }, [activeChatId]);

  const handleGetHint = async () => {
    if (!activeAttemptId || isLoading) return;
    setIsLoading(true);
    try {
      const { getHints } = await import('../../api');
      const data = await getHints(activeAttemptId, hintLevel);
      setMessages(prev => [...prev, { role: 'assistant', content: `**Hint ${data.hint_level}:** ${data.hint_text}` }]);
      if (data.next_hint_available && data.hint_level < 3) {
        setHintLevel(prev => prev + 1);
      } else {
        setHasUsedAllHints(true);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Hint unavailable at this time." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    
    let userMsg = input.trim();
    if (selectedImage) userMsg = `[Image Uploaded: ${selectedImage.name}]\n` + userMsg;
    
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
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
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (activeAttemptId) {
        // F6: We are submitting a step for an active problem
        const { checkStep } = await import('../../api');
        const data = await checkStep(activeAttemptId, currentStepNumber, userMsg, previousSteps);
        
        if (data.is_correct) {
          responseText = `✅ **Correct!**\n\n${data.explanation || "Great job. Keep going."}`;
          setPreviousSteps(prev => [...prev, userMsg]);
          setCurrentStepNumber(prev => prev + 1);
        } else {
          responseText = `❌ **Incorrect**\n\n**Error Type:** \`${data.error_type || "conceptual"}\`\n\n${data.explanation || ""}`;
          if (data.corrective_guidance) {
            responseText += `\n\n💡 *Direction:* ${data.corrective_guidance}`;
          }
          if (data.correct_step) {
            responseText += `\n\n**Correct Step Revealed:**\n\n$$${data.correct_step}$$`;
          }
        }
      } else {
        // Submitting a brand new problem
        if (mode === 'brain') {
          const { askQuestion } = await import('../../api');
          const data = await askQuestion(userMsg, currentSessionId, controller.signal);
          setActiveAttemptId(data.attempt_id);
          setCurrentStepNumber(1);
          setPreviousSteps([]);
          setHintLevel(1);
          setHasUsedAllHints(false);
          responseText = [
            `**Pattern:** ${data.pattern}`,
            `**Method:** ${data.method}`,
            `**Setup:** ${data.setup}`,
            `**First Step:** ${data.first_step}`,
          ].join('\n\n');
        } else {
          // SOS Mode
          const { askDirect } = await import('../../api');
          const data = await askDirect(userMsg, currentSessionId, controller.signal);
          setActiveAttemptId(null);
          responseText = [
            `**Instant Solution:**`,
            `\n\n${data.final_answer}`,
          ].join('\n\n');
        }
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full w-full mx-auto z-10 px-4 md:px-0 bg-transparent">
      
      {/* Mobile Header Menu Button */}
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button 
          onClick={onMenuClick}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
        >
          <Menu size={20} />
        </button>
      </div>

      {showCalculator && (
        <SciCalculator onClose={() => setShowCalculator(false)} onInsert={(val) => setInput(prev => prev + val)} />
      )}

      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto pt-16 pb-10 [&::-webkit-scrollbar]:hidden scroll-smooth w-full flex justify-center">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full max-w-[800px] mt-[5vh]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center mb-16 relative"
            >
              <div className="relative mb-8 group cursor-default">
                <div className="absolute inset-[-40px] bg-gradient-to-r from-[#7C3AED]/20 to-[#4F46E5]/20 blur-[50px] opacity-60 animate-pulse duration-[3000ms] rounded-full mix-blend-screen"></div>
                <div className="w-[84px] h-[84px] rounded-3xl bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/[0.08] flex items-center justify-center shadow-[0_0_80px_rgba(124,58,237,0.2)] relative z-10 hover:border-[#7C3AED]/40 transition-all duration-700">
                  <CognifyLogo className="w-12 h-12" />
                </div>
              </div>
              <h1 className="text-[36px] md:text-[52px] font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] to-[#A1A1AA] text-center mb-4 tracking-tight leading-none px-4">
                How can I help you today?
              </h1>
              <p className="text-[#A1A1AA] text-lg font-medium tracking-wide">Premium intelligence at your fingertips.</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full relative z-20 px-4 md:px-0"
            >
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(item.text + ": ")}
                  className="group flex flex-col items-start p-6 rounded-[20px] bg-[#0A0A0A]/40 backdrop-blur-md border border-white/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-[#7C3AED]/40 hover:bg-[#0A0A0A]/60 transition-all duration-500 text-left relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="flex items-center gap-4 mb-3 relative z-10">
                    <div className="w-10 h-10 rounded-[12px] bg-white/[0.03] border border-white/[0.05] flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                      <item.icon className={`w-[18px] h-[18px] ${item.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                    </div>
                    <span className="font-semibold text-[#EDEDED] text-[16px] tracking-tight">{item.text}</span>
                  </div>
                  <span className="text-[14px] text-[#A1A1AA] group-hover:text-[#D4D4D8] transition-colors leading-relaxed relative z-10">
                    {item.desc}
                  </span>
                </button>
              ))}
            </motion.div>
            <div className="h-[200px] shrink-0 w-full" />
          </div>
        ) : (
          <div className="max-w-[800px] w-full mx-auto flex flex-col gap-8 pb-10 mt-6 px-4 md:px-0">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-5 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0A0A0A] to-[#1A1A1A] border border-white/[0.08] flex items-center justify-center shadow-lg shrink-0 mt-1">
                      <CognifyLogo className="w-[22px] h-[22px]" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`px-5 py-3.5 rounded-[22px] text-[15px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#EDEDED] text-[#000000] rounded-br-sm font-medium' 
                          : 'bg-[#0A0A0A]/60 backdrop-blur-md border border-white/[0.06] text-[#EDEDED] rounded-bl-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#1A1A1A] prose-pre:border prose-pre:border-gray-800 focus:outline-none'
                      }`}
                    >
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex gap-5 w-full justify-start"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0A0A0A]/60 border border-white/[0.08] flex items-center justify-center shadow-lg shrink-0 mt-1">
                    <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" />
                  </div>
                  <div className="flex items-center px-5 py-3.5 rounded-[22px] rounded-bl-sm bg-[#0A0A0A]/60 backdrop-blur-md border border-white/[0.06]">
                    <span className="text-[#A1A1AA] text-sm animate-pulse flex gap-1 items-center">
                      <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" /> Thinking...
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="h-[200px] shrink-0 w-full" />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pt-24 bg-gradient-to-t from-[#000000] via-[#000000]/95 to-transparent z-30 flex justify-center pb-8 border-t-0">
        <div className="max-w-[800px] w-full relative group">
          
          {/* Custom Form elements */}
          <div className="relative">
            {/* Soft background aura */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-[#7C3AED]/40 to-[#4F46E5]/40 rounded-[32px] blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            
            <div className="relative flex flex-col bg-[#0A0A0A]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[28px] p-2 shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-500 group-focus-within:border-[#7C3AED]/50 group-focus-within:bg-[#0A0A0A]/95 group-focus-within:shadow-[0_0_50px_rgba(124,58,237,0.15)]">
              
              {/* Keyboard Row */}
              <FloatingKeyboard onInsert={(sym) => setInput(p => p + sym)} onOpenCalculator={() => setShowCalculator(true)} />
              
              {/* Image Preview */}
              {selectedImage && (
                <div className="flex items-center gap-3 px-4 py-2 mt-4 ml-2 max-w-max bg-white/5 rounded-xl border border-white/10">
                  <div className="w-8 h-8 rounded shrink-0 bg-gray-800 flex items-center justify-center overflow-hidden">
                    <ImageIcon size={16} className="text-gray-400" />
                  </div>
                  <span className="text-sm truncate text-gray-300 max-w-[150px]">{selectedImage.name}</span>
                  <button onClick={() => setSelectedImage(null)} className="text-gray-500 hover:text-white transition-colors ml-2">
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-end px-2 pb-1 pt-1 mt-6">
                
                {/* Mode Toggle & Image Upload */}
                <div className="flex items-center gap-2 mb-1 shrink-0 px-2 h-10">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors" title="Upload Image">
                    <ImageIcon size={20} />
                  </button>
                  
                  {/* Hint and Solution Buttons */}
                  <div className="flex items-center gap-2">
                    {activeAttemptId ? (
                      <div className="flex items-center bg-black/50 rounded-xl p-1 border border-white/10 gap-1">
                        <button 
                          onClick={handleGetHint}
                          disabled={isLoading || hasUsedAllHints}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-purple-900/30 text-purple-300 border border-purple-500/30 shadow-lg flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                        >
                          <Lightbulb size={12} /> {hasUsedAllHints ? 'Hints Exhausted' : 'Get Hint'}
                        </button>
                        <button 
                          onClick={async () => {
                            if (!activeAttemptId || isLoading) return;
                            setIsLoading(true);
                            try {
                              const { getSos } = await import('../../api');
                              const data = await getSos(activeAttemptId);
                              
                              let formattedSos = "**Instant Solution:**\n\n";
                              if (data.solution_steps && data.solution_steps.length > 0) {
                                data.solution_steps.forEach((s: any) => {
                                  formattedSos += `**Step ${s.step_number}:** ${s.expression}\n_${s.explanation}_\n\n`;
                                });
                              }
                              formattedSos += `**Final Answer:** ${data.final_answer}`;

                              setMessages(prev => [...prev, { role: 'assistant', content: formattedSos }]);
                              setHasUsedAllHints(false);
                              setActiveAttemptId(null); // End the step-by-step session
                            } catch (e) {
                              setMessages(prev => [...prev, { role: 'assistant', content: "Failed to load SOS solution." }]);
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-900/30 text-red-400 border border-red-800/50 shadow-lg flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Lightbulb size={12} /> Solution
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => setMode('brain')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'brain' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-lg' : 'text-gray-500 hover:text-gray-300'} flex items-center gap-1.5`}
                        >
                          <Sparkles size={12} /> Brain 
                        </button>
                        <button 
                          onClick={() => setMode('sos')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'sos' ? 'bg-red-900/30 text-red-400 border border-red-800/50 shadow-lg' : 'text-gray-500 hover:text-gray-300'} flex items-center gap-1.5`}
                        >
                          <Lightbulb size={12} /> SOS
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (textareaRef.current) {
                      textareaRef.current.style.height = '44px';
                      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || selectedImage) handleSend();
                    }
                  }}
                  placeholder={activeAttemptId ? "Enter your next step..." : `Ask Cognify in ${mode === 'brain' ? 'Brain' : 'SOS'} Mode...`}
                  className="flex-1 bg-transparent border-none outline-none text-[#EDEDED] placeholder-[#71717A] text-[15px] py-2 px-3 pl-4 font-normal tracking-wide resize-none min-h-[44px] max-h-[120px] leading-relaxed"
                  rows={1}
                  style={{ height: '44px' }}
                />
                
                {isLoading ? (
                  <button 
                    onClick={handleStop}
                    className="p-3 mb-1 ml-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 h-[44px] w-[44px]"
                  >
                    <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && !selectedImage) || isLoading}
                    className={`p-3 mb-1 ml-2 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 h-[44px] w-[44px] ${
                      (input.trim() || selectedImage) && !isLoading
                        ? 'bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] cursor-pointer' 
                        : 'bg-white/[0.04] text-[#52525B] cursor-not-allowed'
                    }`}
                  >
                    <Send className={`w-[18px] h-[18px] ml-0.5 ${(input.trim() || selectedImage) && !isLoading ? 'translate-x-[2px] -translate-y-[2px] transition-transform' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-center mt-3 text-[11px] text-[#71717A] font-medium tracking-wide">
            Cognify can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}

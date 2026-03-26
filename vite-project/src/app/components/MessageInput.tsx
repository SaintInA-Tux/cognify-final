import { useState, useRef, useEffect } from 'react';
import { Send, X, Camera, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MessageInputProps {
  mode: 'general' | 'brain';
  isLoading: boolean;
  hasActiveAttempt: boolean;
  draftInput: string;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onStop: () => void;
  onModeChange: (mode: 'general' | 'brain') => void;
  onImageUpload?: (file: File) => void;
  onSos?: () => void;
  onOpenCalculator?: () => void;
}

export function MessageInput({
  mode,
  isLoading,
  hasActiveAttempt,
  draftInput,
  onDraftChange,
  onSend,
  onStop,
  onModeChange,
  onImageUpload,
  onSos,
  onOpenCalculator,
}: MessageInputProps) {
  const [showBrainHelp, setShowBrainHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!draftInput.trim() || isLoading) return;
    onSend(draftInput.trim());
    onDraftChange('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && onImageUpload) {
      onImageUpload(e.target.files[0]);
    }
  };

  // Close brain help when clicking outside
  useEffect(() => {
    if (!showBrainHelp) return;
    const handler = () => setShowBrainHelp(false);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [showBrainHelp]);

  return (
    <div className="msg-input">
      <div className="msg-input__row">
        <div className="msg-input__icons">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageChange}
          />
          <button
            className="msg-input__icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload image"
          >
            <Camera size={16} />
          </button>
          {onOpenCalculator && (
            <button
              className="msg-input__icon-btn"
              onClick={onOpenCalculator}
              title="Calculator"
            >
              ∑
            </button>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="msg-input__field"
          placeholder={mode === 'brain' ? 'Enter a problem to solve...' : ''}
          rows={1}
          value={draftInput}
          onChange={(e) => {
            onDraftChange(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = '36px';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {isLoading ? (
          <button onClick={onStop} className="msg-input__send msg-input__send--stop">
            <X size={14} color="white" />
          </button>
        ) : (
          <button
            className="msg-input__send"
            onClick={handleSend}
            disabled={!draftInput.trim()}
          >
            <Send size={14} />
          </button>
        )}
      </div>

      <div className="msg-input__footer">
        <div className="msg-input__mode-area">
          <div className="msg-input__mode-toggle">
            <button
              className={`msg-input__mode-btn ${mode === 'general' ? 'msg-input__mode-btn--active' : ''}`}
              onClick={() => onModeChange('general')}
            >
              General
            </button>
            <button
              className={`msg-input__mode-btn ${mode === 'brain' ? 'msg-input__mode-btn--active' : ''}`}
              onClick={() => onModeChange('brain')}
            >
              Brain
            </button>
          </div>

          {/* Fix #4: Brain Mode help tooltip */}
          <div className="msg-input__help-wrap">
            <button
              className="msg-input__help-btn"
              onClick={(e) => { e.stopPropagation(); setShowBrainHelp(!showBrainHelp); }}
              title="How Brain Mode works"
            >
              <Info size={14} />
            </button>

            <AnimatePresence>
              {showBrainHelp && (
                <motion.div
                  className="msg-input__help-tooltip"
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="msg-input__help-title">How Brain Mode Works</div>
                  <div className="msg-input__help-steps">
                    <div className="msg-input__help-step">
                      <span className="msg-input__help-num">01</span>
                      <span><strong>Understand</strong> — Break down what's given</span>
                    </div>
                    <div className="msg-input__help-step">
                      <span className="msg-input__help-num">02</span>
                      <span><strong>Identify</strong> — Recognize the pattern</span>
                    </div>
                    <div className="msg-input__help-step">
                      <span className="msg-input__help-num">03</span>
                      <span><strong>Apply</strong> — Set up the method</span>
                    </div>
                    <div className="msg-input__help-step">
                      <span className="msg-input__help-num">04</span>
                      <span><strong>Solve</strong> — Execute the calculation</span>
                    </div>
                  </div>
                  <div className="msg-input__help-note">
                    We won't give you the answer — we'll train you to find it.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {mode === 'brain' && hasActiveAttempt && onSos && (
          <button className="msg-input__sos" onClick={onSos}>
            🆘 Show full solution
          </button>
        )}
      </div>
    </div>
  );
}

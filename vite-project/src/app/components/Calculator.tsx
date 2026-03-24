import React, { useState, useEffect } from 'react';
import { PhiCursor } from './usePhiCursor';
import './Calculator.css';

interface SciCalculatorProps {
  onClose: () => void;
  onInsert: (result: string) => void;
}

export const SciCalculator: React.FC<SciCalculatorProps> = ({ onClose, onInsert }) => {
  const [expr, setExpr] = useState('');
  const [lastAns, setLastAns] = useState('0');
  const [displayRes, setDisplayRes] = useState('0');
  const [shOn, setShOn] = useState(false);
  const [alOn, setAlOn] = useState(false);
  const [ang, setAng] = useState<'RAD' | 'DEG'>('RAD');
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const safeEval = (raw: string, mode: 'RAD' | 'DEG') => {
    let s = raw
      .replace(/π/g, '(Math.PI)')
      .replace(/√\(/g, 'Math.sqrt(')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/sin\(/g, mode === 'DEG' ? '((x:number)=>Math.sin(x*Math.PI/180))(' : 'Math.sin(')
      .replace(/cos\(/g, mode === 'DEG' ? '((x:number)=>Math.cos(x*Math.PI/180))(' : 'Math.cos(')
      .replace(/tan\(/g, mode === 'DEG' ? '((x:number)=>Math.tan(x*Math.PI/180))(' : 'Math.tan(')
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    
    try {
      // Basic check for dangerous characters
      if (/[^0-9+\-*/()., MathPIsqrtloglnsincostan,e]/.test(s.replace(/Math\.[a-z0-9]+/g, ''))) {
          // Allow some characters but be careful
      }
      const fn = new Function('x', '"use strict"; return (' + s + ')');
      const r = fn();
      if (typeof r !== 'number') throw new Error('type');
      return r;
    } catch (e) {
      throw e;
    }
  };

  const fmtN = (n: number) => {
    if (!isFinite(n)) throw new Error('e');
    if (Math.abs(n) >= 1e10 || (Math.abs(n) < 1e-6 && n !== 0))
      return n.toExponential(6).replace(/\.?0+(e)/, '$1');
    return parseFloat(n.toPrecision(10)).toString();
  };

  const handleExe = () => {
    if (!expr.trim()) return;
    try {
      const r = safeEval(expr.replace(/=/g, ''), ang);
      const resultStr = fmtN(r);
      setLastAns(resultStr);
      setDisplayRes(resultStr);
      setExpr(expr.split('=')[0] + ' =');
      setIsError(false);
    } catch (e) {
      setDisplayRes('Math ERROR');
      setIsError(true);
      setExpr('');
    }
  };

  const handleAC = () => {
    setExpr('');
    setLastAns('0');
    setDisplayRes('0');
    setIsError(false);
  };

  const handleIn = (ch: string) => {
    setExpr(prev => prev.includes('=') ? ch : prev + ch);
    setShOn(false);
    setAlOn(false);
    setIsError(false);
  };

  const handleDel = () => {
    if (expr.includes('=')) {
      setExpr('');
    } else {
      setExpr(prev => prev.slice(0, -1));
    }
  };

  const handleFn = (fn: string) => {
    if (fn === 'pi') setExpr(prev => prev + 'π');
    else if (fn === 'sqrt') setExpr(prev => prev + '√(');
    else if (fn === 'ans') setExpr(prev => prev + lastAns);
    else if (fn === 'neg') setExpr(prev => prev + '(-');
    else if (fn === 'exe') handleExe();
    setShOn(false);
    setAlOn(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 240);
  };

  const handleSendToChat = () => {
    if (!lastAns || lastAns === '0' || isError) return;
    onInsert(lastAns);
    handleClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[500] bg-black/65 backdrop-blur-[6px] transition-opacity duration-[240ms]" 
        style={{ opacity: isVisible ? 1 : 0 }}
        onClick={handleClose}
      />
      
      <div 
        className="fixed top-1/2 left-1/2 z-[501] transition-all duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ 
          transform: isVisible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -48%) scale(0.96)',
          opacity: isVisible ? 1 : 0
        }}
      >
        <div id="casio">
          <PhiCursor />
          
          <div className="cbrand">
            <div>
              <div className="cbrand-name">CASIO</div>
              <div className="cbrand-model">fx-991EX</div>
            </div>
            <div>
              <div className="cbrand-cw">ClassWiz</div>
              <div className="cbrand-sub">Natural-V.P.A.M.</div>
            </div>
            <button className="cclose" onClick={handleClose}>×</button>
          </div>

          <div className="cdisp">
            <div className="cdisp-bar">
              <span className="on">COMP</span>
              <span className={ang === 'DEG' ? 'on' : ''}>DEG</span>
              <span className={ang === 'RAD' ? 'on' : ''}>RAD</span>
              <span className={shOn ? 'on' : ''}>S</span>
              <span className={alOn ? 'on' : ''}>A</span>
              <span className="on">Norm1</span>
            </div>
            <div className="cdisp-expr">{expr}</div>
            <div className={`cdisp-result ${isError ? 'cerr' : ''}`}>{displayRes}</div>
          </div>

          <div className="chat-bar">
            <div className={`chat-preview ${lastAns !== '0' && !isError ? 'has-val' : ''}`}>
              {isError ? 'Error' : lastAns !== '0' ? lastAns : 'result will appear here'}
            </div>
            <button className="chat-send-btn" onClick={handleSendToChat}>
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              Send to chat
            </button>
          </div>

          <div className="ang-pill">
            <button className={`ang-btn ${ang === 'RAD' ? 'active' : ''}`} onClick={() => setAng('RAD')}>RAD</button>
            <button className={`ang-btn ${ang === 'DEG' ? 'active' : ''}`} onClick={() => setAng('DEG')}>DEG</button>
          </div>

          <div className="cbarea">
            <div className="crow">
              <button className="ck ck-sh" style={{ opacity: shOn ? 1 : 0.5 }} onClick={() => {setShOn(!shOn); setAlOn(false)}}>
                <span className="ck-lbl">SHIFT</span>
              </button>
              <button className="ck ck-al" style={{ opacity: alOn ? 1 : 0.5 }} onClick={() => {setAlOn(!alOn); setShOn(false)}}>
                <span className="ck-lbl">ALPHA</span>
              </button>
              <button className="ck ck-dk" onClick={handleDel}>
                <span className="ck-top sh">INS</span>
                <span className="ck-lbl">DEL</span>
              </button>
              <button className="ck ck-ac" onClick={handleAC}>
                <span className="ck-top sh">OFF</span>
                <span className="ck-lbl">AC</span>
              </button>
            </div>

            <div className="crow">
              {['log(', 'ln(', 'sin(', 'cos(', 'tan('].map((f, i) => (
                <button key={f} className="ck ck-dk" onClick={() => handleIn(f)}>
                  <span className="ck-top sh">{['10ˣ', 'eˣ', 'sin⁻¹', 'cos⁻¹', 'tan⁻¹'][i]}</span>
                  <span className="ck-lbl">{f.slice(0, -1)}</span>
                </button>
              ))}
            </div>

            <div className="crow">
              <button className="ck ck-dk" onClick={() => handleIn('**2')}>
                <span className="ck-top sh">√</span>
                <span className="ck-lbl">x²</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleIn('**(')}>
                <span className="ck-top sh">ˣ√</span>
                <span className="ck-lbl">xʸ</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleIn('(')}>
                <span className="ck-lbl">(</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleIn(')')}>
                <span className="ck-lbl">)</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleFn('pi')}>
                <span className="ck-top sh">e</span>
                <span className="ck-lbl">π</span>
              </button>
            </div>

            <div className="crow">
              <button className="ck ck-dk" onClick={() => handleFn('sqrt')}>
                <span className="ck-top sh">x²</span>
                <span className="ck-lbl">√</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleFn('neg')}>
                <span className="ck-lbl">(−)</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleIn(',')}>
                <span className="ck-lbl">,</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleIn('**')}>
                <span className="ck-lbl">^</span>
              </button>
              <button className="ck ck-dk" onClick={() => handleFn('ans')}>
                <span className="ck-lbl">Ans</span>
              </button>
            </div>

            <div className="csep"></div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <div className="dpad">
                <div></div>
                <button className="ck ck-nav"><span className="ck-lbl">▲</span></button>
                <div></div>
                <button className="ck ck-nav"><span className="ck-lbl">◀</span></button>
                <button className="ck ck-ctr" onClick={handleExe}><span className="ck-lbl">OK</span></button>
                <button className="ck ck-nav"><span className="ck-lbl">▶</span></button>
                <div></div>
                <button className="ck ck-nav"><span className="ck-lbl">▼</span></button>
                <div></div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="crow" style={{ margin: 0 }}>
                  <button className="ck ck-op" onClick={() => handleIn('*')}><span className="ck-lbl">×</span></button>
                  <button className="ck ck-op" onClick={() => handleIn('/')}><span className="ck-lbl">÷</span></button>
                </div>
                <div className="crow" style={{ margin: 0 }}>
                  <button className="ck ck-op" onClick={() => handleIn('+')}><span className="ck-lbl">+</span></button>
                  <button className="ck ck-op" onClick={() => handleIn('-')}><span className="ck-lbl">−</span></button>
                </div>
              </div>
            </div>

            <div className="crow">
              {[7, 8, 9].map(n => (
                <button key={n} className="ck ck-nm" onClick={() => handleIn(n.toString())}><span className="ck-lbl">{n}</span></button>
              ))}
            </div>
            <div className="crow">
              {[4, 5, 6].map(n => (
                <button key={n} className="ck ck-nm" onClick={() => handleIn(n.toString())}><span className="ck-lbl">{n}</span></button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="crow" style={{ margin: 0 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} className="ck ck-nm" onClick={() => handleIn(n.toString())}><span className="ck-lbl">{n}</span></button>
                  ))}
                </div>
                <div className="crow" style={{ margin: 0 }}>
                  <button className="ck ck-nm ck-w2" onClick={() => handleIn('0')}><span className="ck-lbl">0</span></button>
                  <button className="ck ck-nm" onClick={() => handleIn('.')}><span className="ck-lbl">.</span></button>
                </div>
              </div>
              <button className="ck ck-ex" style={{ flex: 1, minHeight: 'auto' }} onClick={handleExe}>
                <span className="ck-lbl">EXE</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

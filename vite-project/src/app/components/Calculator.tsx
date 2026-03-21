import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SciCalculatorProps {
  onClose: () => void;
  onInsert: (result: string) => void;
}

export const SciCalculator: React.FC<SciCalculatorProps> = ({ onClose, onInsert }) => {
  const [display, setDisplay] = useState('');

  const handleBtn = (val: string) => {
    setDisplay(prev => prev + val);
  };

  const handleClear = () => setDisplay('');
  const handleBackspace = () => setDisplay(prev => prev.slice(0, -1));

  const handleEvaluate = () => {
    try {
      // In a real app we would use mathjs here. For now just basic eval with error catching
      // NOTE: Using native eval for simplicity in this visual mockup.
      const sanitized = display.replace(/×/g, '*').replace(/÷/g, '/');
      const result = new Function('return ' + sanitized)();
      setDisplay(String(result));
    } catch (e) {
      setDisplay('Error');
      setTimeout(() => setDisplay(''), 1500);
    }
  };

  const handleInsert = () => {
    if (display && display !== 'Error') {
      onInsert(display);
      onClose();
    }
  };

  const buttons = [
    ['sin', 'cos', 'tan', 'C', '⌫'],
    ['(', ')', '^', '√', '÷'],
    ['7', '8', '9', '×', 'DEL'],
    ['4', '5', '6', '-', 'Ans'],
    ['1', '2', '3', '+', '='],
    ['0', '.', 'EXP', 'π', 'INSERT']
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-gray-800 rounded-3xl overflow-hidden w-full max-w-[360px] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-[#1A1A1A] border-b border-gray-800">
          <span className="text-gray-400 font-medium text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            fx-991EX Simulator
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Display */}
        <div className="p-6 bg-[#0A0A0A]">
          <div className="bg-[#D1D5DB] p-4 rounded-xl font-mono text-right text-black shadow-inner min-h-[80px] flex flex-col justify-end">
            <div className="text-sm text-gray-500 min-h-[20px]"></div>
            <div className="text-3xl font-medium tracking-tight overflow-x-auto whitespace-nowrap no-scrollbar">
              {display || '0'}
            </div>
          </div>
        </div>

        {/* Keypad */}
        <div className="p-4 grid grid-cols-5 gap-2 bg-[#1A1A1A]">
          {buttons.flat().map((btn, idx) => {
            let color = "bg-[#2A2A2A] text-gray-200 hover:bg-[#3A3A3A]"; // Default numbers/ops
            if (['C', '⌫', 'DEL'].includes(btn)) color = "bg-red-900/40 text-red-400 hover:bg-red-900/60";
            if (['=', 'INSERT'].includes(btn)) color = "bg-indigo-600 text-white hover:bg-indigo-500 font-medium";
            
            return (
              <button
                key={`${btn}-${idx}`}
                onClick={() => {
                  if (btn === 'C') handleClear();
                  else if (btn === '⌫' || btn === 'DEL') handleBackspace();
                  else if (btn === '=') handleEvaluate();
                  else if (btn === 'INSERT') handleInsert();
                  else handleBtn(btn);
                }}
                className={`flex items-center justify-center p-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 active:scale-95 ${color}`}
              >
                {btn}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Calculator } from 'lucide-react';

interface FloatingKeyboardProps {
  onInsert: (symbol: string) => void;
  onOpenCalculator: () => void;
}

const symbols = [
  '∫', 'd/dx', 'x²', 'x³', 'xⁿ', '√', '∛', '∑', '∏', 'π', 'θ', 'α', 'β', 'γ', '∞', '±', '≠', '≈', '≤', '≥'
];

export const FloatingKeyboard: React.FC<FloatingKeyboardProps> = ({ onInsert, onOpenCalculator }) => {
  return (
    <div className="absolute -top-14 left-0 right-0 flex items-center gap-2 overflow-x-auto no-scrollbar px-2 pb-2">
      <button
        onClick={onOpenCalculator}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/40 hover:border-indigo-500/50 transition-all text-sm font-medium shadow-[0_0_15px_rgba(99,102,241,0.15)]"
      >
        <Calculator size={14} />
        <span>Calc</span>
      </button>

      <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1"></div>

      {symbols.map((sym) => (
        <button
          key={sym}
          onClick={() => onInsert(sym)}
          className="shrink-0 px-3 py-1.5 bg-[#1A1A1A]/80 backdrop-blur-md text-gray-300 border border-white/10 rounded-lg hover:bg-[#2A2A2A] hover:text-white hover:border-white/20 transition-all text-sm font-medium"
        >
          {sym}
        </button>
      ))}
    </div>
  );
};

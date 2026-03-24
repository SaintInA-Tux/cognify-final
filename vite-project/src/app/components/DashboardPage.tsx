import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDashboard } from '../../api';
import type { DashboardResponse, TopicWeakness } from '../../api';
import { usePhiCursor, PhiCursor } from './usePhiCursor';

export function DashboardPage() {
  usePhiCursor();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // In production we would pass profile?.id, but the backend is fixed for now
      // so getDashboard() uses a default TEST_STUDENT_ID
      const res = await getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (topic: TopicWeakness, type: 'red' | 'yellow' | 'green') => {
    const isRed = type === 'red';
    const isYellow = type === 'yellow';

    // Theme colors mapping
    const borderClass = isRed ? "border-pink-500/30" : isYellow ? "border-amber-500/30" : "border-emerald-500/30";
    const bgClass = isRed ? "bg-pink-500/5 hover:bg-pink-500/10" : isYellow ? "bg-amber-500/5 hover:bg-amber-500/10" : "bg-emerald-500/5 hover:bg-emerald-500/10";
    const titleColor = isRed ? "text-pink-400" : isYellow ? "text-amber-400" : "text-emerald-400";
    const barBg = isRed ? "bg-pink-500" : isYellow ? "bg-amber-500" : "bg-emerald-500";

    return (
      <motion.div
        key={topic.topic}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-2xl border ${borderClass} ${bgClass} transition-colors duration-300 relative overflow-hidden group`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className={`text-[15px] font-bold tracking-tight ${titleColor}`}>{topic.topic}</span>
            <span className="text-[12.5px] text-[#A1A1AA] uppercase font-medium tracking-wider">{topic.subject}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-xl font-black ${titleColor}`}>{topic.accuracy_pct}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#000000]/40 rounded-full h-1.5 mb-4 overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${topic.accuracy_pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-1.5 rounded-full ${barBg} shadow-[0_0_10px_currentColor]`}
          />
        </div>

        <div className="flex justify-between items-center text-[12px] text-[#71717A] bg-[#000000]/20 rounded-lg p-2 border border-white/5">
          <span className="flex items-center gap-1" title="SOS Usage Rate">
            <AlertTriangle size={12} className={topic.sos_pct > 20 ? "text-red-400" : ""} /> SOS: {topic.sos_pct}%
          </span>
          <span className="flex items-center gap-1" title="Total Attempts">
            Attempts: {topic.total_attempts}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#EDEDED] flex flex-col items-center p-4 md:p-8 font-sans overflow-x-hidden selection:bg-pink-500/30" style={{ cursor: 'none' }}>
      <PhiCursor />

      {/* Premium Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-pink-600/[0.04] blur-[150px] rounded-full mix-blend-screen animate-pulse duration-[5000ms]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/[0.04] blur-[150px] rounded-full mix-blend-screen"></div>
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>
      </div>

      <div className="relative z-10 w-full max-w-[1200px] mt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <ArrowLeft size={18} className="text-[#A1A1AA] group-hover:text-white transition-colors" />
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#A1A1AA] tracking-tight">Weakness Dashboard</h1>
              <p className="text-[#71717A] text-sm md:text-base font-medium mt-1">Real-time telemetry on your cognitive performance.</p>
            </div>
          </div>

          <button onClick={loadDashboard} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group" title="Refresh Data">
            <RefreshCcw size={18} className={`text-[#A1A1AA] group-hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Target size={32} className="text-pink-500 animate-pulse" />
                <span className="text-[#71717A] font-medium tracking-wide">Syncing neural pathways...</span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400">
              {error}
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

              {/* Recommendation Banner */}
              <div className="p-5 md:p-6 bg-gradient-to-r from-pink-500/20 via-purple-500/10 to-transparent border border-pink-500/30 rounded-3xl relative overflow-hidden group shadow-[0_0_40px_rgba(236,72,153,0.1)]">
                <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none transform rotate-12 scale-150">
                  <Target size={120} />
                </div>
                <div className="relative z-10">
                  <span className="text-[12.5px] uppercase tracking-widest font-bold text-pink-400 mb-2 block">Actionable Insight</span>
                  <p className="text-lg md:text-xl font-semibold text-white leading-relaxed max-w-[800px]">
                    {data.recommendation}
                  </p>
                </div>
              </div>

              {/* Grid System */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Red Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]"></div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Critical Weaknesses</h2>
                    <span className="ml-auto text-xs text-[#71717A] font-medium">&lt; 50% Accuracy</span>
                  </div>
                  {data.weakest_topics.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-[#71717A] text-sm">No critical weaknesses found</div>
                  ) : (
                    data.weakest_topics.map(t => renderCard(t, 'red'))
                  )}
                </div>

                {/* Yellow Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Improving Topics</h2>
                    <span className="ml-auto text-xs text-[#71717A] font-medium">50-74% Accuracy</span>
                  </div>
                  {data.improving_topics.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-[#71717A] text-sm">No amber topics</div>
                  ) : (
                    data.improving_topics.map(t => renderCard(t, 'yellow'))
                  )}
                </div>

                {/* Green Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Strong Concepts</h2>
                    <span className="ml-auto text-xs text-[#71717A] font-medium">&gt; 75% Accuracy</span>
                  </div>
                  {data.strong_topics.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-[#71717A] text-sm">No green topics yet</div>
                  ) : (
                    data.strong_topics.map(t => renderCard(t, 'green'))
                  )}
                </div>

              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

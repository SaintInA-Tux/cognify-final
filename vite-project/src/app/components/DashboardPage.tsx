import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity, 
  TrendingUp, 
  Zap, 
  Brain,
  AlertTriangle,
  CheckCircle2,
  Flame,
  LayoutDashboard,
  LineChart,
  Microscope,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { getDashboard } from '../../api';
import type { DashboardResponse } from '../../api';
import './DashboardPage.css';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function DashboardPage() {
  const navigate = useNavigate();
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [period, setPeriod] = useState<'7d' | '30d' | '3m' | 'all'>('30d');
  const [activeMbn, setActiveMbn] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load neural telemetry.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string, idx: number) => {
    setActiveMbn(idx);
    const el = document.getElementById(id);
    if (el && scrollWrapRef.current) {
      scrollWrapRef.current.scrollTo({
        top: el.offsetTop - 20,
        behavior: 'smooth'
      });
    }
  };

  const chartData = {
    labels: data?.performance_trend.map(p => p.label) || [],
    datasets: [
      {
        label: 'Accuracy %',
        data: data?.performance_trend.map(p => p.accuracy) || [],
        borderColor: 'rgba(240,240,240,0.9)',
        backgroundColor: chartType === 'bar' ? 'rgba(240,240,240,0.18)' : 'rgba(240,240,240,0.05)',
        borderWidth: chartType === 'bar' ? 0 : 2,
        pointBackgroundColor: 'rgba(240,240,240,1)',
        pointRadius: chartType === 'bar' ? 0 : 3,
        tension: 0.45,
        fill: chartType === 'line',
      },
      {
        label: 'SOS Rate %',
        data: data?.performance_trend.map(p => p.sos) || [],
        borderColor: 'rgba(208,80,64,0.8)',
        backgroundColor: chartType === 'bar' ? 'rgba(208,80,64,0.18)' : 'rgba(208,80,64,0.05)',
        borderWidth: chartType === 'bar' ? 0 : 2,
        pointBackgroundColor: 'rgba(208,80,64,1)',
        pointRadius: chartType === 'bar' ? 0 : 3,
        tension: 0.45,
        fill: chartType === 'line',
      }
    ]
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1e1e',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        titleFont: { size: 10 },
        bodyFont: { size: 11 },
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#505050', font: { size: 10 } } },
      y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#505050', font: { size: 10 }, stepSize: 20 } }
    }
  };

  return (
    <div className="dashboard-container">
      {/* NAV */}
      <nav className="dashboard-nav">
        <button className="nav-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={12} /> Chat
        </button>
        <span className="nav-logo">Phi<em>Prep</em></span>
        <span className="nav-tag">Performance</span>
        <div className="nav-sp" />
        <div className="nav-period">
          {['7d', '30d', '3m', 'all'].map(p => (
            <button 
              key={p} 
              className={`np-btn ${period === p ? 'act' : ''}`}
              onClick={() => setPeriod(p as any)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="nav-av">D</div>
      </nav>

      {/* Mobile Period */}
      <div className="mobile-period">
        {['7 Days', '30 Days', '3 Months', 'All Time'].map(p => {
          const val = p.toLowerCase().replace(' ', '') === '7days' ? '7d' : 
                      p.toLowerCase().replace(' ', '') === '30days' ? '30d' : 
                      p.toLowerCase().replace(' ', '') === '3months' ? '3m' : 'all';
          return (
            <button 
              key={p} 
              className={`mp-btn ${period === val ? 'act' : ''}`}
              onClick={() => setPeriod(val as any)}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="scroll-wrap" ref={scrollWrapRef}>
        <div className="max-w-[1200px] mx-auto">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loader" className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Brain className="animate-pulse text-purple-500" size={48} />
                <span className="text-[10px] uppercase tracking-[.3em] font-black text-white/40">Syncing Telemetry...</span>
              </motion.div>
            ) : error ? (
              <div className="p-10 text-center"><AlertTriangle className="mx-auto text-red-500 mb-4" />{error}</div>
            ) : data && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* Overview */}
                <div className="section-lbl" id="sec-overview">Overview</div>
                <div className="grid-top">
                  <div className="card stat-card">
                    <div className="stat-top"><div className="stat-icon">📚</div><span className="stat-delta up">+12%</span></div>
                    <div className="stat-val">{data.total_problems}</div>
                    <div className="stat-label">Problems attempted</div>
                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: '70%', background: 'var(--thi)' }} /></div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-top"><div className="stat-icon"><CheckCircle2 size={16}/></div><span className="stat-delta up">+8%</span></div>
                    <div className="stat-val">{data.overall_accuracy}%</div>
                    <div className="stat-label">Overall accuracy</div>
                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${data.overall_accuracy}%`, background: 'var(--thi)' }} /></div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-top"><div className="stat-icon">🆘</div><span className="stat-delta down">+4%</span></div>
                    <div className="stat-val">{data.sos_rate}%</div>
                    <div className="stat-label">SOS rate</div>
                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${data.sos_rate}%`, background: 'var(--red)' }} /></div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-top"><div className="stat-icon"><Flame size={16}/></div><span className="stat-delta flat">→</span></div>
                    <div className="stat-val">{data.streak}</div>
                    <div className="stat-label">Day streak</div>
                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: '40%', background: 'var(--yel)' }} /></div>
                  </div>
                </div>

                {/* Main Trend & Subject Breakdown */}
                <div className="section-lbl" id="sec-chart">Accuracy Over Time</div>
                <div className="grid-mid">
                  <div className="card chart-card">
                    <div className="card-hd">
                      <span className="card-title">Performance Trend</span>
                      <div className="graph-toggle">
                        <button className={`gt-btn ${chartType === 'line' ? 'act' : ''}`} onClick={() => setChartType('line')}>Line</button>
                        <button className={`gt-btn ${chartType === 'bar' ? 'act' : ''}`} onClick={() => setChartType('bar')}>Bar</button>
                      </div>
                    </div>
                    <div className="chart-wrap">
                      {chartType === 'line' ? <Line data={chartData} options={chartOptions} /> : <Bar data={chartData} options={chartOptions} />}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-hd"><span className="card-title">Subject Accuracy</span></div>
                    <div className="space-y-1">
                      {data.subject_breakdown.map(s => (
                        <div key={s.subject} className="subj-row">
                          <span className="subj-name">{s.subject}</span>
                          <div className="subj-bar-wrap"><div className="subj-track"><div className="subj-fill" style={{ width: `${s.accuracy}%`, background: s.accuracy > 70 ? 'var(--thi)' : s.accuracy > 50 ? 'var(--yel)' : 'var(--red)' }} /></div></div>
                          <span className="subj-pct">{s.accuracy}%</span>
                          <span className={`subj-status ${s.status === 'green' ? 'g' : s.status === 'yellow' ? 'y' : 'r'}`}>
                            {s.status === 'green' ? 'Strong' : s.status === 'yellow' ? 'Avg' : 'Weak'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Deep Analysis */}
                <div className="section-lbl" id="sec-analysis">Deep Analysis</div>
                <div className="grid-bot">
                  {/* Weak Areas */}
                  <div className="card">
                    <div className="card-hd"><span className="card-title">Weak areas</span></div>
                    <div className="space-y-3">
                      {data.weakest_topics.slice(0, 4).map(t => (
                        <div key={t.topic} className="weak-item">
                          <div className="weak-header">
                            <div className="weak-dot r" />
                            <span className="weak-topic">{t.topic}</span>
                            <span className="weak-pct">{t.accuracy_pct}%</span>
                          </div>
                          <div className="weak-track"><div className="weak-fill r" style={{ width: `${t.accuracy_pct}%` }} /></div>
                          <div className="weak-tags">
                            <span className="weak-tag">{t.subject}</span>
                            <span className="weak-tag">{t.sos_pct}% SOS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Asked & Heatmap */}
                  <div className="card">
                    <div className="card-hd"><span className="card-title">Struggle Frequency</span></div>
                    <div className="space-y-1">
                      {data.weakest_topics.slice(0, 5).map((t, i) => (
                        <div key={t.topic} className="freq-item">
                          <span className="freq-rank">0{i+1}</span>
                          <span className="freq-name">{t.topic}</span>
                          <div className="freq-bar-wrap"><div className="freq-track"><div className="freq-fill" style={{ width: '70%' }} /></div></div>
                          <span className="freq-count">{t.total_attempts}×</span>
                          <span className="freq-badge hot">High</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <div className="card-title mb-2">SOS Heatmap — 4 weeks</div>
                      <div className="heat-grid">
                        {data.sos_heatmap.map((v, i) => (
                          <div key={i} className={`heat-cell heat-${v}`} title={`${v} SOS requested`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Error Taxonomy */}
                  <div className="card">
                    <div className="card-hd"><span className="card-title">Error Taxonomy</span></div>
                    <div className="space-y-1">
                      {data.error_taxonomy.map(e => (
                        <div key={e.name} className="err-item">
                          <span className="err-icon">{e.icon}</span>
                          <div className="err-info">
                            <div className="err-name">{e.name}</div>
                            <div className="err-sub">{e.sub}</div>
                          </div>
                          <div className="err-bar-wrap"><div className="err-track"><div className="err-fill r" style={{ width: `${e.value}%` }} /></div></div>
                          <span className="err-count">{e.count}×</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                       <div className="card-title mb-2">AI Insights</div>
                       <div className="insight warn">
                          <span className="ins-icon">⚠</span>
                          <span className="ins-text">{data.recommendation}</span>
                       </div>
                       <div className="insight good">
                          <span className="ins-icon">✓</span>
                          <span className="ins-text"><strong>Keep it up!</strong> Your current streak of {data.streak} days shows deep dedication.</span>
                       </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav">
        {[
          { id: 'sec-overview', label: 'Overview', icon: <LayoutDashboard size={17}/> },
          { id: 'sec-chart', label: 'Trends', icon: <LineChart size={17}/> },
          { id: 'sec-analysis', label: 'Analysis', icon: <Microscope size={17}/> },
          { id: 'sec-overview', label: 'Insights', icon: <Lightbulb size={17}/> }
        ].map((n, i) => (
          <button key={i} className={`mbn-btn ${activeMbn === i ? 'act' : ''}`} onClick={() => scrollToSection(n.id, i)}>
            <span className="mbn-icon">{n.icon}</span>
            <span className="mbn-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

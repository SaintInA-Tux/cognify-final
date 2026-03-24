import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from '../../api';
import { useAuth } from '../context/AuthContext';
import { usePhiCursor, PhiCursor } from './usePhiCursor';

interface OnboardingData {
  level: string;
  exam: string;
  year: string;
  subjects: string[];
  daily_goal: number;
}

const TOTAL_SCREENS = 5;

export default function OnboardingFlow() {
  usePhiCursor();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    level: '',
    exam: '',
    year: '',
    subjects: ['math', 'physics', 'chemistry'],
    daily_goal: 10,
  });

  const progressPct = (step / (TOTAL_SCREENS - 1)) * 100;

  const goNext = async () => {
    if (step === TOTAL_SCREENS - 1) {
      // Save and go to chat
      setSaving(true);
      try {
        await updateProfile({
          level: data.level || 'Class 12',
          exam_board: 'CBSE',
          target_exam: data.exam === 'jee-main' ? 'JEE Main' : data.exam === 'jee-adv' ? 'JEE Advanced' : data.exam === 'neet' ? 'NEET' : 'JEE Main',
          daily_goal: data.daily_goal,
          onboarded: true,
        });
      } catch (e) {
        // Silent fail — still navigate
      } finally {
        setSaving(false);
        navigate('/chat');
      }
      return;
    }
    setExiting(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setExiting(false);
    }, 300);
  };

  const goBack = () => {
    if (step === 0) return;
    setStep(s => s - 1);
  };

  const skip = () => navigate('/chat');

  const examLabels: Record<string, string> = {
    'jee-main': 'JEE Main', 'jee-adv': 'JEE Advanced', 'neet': 'NEET', 'boards': 'Board Exams',
  };
  const classLabels: Record<string, string> = { '11': 'Class 11', '12': 'Class 12', 'dropper': 'Dropper' };
  const subjNames: Record<string, string> = { math: 'Math', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology' };

  const stepLabels = ['Step 1 of 4', 'Step 2 of 4', 'Step 3 of 4', 'Step 4 of 4', 'Almost done!'];

  const goalDescs: Record<number, string> = {
    1: 'Just getting started — every problem counts.',
    5: 'Light warmup. Good for busy days.',
    10: 'Solid daily target — most toppers do 8–15.',
    15: 'Serious prep mode. You mean business.',
    20: 'Elite grind. Make sure to rest too.',
    30: 'Maximum mode — only if you can sustain it.',
  };
  const closestGoalKey = [1, 5, 10, 15, 20, 30].reduce((a, b) => Math.abs(b - data.daily_goal) < Math.abs(a - data.daily_goal) ? b : a);

  const OptCard = ({ value, group, icon, label, sub }: { value: string; group: keyof OnboardingData; icon: string; label: string; sub?: string }) => {
    const selected = group === 'subjects' ? false : data[group] === value;
    return (
      <div
        onClick={() => {
          if (group !== 'subjects') setData(d => ({ ...d, [group]: value }));
        }}
        style={{
          background: selected ? 'rgba(255,255,255,0.06)' : 'var(--s2)',
          border: `1px solid ${selected ? 'var(--bdr2)' : 'var(--bdr)'}`,
          borderRadius: 14, padding: '16px 12px',
          cursor: 'none', transition: 'all .22s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          userSelect: 'none', position: 'relative', overflow: 'hidden',
        }}
      >
        {selected && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--bg)', fontWeight: 700 }}>✓</div>
        )}
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: selected ? 'var(--thi)' : 'var(--tmd)' }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: selected ? 'var(--tlo)' : 'var(--tdm)' }}>{sub}</span>}
      </div>
    );
  };

  const SubjChip = ({ value, icon, label }: { value: string; icon: string; label: string }) => {
    const selected = data.subjects.includes(value);
    const toggle = () => setData(d => ({
      ...d,
      subjects: selected ? d.subjects.filter(s => s !== value) : [...d.subjects, value],
    }));
    return (
      <div onClick={toggle} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 18px', borderRadius: 40,
        border: `1px solid ${selected ? 'var(--bdr2)' : 'var(--bdr)'}`,
        background: selected ? 'rgba(255,255,255,0.07)' : 'var(--s2)',
        cursor: 'none', transition: 'all .2s', userSelect: 'none',
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: selected ? 'var(--thi)' : 'var(--tmd)' }}>{label}</span>
      </div>
    );
  };

  const SummaryCard = ({ lbl, val }: { lbl: string; val: string }) => (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tlo)', marginBottom: 4 }}>{lbl}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--thi)' }}>{val}</div>
    </div>
  );

  const Dots = ({ active }: { active: number }) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: i === active ? 20 : 6,
          height: 6,
          borderRadius: i === active ? 3 : '50%',
          background: i === active ? 'var(--thi)' : 'var(--s5)',
          transition: 'all .3s ease',
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'none' }}>
      <PhiCursor />

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--s3)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--thi)', width: `${progressPct}%`, transition: 'width .5s cubic-bezier(.4,0,.2,1)', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.6))' }} />
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 600, color: 'var(--thi)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--bg)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>Φ</div>
          Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: 'var(--tlo)', letterSpacing: '.06em' }}>{stepLabels[Math.min(step, stepLabels.length - 1)]}</div>
        {step < 4 && <button onClick={skip} style={{ fontSize: 12, color: 'var(--tlo)', background: 'none', border: 'none', fontFamily: "'Jost', sans-serif", cursor: 'none', transition: 'color .2s', padding: '4px 0' }}>Skip for now</button>}
        {step >= 4 && <div style={{ width: 80 }} />}
      </div>

      {/* Screen area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px 24px',
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateX(-60px)' : 'translateX(0)',
          transition: 'opacity .3s ease, transform .3s cubic-bezier(.4,0,.2,1)',
        }}>
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Screen 0: Class */}
            {step === 0 && <>
              <div style={{ fontSize: 52, marginBottom: 20 }}>🎓</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: 'var(--thi)', marginBottom: 8, lineHeight: 1.15 }}>What's your class?</div>
              <div style={{ fontSize: 14, color: 'var(--tlo)', lineHeight: 1.6, maxWidth: 380, marginBottom: 36 }}>We'll calibrate problem difficulty and pacing to your stage.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%', marginBottom: 16 }}>
                <OptCard value="11" group="level" icon="📘" label="Class 11" sub="First year" />
                <OptCard value="12" group="level" icon="📗" label="Class 12" sub="Final year" />
                <OptCard value="dropper" group="level" icon="🔄" label="Dropper" sub="Repeating year" />
              </div>
              <Dots active={0} />
            </>}

            {/* Screen 1: Exam + Year */}
            {step === 1 && <>
              <div style={{ fontSize: 52, marginBottom: 20 }}>🎯</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: 'var(--thi)', marginBottom: 8, lineHeight: 1.15 }}>Your target exam?</div>
              <div style={{ fontSize: 14, color: 'var(--tlo)', lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>PhiPrep tunes its hints and SOS to your specific exam pattern.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 16 }}>
                <OptCard value="jee-main" group="exam" icon="🔵" label="JEE Main" sub="MCQ + Numerical" />
                <OptCard value="jee-adv" group="exam" icon="⚡" label="JEE Advanced" sub="IIT-level depth" />
                <OptCard value="neet" group="exam" icon="🩺" label="NEET" sub="Biology focus" />
                <OptCard value="boards" group="exam" icon="📋" label="Board Exams" sub="CBSE / State" />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', width: '100%', textAlign: 'left' }}>Target year</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%', marginBottom: 16 }}>
                {['2026', '2027', '2028'].map(y => (
                  <OptCard key={y} value={y} group="year" icon="" label={y} sub={y === '2026' ? 'This year' : y === '2027' ? 'Next year' : '2 years out'} />
                ))}
              </div>
              <Dots active={1} />
            </>}

            {/* Screen 2: Subjects */}
            {step === 2 && <>
              <div style={{ fontSize: 52, marginBottom: 20 }}>📚</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: 'var(--thi)', marginBottom: 8, lineHeight: 1.15 }}>Which subjects?</div>
              <div style={{ fontSize: 14, color: 'var(--tlo)', lineHeight: 1.6, maxWidth: 380, marginBottom: 36 }}>Select all you want PhiPrep to focus on. You can change this in Settings later.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%', marginBottom: 16 }}>
                <SubjChip value="math" icon="∫" label="Mathematics" />
                <SubjChip value="physics" icon="⚛" label="Physics" />
                <SubjChip value="chemistry" icon="🧪" label="Chemistry" />
                <SubjChip value="biology" icon="🧬" label="Biology" />
              </div>
              <Dots active={2} />
            </>}

            {/* Screen 3: Goal */}
            {step === 3 && <>
              <div style={{ fontSize: 52, marginBottom: 20 }}>⚡</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: 'var(--thi)', marginBottom: 8, lineHeight: 1.15 }}>Daily problem goal?</div>
              <div style={{ fontSize: 14, color: 'var(--tlo)', lineHeight: 1.6, maxWidth: 380, marginBottom: 36 }}>How many problems do you aim to solve each day?</div>
              <div style={{ width: '100%', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: 'var(--thi)', textAlign: 'center', marginBottom: 4 }}>
                  <span>{data.daily_goal}</span><span style={{ fontSize: 20, color: 'var(--tmd)' }}> problems</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--tdm)', marginBottom: 14, padding: '0 4px' }}>
                  <span>1</span><span>30</span>
                </div>
                <input
                  type="range" min={1} max={30} value={data.daily_goal}
                  onChange={e => setData(d => ({ ...d, daily_goal: parseInt(e.target.value) }))}
                  style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--s5)', outline: 'none', cursor: 'none', appearance: 'none', WebkitAppearance: 'none', marginBottom: 16 }}
                />
                <div style={{ fontSize: 12, color: 'var(--tlo)', textAlign: 'center' }}>{goalDescs[closestGoalKey]}</div>
              </div>
              <Dots active={3} />
            </>}

            {/* Screen 4: Summary */}
            {step === 4 && <>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 600, color: 'var(--thi)', marginBottom: 4 }}>You're all set.</div>
              <div style={{ fontSize: 14, color: 'var(--tlo)', marginBottom: 24, maxWidth: 340 }}>Here's what PhiPrep has configured for you:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 24 }}>
                <SummaryCard lbl="Class" val={classLabels[data.level] || 'Not set'} />
                <SummaryCard lbl="Target Exam" val={examLabels[data.exam] || 'Not set'} />
                <SummaryCard lbl="Target Year" val={data.year || 'Not set'} />
                <SummaryCard lbl="Daily Goal" val={`${data.daily_goal} problems / day`} />
                <SummaryCard lbl="Subjects" val={data.subjects.map(s => subjNames[s] || s).join(', ') || 'Not set'} />
                <SummaryCard lbl="Default Mode" val="Brain Mode (Socratic)" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--tlo)', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
                Your weakness map builds from your very first problem. Brain Mode is on by default — SOS is the escape hatch.
              </div>
            </>}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ padding: '20px 24px 28px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, maxWidth: 568, width: '100%', margin: '0 auto' }}>
        <button
          onClick={goBack}
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'var(--s2)', border: '1px solid var(--bdr)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, cursor: 'none', flexShrink: 0,
            transition: 'all .2s', color: 'var(--thi)',
            opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'all',
          }}
        >←</button>
        <button
          onClick={goNext}
          disabled={saving}
          style={{
            flex: 1, padding: 13,
            background: saving ? 'var(--s4)' : 'var(--thi)',
            color: saving ? 'var(--tlo)' : 'var(--bg)',
            border: 'none', borderRadius: 10,
            fontFamily: "'Jost', sans-serif", fontSize: 13.5, fontWeight: 700,
            letterSpacing: '.04em', cursor: saving ? 'not-allowed' : 'none',
            transition: 'all .2s',
          }}
        >
          {saving ? 'Saving…' : step >= TOTAL_SCREENS - 1 ? 'Start learning →' : 'Continue →'}
        </button>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--thi); cursor: pointer;
          border: 3px solid var(--bg);
          box-shadow: 0 0 0 1.5px var(--bdrhi);
        }
        @media(max-width:600px){
          div[style*='grid-template-columns: 1fr 1fr 1fr'] { grid-template-columns: 1fr 1fr!important; }
          div[style*='fontSize: 32'] { font-size: 26px!important; }
        }
        @media(max-width:480px){ body { cursor: auto!important; } }
      `}</style>
    </div>
  );
}

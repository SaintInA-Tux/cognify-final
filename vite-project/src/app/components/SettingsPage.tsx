import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, updateProfile } from '../../api';
import type { StudentProfile } from '../../api';
import { useAuth } from '../context/AuthContext';
import { usePhiCursor, PhiCursor } from './usePhiCursor';

type Section = 'profile' | 'learning' | 'ai' | 'appearance' | 'notifications' | 'practice';

const sections: { id: Section; icon: string; label: string }[] = [
  { id: 'profile', icon: '👤', label: 'Profile' },
  { id: 'learning', icon: '🎯', label: 'Learning' },
  { id: 'ai', icon: '🧠', label: 'AI Behaviour' },
  { id: 'appearance', icon: '✨', label: 'Appearance' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'practice', icon: '📊', label: 'Practice' },
];

export default function SettingsPage() {
  usePhiCursor();
  const navigate = useNavigate();
  const { profile: authProfile, logout } = useAuth();
  const [active, setActive] = useState<Section>('profile');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local editable state
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [examBoard, setExamBoard] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [dailyGoal, setDailyGoal] = useState(5);
  const [chatFontSize, setChatFontSize] = useState(() => parseFloat(localStorage.getItem('phi_chat_fs') || '12.5'));

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-fs', `${chatFontSize}px`);
    localStorage.setItem('phi_chat_fs', chatFontSize.toString());
  }, [chatFontSize]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const p = await getMe();
      setProfile(p);
      setName(p.name || '');
      setLevel(p.level || '');
      setExamBoard(p.exam_board || '');
      setTargetExam(p.target_exam || '');
      setDailyGoal(p.daily_goal || 5);
    } catch (e) {
      // Use auth profile as fallback
      if (authProfile) {
        setProfile(authProfile);
        setName(authProfile.name || '');
        setLevel(authProfile.level || '');
        setExamBoard(authProfile.exam_board || '');
        setTargetExam(authProfile.target_exam || '');
        setDailyGoal(authProfile.daily_goal || 5);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, level, exam_board: examBoard, target_exam: targetExam, daily_goal: dailyGoal });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const initials = (n: string) => n.substring(0, 2).toUpperCase();

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--tlo)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );

  const Input = ({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 10, color: 'var(--thi)', fontFamily: "'Jost', sans-serif", fontSize: 13, outline: 'none', transition: 'border-color .2s' }}
      onFocus={e => e.target.style.borderColor = 'var(--bdrhi)'}
      onBlur={e => e.target.style.borderColor = 'var(--bdr)'}
    />
  );

  const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 10, color: value ? 'var(--thi)' : 'var(--tdm)', fontFamily: "'Jost', sans-serif", fontSize: 13, outline: 'none', cursor: 'none', appearance: 'none' }}
    >
      <option value="">Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Toggle = ({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--bdr)' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--thi)', marginBottom: sub ? 3 : 0 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--tlo)' }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, background: value ? 'var(--thi)' : 'var(--s5)', border: '1px solid var(--bdrhi)', position: 'relative', cursor: 'none', transition: 'background .2s', flexShrink: 0 }}
      >
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: value ? 'var(--bg)' : 'var(--tlo)', position: 'absolute', top: 2, left: value ? 20 : 2, transition: 'left .2s' }} />
      </div>
    </div>
  );

  const [toggles, setToggles] = useState({ brainDefault: true, sosConfirm: true, stepCheck: true, dailyReminder: false, streakAlert: true, weeklyReport: false });
  const setToggle = (k: keyof typeof toggles) => (v: boolean) => setToggles(t => ({ ...t, [k]: v }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', cursor: 'none' }}>
      <PhiCursor />

      {/* Nav */}
      <nav style={{ height: 50, background: 'rgba(10,10,10,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, zIndex: 10, position: 'sticky', top: 0 }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tlo)', background: 'none', border: '1px solid var(--bdr)', borderRadius: 20, padding: '5px 12px', cursor: 'none', fontFamily: "'Jost', sans-serif", transition: 'all .2s', textDecoration: 'none' }}>← Back</button>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--thi)', letterSpacing: '.03em' }}>
          Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: saved ? 'var(--s3)' : 'var(--thi)', color: saved ? 'var(--tmd)' : 'var(--bg)', fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.06em', padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'none', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--s4)', border: '1px solid var(--bdrhi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
          {profile?.name ? initials(profile.name) : 'G'}
        </div>
      </nav>

      {/* Layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', maxWidth: 1100, margin: '0 auto', width: '100%', padding: '24px 20px 60px', gap: 32, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <div style={{ position: 'sticky', top: 56, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--tdm)', padding: '0 8px 10px' }}>Settings</div>
          {sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={e => { e.preventDefault(); setActive(s.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 0, height: 44, padding: '0 4px', borderRadius: 12, textDecoration: 'none', cursor: 'none', border: '1px solid transparent', background: active === s.id ? 'transparent' : 'transparent', transition: 'background .2s', marginBottom: 2 }}
            >
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{
                  width: active === s.id ? 38 : 30,
                  height: active === s.id ? 38 : 30,
                  borderRadius: active === s.id ? 12 : 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: active === s.id ? 19 : 14,
                  background: active === s.id ? 'var(--s4)' : 'transparent',
                  border: `1px solid ${active === s.id ? 'var(--bdrhi)' : 'transparent'}`,
                  boxShadow: active === s.id ? '0 1px 0 rgba(255,255,255,.06) inset, 0 4px 16px rgba(0,0,0,.5)' : 'none',
                  transition: 'all .36s cubic-bezier(.4,0,.2,1)',
                }}>
                  {s.icon}
                </div>
              </div>
              <span style={{ fontSize: active === s.id ? 13 : 12.5, fontWeight: active === s.id ? 600 : 400, color: active === s.id ? 'var(--thi)' : 'var(--tlo)', marginLeft: 8, transition: 'all .24s', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </a>
          ))}

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bdr)' }}>
            <button
              onClick={() => { if (confirm('Log out?')) { logout(); navigate('/'); } }}
              style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid rgba(208,80,64,.2)', borderRadius: 10, color: 'var(--danger)', fontFamily: "'Jost', sans-serif", fontSize: 12.5, cursor: 'none', transition: 'all .2s', textAlign: 'left' as const }}
            >
              🚪 Sign out
            </button>
          </div>
        </div>

        {/* Content */}
        <div>

          {/* Profile */}
          {active === 'profile' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>Profile</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Your personal details and exam configuration.</div>

              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--bdr)', marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--s4)', border: '1px solid var(--bdrhi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
                  {name ? initials(name) : 'G'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--thi)' }}>{name || 'Guest'}</div>
                  <div style={{ fontSize: 12, color: 'var(--tlo)' }}>{profile?.is_guest ? 'Guest account' : profile?.email || ''}</div>
                </div>
              </div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent)' }} />

                <Field label="Display Name">
                  <Input value={name} onChange={setName} placeholder="Your name" />
                </Field>

                <Field label="Class / Year">
                  <Select value={level} onChange={setLevel} options={[{ value: 'Class 11', label: 'Class 11' }, { value: 'Class 12', label: 'Class 12' }, { value: 'Dropper', label: 'Dropper' }]} />
                </Field>

                <Field label="Board">
                  <Select value={examBoard} onChange={setExamBoard} options={[{ value: 'CBSE', label: 'CBSE' }, { value: 'ISC', label: 'ISC' }, { value: 'State Board', label: 'State Board' }]} />
                </Field>

                <Field label="Target Exam">
                  <Select value={targetExam} onChange={setTargetExam} options={[{ value: 'JEE Main', label: 'JEE Main' }, { value: 'JEE Advanced', label: 'JEE Advanced' }, { value: 'NEET', label: 'NEET' }, { value: 'Board Exams', label: 'Board Exams' }]} />
                </Field>
              </div>
            </div>
          )}

          {/* Learning */}
          {active === 'learning' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>Learning</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Adjust your daily goals and practice habits.</div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent)' }} />

                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--tlo)', marginBottom: 12 }}>Daily Problem Goal</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: 'var(--thi)', textAlign: 'center', marginBottom: 4 }}>
                  <span>{dailyGoal}</span><span style={{ fontSize: 18, color: 'var(--tmd)' }}> problems</span>
                </div>
                <input
                  type="range" min={1} max={30} value={dailyGoal}
                  onChange={e => setDailyGoal(parseInt(e.target.value))}
                  style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--s5)', outline: 'none', cursor: 'none', appearance: 'none', WebkitAppearance: 'none', marginTop: 12 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tdm)', marginTop: 8 }}>
                  <span>1</span><span>30</span>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          {active === 'appearance' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>Appearance</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Customize the look and feel of your chat experience.</div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent)' }} />

                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--tlo)', marginBottom: 12 }}>Chat Font Size</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 600, color: 'var(--thi)', textAlign: 'center', marginBottom: 4 }}>
                   {chatFontSize}px
                </div>
                <input
                  type="range" min={10} max={18} step={0.5} value={chatFontSize}
                  onChange={e => setChatFontSize(parseFloat(e.target.value))}
                  style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--s5)', outline: 'none', cursor: 'none', appearance: 'none', WebkitAppearance: 'none', marginTop: 12 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tdm)', marginTop: 8 }}>
                  <span>Smaller</span><span>Larger</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Behaviour */}
          {active === 'ai' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>AI Behaviour</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Control how PhiPrep thinks with you.</div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent)' }} />

                <Toggle label="Brain Mode by default" sub="New problems start in Socratic mode — SOS requires deliberate choice" value={toggles.brainDefault} onChange={setToggle('brainDefault')} />
                <Toggle label="SOS confirmation step" sub="Show a friction screen before revealing the full solution" value={toggles.sosConfirm} onChange={setToggle('sosConfirm')} />
                <Toggle label="Step-by-step validation" sub="Let PhiPrep evaluate each step you write and identify errors" value={toggles.stepCheck} onChange={setToggle('stepCheck')} />
              </div>
            </div>
          )}

          {/* Notifications */}
          {active === 'notifications' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>Notifications</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Choose what PhiPrep reminds you about.</div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent)' }} />

                <Toggle label="Daily reminder" sub="Nudge when you haven't solved your daily goal" value={toggles.dailyReminder} onChange={setToggle('dailyReminder')} />
                <Toggle label="Streak alert" sub="Warn before your streak breaks" value={toggles.streakAlert} onChange={setToggle('streakAlert')} />
                <Toggle label="Weekly progress report" sub="Summary of your accuracy and weak topics" value={toggles.weeklyReport} onChange={setToggle('weeklyReport')} />
              </div>

              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 12, color: 'var(--tlo)' }}>
                💡 Push notifications are not available in the prototype. Settings are saved for when they're enabled.
              </div>
            </div>
          )}

          {/* Practice */}
          {active === 'practice' && (
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>Practice</div>
              <div style={{ fontSize: 12.5, color: 'var(--tlo)', marginBottom: 28 }}>Navigate to your performance data.</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 14, cursor: 'none', transition: 'all .2s', textAlign: 'left' as const }}>
                  <span style={{ fontSize: 22 }}>📊</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--thi)', marginBottom: 3 }}>Weakness Dashboard</div>
                    <div style={{ fontSize: 12, color: 'var(--tlo)' }}>Red / Yellow / Green topic map based on your accuracy</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--tlo)', fontSize: 14 }}>→</span>
                </button>

                <button onClick={() => navigate('/challenge')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 14, cursor: 'none', transition: 'all .2s', textAlign: 'left' as const }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--thi)', marginBottom: 3 }}>Daily Challenge</div>
                    <div style={{ fontSize: 12, color: 'var(--tlo)' }}>One hard problem per day — track your streak</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--tlo)', fontSize: 14 }}>→</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--thi); cursor: pointer;
          border: 3px solid var(--bg); box-shadow: 0 0 0 1.5px var(--bdrhi);
        }
        a:hover .sb-icon-box { width: 34px!important; height: 34px!important; border-radius: 10px!important; font-size: 16px!important; }
        @media(max-width:768px) {
          div[style*='grid-template-columns: 220px'] { grid-template-columns: 1fr!important; }
          div[style*='position: sticky'] { position: static!important; }
        }
        @media(max-width:480px) { body { cursor: auto!important; } }
      `}</style>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginGuest } from '../../api';
import { useAuth } from '../context/AuthContext';
import { usePhiCursor, PhiCursor } from './usePhiCursor';

export default function AuthPage() {
  usePhiCursor();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loginGuest();
      login(res.access_token, res.student_id);
      // AuthContext + App.tsx will redirect to /onboarding if not onboarded
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to start. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", display: 'flex', overflow: 'hidden', cursor: 'none' }}>
      <PhiCursor />

      {/* LEFT PANEL */}
      <div style={{ width: 420, flexShrink: 0, background: 'var(--s1)', borderRight: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '36px 40px 40px' }}>

          {/* Logo */}
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: 'var(--thi)', letterSpacing: '.03em', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: 'var(--bg)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>Φ</div>
            Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
          </div>

          {/* Heading */}
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: 'var(--thi)', marginBottom: 8, lineHeight: 1.15 }}>Start thinking.</div>
          <div style={{ fontSize: 13, color: 'var(--tlo)', marginBottom: 32, lineHeight: 1.6 }}>
            Free forever. No account needed for the prototype.
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(208,80,64,.12)', border: '1px solid rgba(208,80,64,.3)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#d07060', marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* Guest Button - primary CTA */}
          <button
            onClick={handleGuest}
            disabled={loading}
            style={{
              width: '100%', padding: 14,
              background: loading ? 'var(--s4)' : 'var(--thi)',
              color: loading ? 'var(--tlo)' : 'var(--bg)',
              border: 'none', borderRadius: 10,
              fontFamily: "'Jost', sans-serif", fontSize: 13.5, fontWeight: 700,
              letterSpacing: '.04em', cursor: loading ? 'not-allowed' : 'none',
              transition: 'all .2s', marginBottom: 12,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {loading ? 'Starting your session…' : 'Continue as Guest →'}
          </button>

          <div style={{ fontSize: 12.5, color: 'var(--tdm)', textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
            No sign-up required. Your session is saved automatically.
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--bdr)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--tlo)', fontWeight: 600, letterSpacing: '.1em' }}>FEATURES</span>
            <div style={{ flex: 1, height: 1, background: 'var(--bdr)' }} />
          </div>

          {/* Feature list */}
          {[
            { icon: '🧠', label: 'Brain Mode', sub: 'Socratic thinking engine' },
            { icon: '⚡', label: 'SOS Mode', sub: 'Full annotated solution' },
            { icon: '💡', label: 'Progressive Hints', sub: '3-tier sequential hints' },
            { icon: '📊', label: 'Weakness Dashboard', sub: 'Red / Yellow / Green map' },
            { icon: '🔥', label: 'Daily Challenge', sub: 'One hard problem per day' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < 4 ? '1px solid var(--bdr)' : 'none' }}>
              <span style={{ fontSize: 16, width: 28, textAlign: 'center', flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 12.5, color: 'var(--tmd)', flex: 1 }}>{f.label}</span>
              <div style={{ width: 60, height: 3, background: 'var(--s4)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'var(--thi)', width: '100%' }} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: 32 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['🆓 Free to start', '🔥 Streak tracker'].map((c, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--tlo)', background: 'var(--s1)', border: '1px solid var(--bdr)', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, position: 'relative', overflow: 'hidden' }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '44px 44px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--bg) 100%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          {/* Big Phi */}
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(80px,15vw,140px)', fontWeight: 600, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,.1)', lineHeight: 1, marginBottom: 24, userSelect: 'none' }}>
            Φ
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: 'var(--thi)', marginBottom: 12 }}>
            Your thinking is the real variable.
          </div>
          <div style={{ fontSize: 14, color: 'var(--tlo)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
            PhiPrep doesn't give you answers. It makes you arrive at them yourself — through Brain Mode, progressive hints, and deliberate friction.
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){ .auth-right{ display:none!important; } }
        @media(max-width:480px){ div[style*='cursor: none']{ cursor: auto!important; } }
      `}</style>
    </div>
  );
}

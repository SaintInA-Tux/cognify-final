import { useNavigate } from 'react-router-dom';

const mathFloats = [
  { text: '∫ eˣ dx', top: '8%', left: '6%', dur: 14 },
  { text: 'lim x→∞', top: '15%', right: '8%', dur: 16 },
  { text: 'd/dx(sin x)', top: '60%', left: '4%', dur: 11 },
  { text: '∑n²', bottom: '20%', right: '6%', dur: 13 },
  { text: 'ILATE', top: '40%', left: '2%', dur: 18 },
  { text: "f'(x)=0", bottom: '30%', right: '12%', dur: 15 },
  { text: 'det(A)', top: '75%', left: '15%', dur: 12 },
];

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Grid background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, var(--bg) 100%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Floating math */}
      {mathFloats.map((f, i) => (
        <div key={i} style={{
          position: 'fixed',
          top: f.top, bottom: (f as any).bottom, left: (f as any).left, right: (f as any).right,
          fontFamily: "'DM Mono', monospace",
          fontSize: 13, color: 'rgba(255,255,255,.04)',
          pointerEvents: 'none', zIndex: 0,
          animation: `floatDrift ${f.dur}s ease-in-out infinite alternate`,
        }}>{f.text}</div>
      ))}

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 2, height: 50, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--thi)', letterSpacing: '.03em', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/')}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--bg)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>Φ</div>
          Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1, textAlign: 'center' }}>

        {/* Big 404 */}
        <div style={{ position: 'relative', marginBottom: 8, userSelect: 'none' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(100px,20vw,180px)', fontWeight: 600, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,.12)', lineHeight: 1, letterSpacing: '-.02em', position: 'relative' }}>
            4
            <span style={{ position: 'relative' }}>
              0
              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px,8vw,72px)', fontWeight: 600, color: 'rgba(255,255,255,.18)', pointerEvents: 'none' }}>Φ</span>
            </span>
            4
          </div>
        </div>

        {/* Error card */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 18, padding: '28px 32px', maxWidth: 460, width: '100%', position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)' }} />

          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' as const, color: 'var(--tlo)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--tlo)' }} />
            Error 404 — Page not found
          </div>

          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--thi)', marginBottom: 10, lineHeight: 1.2 }}>
            This page doesn't exist.<br />Unlike your potential.
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--tlo)', lineHeight: 1.65, marginBottom: 20 }}>
            You've wandered off the syllabus. Even JEE doesn't test this chapter.
          </div>

          {/* Brain Mode joke card */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdrhi)', borderRadius: 11, padding: '14px 16px', marginBottom: 20, textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)', opacity: .5 }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--tmd)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              Brain Mode — 404 Analysis
              <div style={{ flex: 1, height: 1, background: 'var(--bdr)' }} />
            </div>
            {[
              { n: '01', text: <><b style={{ color: 'var(--thi)', fontWeight: 500 }}>Pattern:</b> URL typed incorrectly, or link is broken — classic "human error" pattern.</> },
              { n: '02', text: <><b style={{ color: 'var(--thi)', fontWeight: 500 }}>Method:</b> Navigate back to a known state. Don't SOS — this one doesn't have a solution page.</> },
              { n: '03', text: <><b style={{ color: 'var(--thi)', fontWeight: 500 }}>First move:</b> Click the button below. It's easier than L'Hôpital.</> },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, marginBottom: i < 2 ? 6 : 0, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: 'var(--tdm)', minWidth: 16, paddingTop: 3, flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontSize: 12, color: 'var(--tmd)', lineHeight: 1.55 }}>{s.text}</span>
              </div>
            ))}
            <div style={{ textAlign: 'center', fontSize: 10, fontStyle: 'italic', color: 'var(--tdm)', marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--bdr)' }}>The correct URL is withheld — just go home ↓</div>
          </div>

          {/* Terminal */}
          <div style={{ background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '10px 14px' }}>
            {[
              <><span style={{ color: 'var(--tdm)' }}>$ </span><span style={{ color: '#d07060' }}>GET</span> <span style={{ color: '#a08030' }}>/this-page-doesnt-exist</span></>,
              <><span style={{ color: 'var(--tdm)' }}>→ </span><span style={{ color: '#d07060' }}>404</span> <span style={{ color: 'var(--tdm)' }}>Not Found</span></>,
              <><span style={{ color: 'var(--tdm)' }}>→ </span><span style={{ color: '#5a9050' }}>Suggestion:</span> <span style={{ color: 'var(--tdm)' }}>try /chat or /dashboard</span><span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--tlo)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink .8s step-end infinite' }} /></>,
            ].map((line, i) => (
              <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: 'var(--tlo)', lineHeight: 1.7 }}>{line}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/chat')} style={{ padding: '11px 24px', background: 'var(--thi)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontFamily: "'Jost', sans-serif", fontSize: 13, fontWeight: 700, transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            Φ Go home →
          </button>
          <button onClick={() => window.history.back()} style={{ padding: '11px 24px', background: 'transparent', color: 'var(--tmd)', border: '1px solid var(--bdr)', borderRadius: 10, fontFamily: "'Jost', sans-serif", fontSize: 13, transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            ← Go back
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatDrift { from { transform: translateY(0) } to { transform: translateY(-20px) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @media(max-width:480px) { body { cursor: auto!important; } }
      `}</style>
    </div>
  );
}

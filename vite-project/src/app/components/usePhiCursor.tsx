import { useEffect } from 'react';

/**
 * PhiPrep custom cursor — dot + ring that follows mouse.
 * Singleton implementation: Call this hook once at the root (App.tsx).
 */
export function usePhiCursor() {
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf: number;

    // We use IDs because we want them to be globally accessible if needed, 
    // but we ensure singleton by rendering PhiCursor only once.
    const cursor = document.getElementById('pp-cursor');
    const ring = document.getElementById('pp-cursor-ring');

    if (!cursor || !ring) return;

    // Apply global cursor none
    document.body.style.cursor = 'none';
    const style = document.createElement('style');
    style.id = 'phi-cursor-global-style';
    style.innerHTML = `
      * { cursor: none !important; }
      .phi-header__brand *, .phi-header__logo, .phi-header__title { cursor: none !important; }
    `;
    document.head.appendChild(style);

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const animate = () => {
      if (cursor) {
        cursor.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      }
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      if (ring) {
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      }
      raf = requestAnimationFrame(animate);
    };

    // Hover detection
    const handleMouseEnter = () => ring?.classList.add('pp-cursor-ring--hover');
    const handleMouseLeave = () => ring?.classList.remove('pp-cursor-ring--hover');

    const updateListeners = () => {
      const interactives = document.querySelectorAll('a, button, [role="button"], input, textarea, select');
      interactives.forEach(el => {
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    // Initial attach
    updateListeners();

    // Re-attach on DOM changes (for dynamic content)
    const observer = new MutationObserver(updateListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.body.style.cursor = '';
      const styleEl = document.getElementById('phi-cursor-global-style');
      if (styleEl) styleEl.remove();
      
      const interactives = document.querySelectorAll('a, button, [role="button"], input, textarea, select');
      interactives.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);
}

/** Render this once at the top of App.tsx */
export function PhiCursor() {
  return (
    <div className="phi-cursor-container" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      <div id="pp-cursor" className="pp-cursor" style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', background: '#fff', borderRadius: '50%', transform: 'translate(-50%, -50%)', willChange: 'transform' }} />
      <div id="pp-cursor-ring" className="pp-cursor-ring" style={{ position: 'absolute', top: 0, left: 0, width: '32px', height: '32px', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%, -50%)', transition: 'width 0.2s, height 0.2s, border-color 0.2s, background 0.2s', willChange: 'transform' }} />
      <style>{`
        .pp-cursor-ring--hover {
          width: 48px !important;
          height: 48px !important;
          border-color: #7c3aed !important;
          background: rgba(124, 58, 237, 0.1) !important;
        }
      `}</style>
    </div>
  );
}

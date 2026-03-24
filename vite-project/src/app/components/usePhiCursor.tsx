import { useEffect } from 'react';

/**
 * PhiPrep custom cursor — dot + ring that follows mouse.
 * Used on every page. Matches the 404 page cursor exactly.
 * Call this hook in every page component.
 */
export function usePhiCursor() {
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf: number;

    const cursor = document.getElementById('pp-cursor');
    const ring = document.getElementById('pp-cursor-ring');

    if (!cursor || !ring) return;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const animate = () => {
      if (cursor) {
        cursor.style.left = mx + 'px';
        cursor.style.top = my + 'px';
      }
      rx += (mx - rx) * 0.1;
      ry += (my - ry) * 0.1;
      if (ring) {
        ring.style.left = rx + 'px';
        ring.style.top = ry + 'px';
      }
      raf = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/** Render this once at the top of every page JSX */
export function PhiCursor() {
  return (
    <>
      <div id="pp-cursor" className="pp-cursor" />
      <div id="pp-cursor-ring" className="pp-cursor-ring" />
    </>
  );
}

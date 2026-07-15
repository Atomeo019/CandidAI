'use client';

import { useEffect, useRef, useState } from 'react';

/** StatBar that counts up and fills when scrolled into view. */
export function AnimatedStatBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive(true);
      setDisplay(clamped);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [clamped]);

  useEffect(() => {
    if (!active || display === clamped) return;
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * clamped));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, clamped]);

  return (
    <div ref={ref} className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs text-foreground tabular-nums">{display}</span>
      </div>
      <div className="h-px w-full bg-border relative">
        <div
          className="h-px absolute left-0 top-0 bg-gold transition-[width] ease-out [transition-duration:900ms]"
          style={{ width: active ? `${clamped}%` : '0%' }}
        />
      </div>
    </div>
  );
}

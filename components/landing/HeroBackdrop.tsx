'use client';

import { useEffect, useRef } from 'react';

/**
 * The hero's golden arc + masked grid, with a gentle scroll parallax:
 * the arc drifts down slower than the page, the grid slower still,
 * giving the hero physical depth as the user starts scrolling.
 */
export function HeroBackdrop() {
  const arcRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 900);
        if (arcRef.current) arcRef.current.style.transform = `translateY(${y * 0.22}px)`;
        if (gridRef.current) gridRef.current.style.transform = `translateY(${y * 0.1}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={arcRef} className="hero-arc will-change-transform" />
      <div ref={gridRef} className="hero-grid will-change-transform" />
    </>
  );
}

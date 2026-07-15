'use client';

import { useEffect, useRef } from 'react';
import { FileText, Flame } from 'lucide-react';

/** Verdicts the beam "delivers" to the right node, one per cycle. */
const TIER_CYCLE = ['C', 'B', 'A', 'S'];

/**
 * Resume → CandidAI → Verdict beam animation.
 * A light pulse travels from the resume node into the engine (splash),
 * then out to the verdict node, which flips to the next tier letter.
 */
export function HeroPipeline() {
  const pipelineRef = useRef<HTMLDivElement>(null);
  const leftNodeRef = useRef<HTMLDivElement>(null);
  const centerNodeRef = useRef<HTMLDivElement>(null);
  const rightNodeRef = useRef<HTMLDivElement>(null);
  const tierRef = useRef<HTMLSpanElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const corePathRef = useRef<SVGPathElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    const left = leftNodeRef.current;
    const center = centerNodeRef.current;
    const right = rightNodeRef.current;
    const glowPath = glowPathRef.current;
    const corePath = corePathRef.current;
    const gradient = gradientRef.current;
    const splash = splashRef.current;
    const tierEl = tierRef.current;
    if (
      !pipeline || !left || !center || !right ||
      !glowPath || !corePath || !gradient || !splash || !tierEl
    ) {
      return;
    }

    const geom = { startX: 0, endX: 0 };

    const computePath = () => {
      const pRect = pipeline.getBoundingClientRect();
      const mid = (r: DOMRect) => ({
        x: r.left + r.width / 2 - pRect.left,
        y: r.top + r.height / 2 - pRect.top,
      });
      const s = mid(left.getBoundingClientRect());
      const m = mid(center.getBoundingClientRect());
      const e = mid(right.getBoundingClientRect());
      geom.startX = s.x;
      geom.endX = e.x;
      const d = `M ${s.x},${s.y} L ${m.x},${m.y} L ${e.x},${e.y}`;
      glowPath.setAttribute('d', d);
      corePath.setAttribute('d', d);
    };

    computePath();
    window.addEventListener('resize', computePath);

    const HALF = 55; // px width of the sliding bright window
    const setBeam = (p: number) => {
      const x = geom.startX + p * (geom.endX - geom.startX);
      gradient.setAttribute('x1', `${x - HALF}`);
      gradient.setAttribute('x2', `${x + HALF}`);
      gradient.setAttribute('y1', '0');
      gradient.setAttribute('y2', '0');
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Static, fully-lit beam; no loop.
      gradient.setAttribute('x1', `${geom.startX}`);
      gradient.setAttribute('x2', `${geom.endX}`);
      return () => window.removeEventListener('resize', computePath);
    }

    type Phase = 'p1' | 'splash' | 'p2' | 'idle';
    let phase: Phase = 'p1';
    let last = performance.now();
    let delivered = false;
    let tierIndex = 0;
    let raf = 0;

    const tick = (now: number) => {
      const t = now - last;
      if (phase === 'p1') {
        const p = Math.min(t / 800, 1);
        setBeam(p * 0.5);
        left.classList.toggle('active', p < 0.4);
        if (t >= 800) {
          left.classList.remove('active');
          glowPath.style.opacity = '0';
          corePath.style.opacity = '0';
          splash.classList.add('animate');
          phase = 'splash';
          last = now;
        }
      } else if (phase === 'splash') {
        if (t >= 800) {
          splash.classList.remove('animate');
          glowPath.style.opacity = '';
          corePath.style.opacity = '';
          delivered = false;
          phase = 'p2';
          last = now;
        }
      } else if (phase === 'p2') {
        const p = Math.min(t / 800, 1);
        setBeam(0.5 + p * 0.5);
        if (p > 0.6) {
          right.classList.add('active');
          if (!delivered) {
            delivered = true;
            tierIndex = (tierIndex + 1) % TIER_CYCLE.length;
            tierEl.textContent = TIER_CYCLE[tierIndex];
          }
        }
        if (t >= 800) {
          right.classList.remove('active');
          phase = 'idle';
          last = now;
        }
      } else if (t >= 1000) {
        phase = 'p1';
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', computePath);
    };
  }, []);

  return (
    <div ref={pipelineRef} className="icon-pipeline w-full max-w-xl mx-auto">
      <svg className="beam-svg" aria-hidden="true">
        <defs>
          <filter id="candid-beam-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <linearGradient
            ref={gradientRef}
            id="candid-beam-gradient"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0" />
            <stop offset="20%" stopColor="#C9A84C" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="80%" stopColor="#E8D390" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#E8D390" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={glowPathRef} className="beam-glow" filter="url(#candid-beam-blur)" />
        <path ref={corePathRef} className="beam-core" />
      </svg>

      <div ref={leftNodeRef} className="icon-node node-light-right" title="Your resume">
        <FileText className="w-5 h-5 text-foreground/70" strokeWidth={1.5} />
      </div>

      <div className="pipeline-line" />

      <div className="relative">
        <div ref={splashRef} className="splash" />
        <div ref={centerNodeRef} className="icon-node-center" title="CandidAI engine">
          <Flame className="w-6 h-6 text-gold" strokeWidth={1.5} />
        </div>
      </div>

      <div className="pipeline-line right" />

      <div ref={rightNodeRef} className="icon-node node-light-left" title="Your verdict">
        <span ref={tierRef} className="font-display text-xl leading-none text-foreground/80 pt-0.5">
          C
        </span>
      </div>
    </div>
  );
}

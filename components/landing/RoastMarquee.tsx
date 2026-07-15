import { Flame } from 'lucide-react';

const LINES = [
  'Six bullets. Zero numbers.',
  '“Exposure to” is not a skill.',
  'Objective statements died in 2014.',
  '“Hard-working team player” — so is everyone.',
  'Your GPA is not a personality.',
  'Two pages. You’re an intern, not a CEO.',
  '“Proficient in Microsoft Word” — brave.',
  'The ATS gave up on line four.',
];

/** Infinite ticker of roast one-liners. Pauses on hover. */
export function RoastMarquee() {
  const items = [...LINES, ...LINES];
  return (
    <div className="marquee border-y border-border bg-card/40 py-4" aria-hidden="true">
      <div className="marquee-track items-center gap-10 pr-10">
        {items.map((line, i) => (
          <span key={i} className="flex items-center gap-10 shrink-0">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-foreground/40 whitespace-nowrap">
              {line}
            </span>
            <Flame className="w-3.5 h-3.5 text-gold/50 shrink-0" />
          </span>
        ))}
      </div>
    </div>
  );
}

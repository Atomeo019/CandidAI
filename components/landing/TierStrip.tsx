'use client';

import { useState } from 'react';
import { TierBadge, type Tier } from '@/components/brand/TierBadge';
import { cn } from '@/lib/utils';

const TIERS: { tier: Tier; label: string; line: string }[] = [
  { tier: 'S', label: 'Elite', line: 'Top of the stack. Recruiters call back the same day.' },
  { tier: 'A', label: 'Strong', line: 'Quantified impact, clean signal. Only trims left.' },
  { tier: 'B', label: 'Solid', line: 'Good bones. Duties listed where outcomes should be.' },
  { tier: 'C', label: 'Needs Work', line: 'The median. In a stack of 400, median means invisible.' },
  { tier: 'D', label: 'Struggling', line: 'Keyword soup. The ATS ate it and moved on.' },
  { tier: 'F', label: 'Start Over', line: 'Every section is working against you. Rebuild it.' },
];

/** Interactive tier scale — hover or tap a grade to read its verdict. */
export function TierStrip() {
  const [active, setActive] = useState<Tier>('C');
  const current = TIERS.find((t) => t.tier === active)!;

  return (
    <div>
      <div className="flex items-start justify-center gap-3 md:gap-7 flex-wrap">
        {TIERS.map(({ tier, label }) => {
          const isActive = active === tier;
          return (
            <button
              key={tier}
              type="button"
              onMouseEnter={() => setActive(tier)}
              onFocus={() => setActive(tier)}
              onClick={() => setActive(tier)}
              aria-pressed={isActive}
              className={cn(
                'group flex flex-col items-center gap-2.5 outline-none transition-all duration-300',
                isActive ? '-translate-y-1' : 'opacity-50 hover:opacity-90'
              )}
            >
              <TierBadge
                tier={tier}
                size="sm"
                className={cn(
                  'transition-shadow duration-300',
                  isActive && 'shadow-[0_0_28px_rgba(201,168,76,0.22)]'
                )}
              />
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <p
        key={active}
        className="tier-line mt-8 text-center text-foreground/60 text-sm md:text-base max-w-md mx-auto leading-relaxed"
      >
        &ldquo;{current.line}&rdquo;
      </p>
    </div>
  );
}

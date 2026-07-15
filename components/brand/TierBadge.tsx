import * as React from 'react';
import { cn } from '@/lib/utils';

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

const TIER_STYLES: Record<Tier, string> = {
  S: 'bg-gold text-background ring-1 ring-gold',
  A: 'border border-confirm text-confirm bg-confirm/10',
  B: 'border border-border text-foreground bg-card',
  C: 'border border-muted text-muted-foreground bg-card',
  D: 'border border-destructive/60 text-destructive bg-destructive/10',
  F: 'bg-destructive text-destructive-foreground ring-1 ring-destructive',
};

const SIZE_STYLES = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
};

interface TierBadgeProps {
  tier: Tier;
  size?: keyof typeof SIZE_STYLES;
  className?: string;
}

function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center font-display',
        TIER_STYLES[tier],
        SIZE_STYLES[size],
        className
      )}
    >
      {tier}
    </div>
  );
}

export { TierBadge };

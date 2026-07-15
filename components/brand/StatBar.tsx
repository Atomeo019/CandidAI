import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatBarProps {
  label: string;
  value: number;
  className?: string;
  barClassName?: string;
}

function StatBar({ label, value, className, barClassName }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs text-foreground">{clamped}</span>
      </div>
      <div className="h-px w-full bg-border relative">
        <div
          className={cn('h-px absolute left-0 top-0 bg-gold', barClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export { StatBar };

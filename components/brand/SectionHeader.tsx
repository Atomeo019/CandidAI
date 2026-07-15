import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

function SectionHeader({ eyebrow, title, subtitle, align = 'left', className }: SectionHeaderProps) {
  return (
    <div className={cn(align === 'center' ? 'text-center mx-auto' : 'text-left', className)}>
      {eyebrow && (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-4xl md:text-5xl uppercase leading-[0.95] tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className={cn('mt-4 text-secondary max-w-[65ch]', align === 'center' && 'mx-auto')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export { SectionHeader };

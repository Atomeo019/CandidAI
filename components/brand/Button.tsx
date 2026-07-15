import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const brandButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono uppercase tracking-[0.15em] text-xs transition-all duration-300 disabled:pointer-events-none disabled:opacity-40 active:translate-y-[1px]',
  {
    variants: {
      variant: {
        primary:
          'bg-gold text-background hover:bg-gold/90 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(201,168,76,0.55)]',
        outline:
          'border border-border text-foreground hover:border-gold hover:text-gold hover:-translate-y-0.5',
        ghost: 'text-muted-foreground hover:text-foreground',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-4',
        lg: 'h-14 px-8 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface BrandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brandButtonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, BrandButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(brandButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'BrandButton';

export { Button, brandButtonVariants };

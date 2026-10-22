import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'primary' | 'danger' | 'warning' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

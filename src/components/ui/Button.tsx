import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  accent: 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-foreground border border-border hover:bg-surface-muted',
  ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground hover:bg-danger hover:text-white',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-8 w-8 text-xs',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') {
  return cn(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-colors',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size]
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(buttonClasses(variant, size), className)} {...props} />;
}

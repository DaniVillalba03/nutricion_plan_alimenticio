'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

/** Control segmentado para alternar vistas o filtros cortos. */
export function Tabs<T extends string>({ value, onChange, options, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl bg-surface-muted p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            opt.value === value ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

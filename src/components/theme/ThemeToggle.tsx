'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Los iconos y textos se alternan con CSS (`dark:`) para que coincidan con el
 * script anti-flash desde el primer render, sin depender del estado de React.
 */
export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground',
        showLabel ? 'px-2.5 text-[13px]' : 'w-9',
        className
      )}
      title="Alternar modo claro / oscuro"
      aria-label="Alternar tema claro/oscuro"
      suppressHydrationWarning
    >
      <Moon className="h-[18px] w-[18px] dark:hidden" strokeWidth={1.75} aria-hidden="true" />
      <Sun className="hidden h-[18px] w-[18px] dark:block" strokeWidth={1.75} aria-hidden="true" />
      {showLabel && (
        <span>
          <span className="dark:hidden">Modo oscuro</span>
          <span className="hidden dark:inline">Modo claro</span>
        </span>
      )}
    </button>
  );
}

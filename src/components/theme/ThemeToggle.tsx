'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

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
      className={`inline-flex items-center justify-center gap-2 p-2 rounded-xl border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground transition-colors ${className}`}
      title="Alternar modo claro / oscuro"
      aria-label="Alternar tema claro/oscuro"
      suppressHydrationWarning
    >
      <Moon className="w-4 h-4 dark:hidden" aria-hidden="true" />
      <Sun className="w-4 h-4 hidden dark:block text-warning" aria-hidden="true" />
      {showLabel && (
        <span className="text-xs font-semibold">
          <span className="dark:hidden">Modo Oscuro</span>
          <span className="hidden dark:inline">Modo Claro</span>
        </span>
      )}
    </button>
  );
}

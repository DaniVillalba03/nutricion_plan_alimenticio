'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface ToastContextType {
  toast: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, durationMs = 3200) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), durationMs);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
        {message && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground shadow-2xl">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de un ToastProvider');
  return ctx;
}

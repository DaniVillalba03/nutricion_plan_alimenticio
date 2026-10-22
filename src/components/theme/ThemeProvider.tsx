'use client';

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'nutriplan-theme';
const THEME_EVENT = 'nutriplan-theme-change';

interface ThemeContextType {
  /** Tema efectivo aplicado (resuelve "system"). */
  theme: Theme;
  /** Preferencia elegida por el usuario. */
  preference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage no disponible (modo privado, etc.)
  }
  return 'system';
}

function subscribePreference(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const systemIsDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Ambos valores viven fuera de React (localStorage y el sistema operativo).
  const preference = useSyncExternalStore<ThemePreference>(subscribePreference, readPreference, () => 'system');
  const prefersDark = useSyncExternalStore(subscribeSystem, systemIsDark, () => false);

  const theme: Theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

  // El script anti-flash del layout aplica la clase antes del primer pintado;
  // este efecto la mantiene sincronizada con los cambios posteriores.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignorar
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}

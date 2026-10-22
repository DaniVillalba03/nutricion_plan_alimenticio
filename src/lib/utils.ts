import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales y resuelve conflictos de Tailwind (la última gana). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Identificador único legible para elementos creados en el cliente. */
export function newId(prefix: string): string {
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${unique}`;
}

/** Copia profunda de datos serializables (planes, comidas). */
export function cloneDeep<T>(value: T): T {
  return structuredClone(value);
}

import { Coffee, Cookie, Moon, Sun, Sunrise, Utensils } from 'lucide-react';

export const MEAL_ICONS = { sunrise: Sunrise, coffee: Coffee, sun: Sun, cookie: Cookie, moon: Moon, utensils: Utensils } as const;

/** Clave del icono según el momento del día de la comida. */
export function mealIconKey(name: string): keyof typeof MEAL_ICONS {
  const n = name.toLowerCase();
  if (n.includes('desayuno')) return 'sunrise';
  if (n.includes('media') || n.includes('colaci')) return 'coffee';
  if (n.includes('almuerzo')) return 'sun';
  if (n.includes('merienda')) return 'cookie';
  if (n.includes('cena') || n.includes('noct')) return 'moon';
  return 'utensils';
}

import React from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandProps {
  className?: string;
  /** Tamaño del nombre; la marca se escala con él. */
  size?: 'sm' | 'md' | 'lg';
  /** Fija los colores para usarse sobre fondos oscuros fijos (p. ej. el panel del login). */
  onDark?: boolean;
}

const SIZES = {
  sm: { mark: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5', text: 'text-lg', gap: 'gap-2' },
  md: { mark: 'h-7 w-7 rounded-lg', icon: 'h-4 w-4', text: 'text-[22px]', gap: 'gap-2.5' },
  lg: { mark: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5', text: 'text-3xl', gap: 'gap-3' },
};

/**
 * Firma de la marca: una marca plana (hoja sobre el color de la marca) y el nombre en serif.
 * Es el principal punto donde aparece el color de marca en la interfaz.
 */
export function Brand({ className, size = 'md', onDark }: BrandProps) {
  const s = SIZES[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <span
        className={cn('flex shrink-0 items-center justify-center bg-primary text-primary-foreground', s.mark)}
        aria-hidden="true"
      >
        <Leaf className={s.icon} strokeWidth={2} />
      </span>
      <span
        className={cn(
          'font-display font-medium leading-none tracking-tight',
          s.text,
          onDark ? 'text-[#f2f2f4]' : 'text-foreground'
        )}
      >
        NutriPlan
        <span className="ml-1 align-super font-sans text-[10px] font-semibold tracking-wider text-muted">PY</span>
      </span>
    </span>
  );
}

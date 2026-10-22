import React from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandProps {
  className?: string;
  /** Tamaño del nombre; el icono se escala con él. */
  size?: 'sm' | 'md' | 'lg';
  /** Fija los colores para usarse sobre fondos oscuros fijos (p. ej. el panel del login). */
  onDark?: boolean;
}

const SIZES = {
  sm: { icon: 'h-[18px] w-[18px]', text: 'text-lg', gap: 'gap-1.5' },
  md: { icon: 'h-5 w-5', text: 'text-[22px]', gap: 'gap-2' },
  lg: { icon: 'h-7 w-7', text: 'text-3xl', gap: 'gap-2.5' },
};

/** Firma de la marca: hoja verde y nombre en negrita con tracking cerrado. */
export function Brand({ className, size = 'md', onDark }: BrandProps) {
  const s = SIZES[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <Leaf
        className={cn('shrink-0 fill-primary/25 text-primary-text', s.icon, onDark && 'text-[#2ad15a]')}
        strokeWidth={2.2}
        aria-hidden="true"
      />
      <span
        className={cn(
          'font-bold leading-none tracking-[-0.045em]',
          s.text,
          onDark ? 'text-[#eaf3ed]' : 'text-foreground'
        )}
      >
        NutriPlan
        <span className="mono-label ml-1.5 align-middle text-[10px] text-subtle">PY</span>
      </span>
    </span>
  );
}

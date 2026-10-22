import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  /** Línea de contexto bajo el título (datos, no marketing). */
  description?: React.ReactNode;
  /** Pequeña etiqueta sobre el título. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Cabecera de página: título serif, contexto y acciones alineadas a la derecha. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[13px] font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-[28px] font-medium leading-tight text-foreground sm:text-[32px]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Título de sección dentro de una página, con acciones opcionales. */
export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-xl font-medium text-foreground">{children}</h2>
      {aside && <div className="text-[13px] text-muted">{aside}</div>}
    </div>
  );
}

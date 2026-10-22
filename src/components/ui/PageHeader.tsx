import React from 'react';
import { cn } from '@/lib/utils';

/** Microetiqueta de sección: punto verde + texto mono en mayúsculas (`● EL PROBLEMA`). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mono-label flex items-center gap-2 text-subtle', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </p>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  /** Línea de contexto bajo el título (datos, no marketing). */
  description?: React.ReactNode;
  /** Microetiqueta sobre el título. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Cabecera de página: eyebrow mono, título en negrita tracking cerrado, contexto y acciones. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="text-[34px] text-foreground sm:text-[44px]">{title}</h1>
        {description && <div className="mt-3 max-w-2xl text-base text-muted">{description}</div>}
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
      <h2 className="text-2xl font-bold text-foreground">{children}</h2>
      {aside && <div className="text-[13px] text-muted">{aside}</div>}
    </div>
  );
}

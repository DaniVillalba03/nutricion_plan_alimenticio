import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

/** Pantalla centrada para errores y rutas inexistentes, con el mismo lenguaje visual que el resto. */
export function ErrorState({ title, description, children }: ErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-3xl">{title}</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">{description}</p>
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

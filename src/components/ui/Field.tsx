import React, { useId } from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-[10px] border border-border-strong bg-surface px-3.5 text-[15px] text-foreground placeholder:text-subtle ' +
  'transition-colors focus:outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/20 ' +
  'disabled:opacity-60 aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'h-10', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, 'h-10 pr-8', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'py-2 min-h-20', className)} {...props} />;
}

interface FieldControlProps {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  /** Recibe el id generado para asociarlo al control. */
  children: (props: FieldControlProps) => React.ReactNode;
}

/** Etiqueta + control + ayuda/error, con ids asociados para accesibilidad. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="mono-label block text-muted">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': note ? noteId : undefined,
      })}
      {note && (
        <p id={noteId} className={cn('text-[13px]', error ? 'text-danger' : 'text-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}

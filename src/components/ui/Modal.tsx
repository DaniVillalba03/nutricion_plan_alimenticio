'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  /** Zona fija inferior (botones de acción). */
  footer?: React.ReactNode;
  className?: string;
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Modal sobre <dialog> nativo: el navegador aporta el foco atrapado, Esc, role="dialog"
 * y el fondo inerte. En móvil se muestra como hoja inferior.
 */
export function Modal({ open, onClose, title, description, size = 'md', children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Un clic directo sobre el <dialog> (no sobre su contenido) es un clic en el fondo.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'p-0 m-auto w-full max-h-[90dvh] rounded-[18px] border border-border bg-surface-elevated text-foreground shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)]',
        'backdrop:bg-overlay backdrop:backdrop-blur-sm',
        'max-sm:mb-0 max-sm:max-w-full max-sm:rounded-b-none',
        SIZES[size],
        className
      )}
      aria-label={title}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

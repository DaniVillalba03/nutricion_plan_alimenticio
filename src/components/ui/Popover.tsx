'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  /** Contenido del botón disparador. */
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  align?: 'left' | 'right';
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

/** Panel flotante anclado a un botón; se cierra con clic fuera o Esc. */
export function Popover({
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'right',
  panelClassName,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 min-w-56 rounded-[14px] border border-border bg-surface-elevated p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function MenuItem({ icon, className, children, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted',
        className
      )}
      {...props}
    >
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </button>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Utensils, BookOpen, Users, Menu, X, Apple, UploadCloud, LogOut } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Constructor de Planes',
    icon: Utensils,
    description: 'Crear y ajustar intercambios en vivo',
  },
  {
    href: '/dashboard/foods',
    label: 'Catálogo de Alimentos',
    icon: BookOpen,
    description: 'Grupos y equivalencias en Paraguay',
  },
  {
    href: '/dashboard/clients',
    label: 'Pacientes y Metas',
    icon: Users,
    description: 'Metas calóricas y restricciones',
  },
  {
    href: '/dashboard/import',
    label: 'Importador Masivo',
    icon: UploadCloud,
    description: 'Validador Atwater y base extendida',
  },
];

function Brand({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-primary text-primary-foreground',
          size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
        )}
      >
        <Apple className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
      <span className="leading-tight">
        <span className="flex items-center gap-1.5">
          <span className={cn('font-bold tracking-tight text-foreground', size === 'md' ? 'text-lg' : 'text-base')}>
            NutriPlan
          </span>
          <span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
            PY
          </span>
        </span>
        {size === 'md' && <span className="block text-xs text-muted">Motor de intercambios</span>}
      </span>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    document.cookie = 'nutriplan_demo_session=; path=/; max-age=0;';
    if (isSupabaseConfigured()) {
      try {
        await createClient().auth.signOut();
      } catch {
        // la cookie de sesión se limpia igualmente al expirar
      }
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Cabecera móvil */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Brand size="sm" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
            <Brand />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-muted hover:text-foreground lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Navegación</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3.5 py-3 transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary-soft-foreground'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground'
                )}
              >
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-subtle')} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm leading-tight', isActive ? 'font-semibold' : 'font-medium')}>
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-subtle">{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-4">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted/50 p-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                LM
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">Lic. Laura Molinas</span>
                <span className="block truncate text-xs text-muted">Reg. Prof. 6020</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle className="border-transparent bg-transparent" />
              <button
                type="button"
                onClick={logout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="rounded-xl p-2 text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="px-1 text-xs text-subtle">NutriPlan PY v2.0</p>
        </div>
      </aside>
    </>
  );
}

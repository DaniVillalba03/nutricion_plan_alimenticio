'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Utensils, BookOpen, Users, Menu, X, UploadCloud, LogOut } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Brand } from './Brand';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Constructor de planes', icon: Utensils },
  { href: '/dashboard/clients', label: 'Pacientes', icon: Users },
  { href: '/dashboard/foods', label: 'Catálogo de alimentos', icon: BookOpen },
  { href: '/dashboard/import', label: 'Importar alimentos', icon: UploadCloud },
];

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
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
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
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col overflow-hidden border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{ backgroundImage: 'radial-gradient(90% 100% at 10% 0%, var(--glow), transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between px-7 pb-8 pt-8">
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

        <nav className="relative flex-1 space-y-1 px-4" aria-label="Navegación principal">
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
                  'flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] transition-colors',
                  isActive
                    ? 'bg-primary-soft font-semibold text-primary-soft-foreground'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground'
                )}
              >
                <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-soft-foreground' : 'text-subtle')} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="mono-label flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"
              aria-hidden="true"
            >
              LM
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">Lic. Laura Molinas</p>
              <p className="text-[13px] text-muted">Reg. Prof. 6020</p>
            </div>
          </div>
          <div className="-ml-2 mt-3 flex items-center gap-1">
            <ThemeToggle showLabel />
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

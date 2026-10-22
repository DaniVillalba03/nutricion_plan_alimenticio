import React, { Suspense } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { PatientsProvider } from '@/components/patients/PatientsProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { getDashboardDataAction } from '@/actions/nutrition-actions';

/**
 * Carga pacientes y planes en el servidor, antes de enviar la pantalla, para que lleguen
 * con datos en lugar de pedirlos después desde el navegador (una cadena de esperas).
 */
async function DashboardShell({ children }: { children: React.ReactNode }) {
  const data = await getDashboardDataAction();

  return (
    <PatientsProvider initialClients={data?.clients} initialPlans={data?.plans}>
      <ToastProvider>
        <div className="min-h-screen flex flex-col lg:flex-row bg-background">
          {/* Sidebar fijo en desktop */}
          <Sidebar />

          {/* Contenido principal */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
            <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-12">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </PatientsProvider>
  );
}

/** Estructura que se ve al instante mientras el servidor trae los datos. */
function ShellSkeleton() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background" aria-busy="true" aria-label="Cargando">
      <div className="hidden lg:block fixed inset-y-0 left-0 w-[240px] border-r border-border bg-background" />
      <div className="flex-1 lg:pl-[240px]">
        <div className="mx-auto w-full max-w-[1120px] space-y-6 px-5 pt-12 sm:px-8 lg:px-12">
          <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-surface-muted" />
          <div className="grid grid-cols-1 gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <div className="h-56 animate-pulse rounded-xl bg-surface-muted" />
              <div className="h-56 animate-pulse rounded-xl bg-surface-muted" />
            </div>
            <div className="hidden h-72 animate-pulse rounded-xl bg-surface-muted lg:block" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

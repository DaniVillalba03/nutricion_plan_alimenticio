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
          <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
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
      <div className="hidden lg:block fixed inset-y-0 left-0 w-72 border-r border-border bg-surface" />
      <div className="flex-1 lg:pl-72">
        <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
            <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
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

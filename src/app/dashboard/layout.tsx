import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { PatientsProvider } from '@/components/patients/PatientsProvider';
import { ToastProvider } from '@/components/ui/Toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PatientsProvider>
      <ToastProvider>
        <div className="min-h-screen flex flex-col lg:flex-row bg-background">
          {/* Sidebar fijo en desktop */}
          <Sidebar />

          {/* Contenido principal */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </PatientsProvider>
  );
}

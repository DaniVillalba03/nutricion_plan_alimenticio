'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usePatients } from '@/components/patients/PatientsProvider';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { PatientCard } from '@/components/patients/PatientCard';
import { Button, Card, Modal, PageHeader, useToast } from '@/components/ui';
import type { Client } from '@/types/nutrition';

export default function ClientsPage() {
  const { clients, loading, selectClient, createClient, saveClient, deleteClient } = usePatients();
  const { toast } = useToast();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [toEdit, setToEdit] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteClient(toDelete.id);
    setDeleting(false);
    toast(result.ok ? `Paciente "${toDelete.fullName}" eliminado` : `No se pudo eliminar: ${result.error}`);
    if (result.ok) setToDelete(null);
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Pacientes"
        title="Tus pacientes"
        description="Requerimientos calóricos, reparto de macronutrientes y restricciones de cada perfil."
        actions={
          <Button variant="primary" onClick={() => setIsNewOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        }
      />

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
          {loading ? (
            <p className="text-[15px] text-muted">Cargando pacientes…</p>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-[-0.035em] text-foreground">Aún no hay pacientes</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">
                Crea el primero para empezar a armar su plan de intercambios.
              </p>
              <Button variant="primary" className="mt-5" onClick={() => setIsNewOpen(true)}>
                Crear el primer paciente
              </Button>
            </>
          )}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {clients.map((client) => (
              <PatientCard key={client.id} client={client} onOpenPlan={selectClient} onEdit={setToEdit} onDelete={setToDelete} />
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="¿Eliminar paciente?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="primary" className="bg-danger text-white hover:bg-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Eliminar paciente'}
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-foreground">
          Vas a eliminar a <strong>{toDelete?.fullName}</strong> junto con todos sus planes y versiones.
        </p>
        <p className="mt-2 text-sm text-muted">
          El enlace que le compartiste dejará de funcionar. Esta acción no se puede deshacer.
        </p>
      </Modal>

      {toEdit && (
        <NewPatientModal
          open
          client={toEdit}
          onClose={() => setToEdit(null)}
          onUpdate={async (client, input) => {
            setToEdit(null);
            const result = await saveClient(client, input);
            toast(result.ok ? `Cambios de "${client.fullName}" guardados` : `No se pudo guardar: ${result.error}`);
          }}
        />
      )}

      <NewPatientModal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreate={async (client, input) => {
          setIsNewOpen(false);
          const result = await createClient(client, input);
          toast(result.ok ? `Paciente "${client.fullName}" creado` : `No se pudo crear el paciente: ${result.error}`);
        }}
      />
    </div>
  );
}

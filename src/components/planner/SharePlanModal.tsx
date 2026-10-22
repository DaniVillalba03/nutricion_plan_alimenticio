'use client';

import React, { useState } from 'react';
import { Client, MealPlan } from '@/types/nutrition';
import { Copy, Check, ExternalLink, ShieldAlert, ShieldCheck, Calendar } from 'lucide-react';
import { Modal, Button, Input, buttonClasses } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  plan: MealPlan;
  onUpdateShareSettings: (isRevoked: boolean, expiresAt: string | null) => void;
}

type ExpiryOption = '30' | '90' | 'none';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'none', label: 'Sin expiración' },
];

export function SharePlanModal({ isOpen, onClose, client, plan, onUpdateShareSettings }: SharePlanModalProps) {
  const [copied, setCopied] = useState(false);
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('30');
  const [isRevoked, setIsRevoked] = useState(client.isShareRevoked || false);

  const token = client.shareToken || plan.shareToken || 'maria-elena-2026';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const shareUrl = `${baseUrl}/p/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleToggleRevoke = () => {
    const nextRevoked = !isRevoked;
    setIsRevoked(nextRevoked);

    let nextExpires: string | null = null;
    if (expiryOption !== 'none') {
      const d = new Date();
      d.setDate(d.getDate() + Number(expiryOption));
      nextExpires = d.toISOString().split('T')[0];
    }

    onUpdateShareSettings(nextRevoked, nextExpires);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Compartir plan con el paciente"
      description={`Portal móvil interactivo para ${client.fullName}`}
    >
      <div className="space-y-5">
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl p-3.5 text-xs',
            isRevoked ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground'
          )}
        >
          <span className="flex items-center gap-2">
            {isRevoked ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <ShieldCheck className="h-4 w-4 shrink-0" />}
            <span>
              Estado del enlace: <strong>{isRevoked ? 'Acceso revocado' : 'Activo y seguro'}</strong>
            </span>
          </span>
          <Button size="sm" variant={isRevoked ? 'primary' : 'danger'} onClick={handleToggleRevoke}>
            {isRevoked ? 'Reactivar enlace' : 'Revocar acceso'}
          </Button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="share-url" className="block text-xs font-semibold text-foreground">
            Enlace único del paciente
          </label>
          <div className="flex items-center gap-2">
            <Input id="share-url" readOnly value={shareUrl} className="flex-1 select-all font-mono text-xs" />
            <Button variant="accent" onClick={handleCopy} disabled={isRevoked} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Calendar className="h-3.5 w-3.5 text-muted" /> Vencimiento del token
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={expiryOption === opt.value}
                onClick={() => setExpiryOption(opt.value)}
                className={cn(
                  'rounded-xl border p-2.5 text-center text-xs font-semibold transition-colors',
                  expiryOption === opt.value
                    ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                    : 'border-border text-muted hover:bg-surface-muted'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <a
          href={`/p/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonClasses('primary', 'md'), 'w-full')}
        >
          <ExternalLink className="h-4 w-4" />
          Abrir vista móvil del paciente
        </a>
      </div>
    </Modal>
  );
}

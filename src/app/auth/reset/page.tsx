'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { Brand } from '@/components/layout/Brand';

const MIN_LENGTH = 10;

/** Destino del enlace de "Olvidé mi contraseña": canjea el código y permite fijar una contraseña nueva. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'loading' | 'ok' | 'invalid'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const code = new URLSearchParams(window.location.search).get('code');

    (async () => {
      // Flujo PKCE: el enlace trae un código que se canjea por una sesión temporal de recuperación
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setReady('invalid');
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setReady(data.session ? 'ok' : 'invalid');
    })().catch(() => {
      if (!cancelled) setReady('invalid');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < MIN_LENGTH) {
      setErrorMsg(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    startTransition(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 900);
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <Brand size="md" className="mb-10" />

        {ready === 'loading' && <p className="text-[15px] text-muted">Verificando el enlace…</p>}

        {ready === 'invalid' && (
          <>
            <h1 className="text-[34px]">Este enlace ya no sirve</h1>
            <p className="mt-2 text-[15px] text-muted">
              Venció o ya fue usado. Pide uno nuevo desde la pantalla de ingreso con «¿Olvidaste tu contraseña?».
            </p>
            <Button variant="primary" className="mt-6" onClick={() => router.push('/login')}>
              Ir a ingresar
            </Button>
          </>
        )}

        {ready === 'ok' && (
          <>
            <h1 className="text-[34px]">Crea una contraseña nueva</h1>
            <p className="mt-2 text-[15px] text-muted">Mínimo {MIN_LENGTH} caracteres.</p>

            {errorMsg && (
              <p role="alert" className="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                {errorMsg}
              </p>
            )}
            {done && (
              <p role="status" className="mt-6 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
                Contraseña actualizada. Redirigiendo…
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <Field label="Contraseña nueva">
                {(p) => (
                  <Input {...p} type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                )}
              </Field>
              <Field label="Repite la contraseña">
                {(p) => (
                  <Input {...p} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                )}
              </Field>
              <Button type="submit" variant="primary" disabled={isPending || done} className="w-full">
                {isPending ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

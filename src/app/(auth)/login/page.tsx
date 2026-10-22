'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured, isDemoAccessEnabled } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const configured = isSupabaseConfigured();

    if (!configured) {
      // Si Supabase aún no tiene credenciales en .env.local, activamos sesión demo
      document.cookie = 'nutriplan_demo_session=true; path=/; max-age=86400; SameSite=Lax';
      setSuccessMsg('Acceso autorizado como Lic. Laura Molinas (Modo Demostración)');
      setTimeout(() => {
        router.push(nextUrl);
        router.refresh();
      }, 700);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();

        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: 'Lic. Laura Molinas',
                license_number: '6020',
                role: 'nutritionist',
              },
            },
          });

          if (error) {
            setErrorMsg(error.message);
          } else {
            setSuccessMsg('¡Cuenta creada con éxito! Puedes iniciar sesión ahora.');
            setIsSignUp(false);
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            setErrorMsg(
              error.message === 'Invalid login credentials'
                ? 'Correo o contraseña incorrectos. Verifica tus credenciales de Supabase.'
                : error.message
            );
          } else {
            setSuccessMsg('Sesión iniciada correctamente. Redirigiendo...');
            setTimeout(() => {
              router.push(nextUrl);
              router.refresh();
            }, 500);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con Supabase';
        setErrorMsg(msg);
      }
    });
  };

  const demoEnabled = isDemoAccessEnabled();

  const handleDemoAccess = () => {
    if (!demoEnabled) return;
    document.cookie = 'nutriplan_demo_session=true; path=/; max-age=86400; SameSite=Lax';
    setSuccessMsg('Acceso rápido concedido como Lic. Laura Molinas (Reg. 6020)');
    setTimeout(() => {
      router.push(nextUrl);
      router.refresh();
    }, 400);
  };

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panel de marca: solo tipografía y una cita, sin ilustraciones genéricas */}
      <aside className="hidden flex-col justify-between bg-surface-muted p-12 lg:flex">
        <p className="font-display text-2xl font-medium tracking-tight">
          NutriPlan<span className="ml-1 align-super font-sans text-[11px] font-semibold tracking-wider text-primary">PY</span>
        </p>
        <blockquote className="max-w-md">
          <p className="font-display text-[34px] font-medium italic leading-snug text-foreground">
            Un hábito que fue aprendido puede ser reeducado.
          </p>
          <footer className="mt-5 text-[15px] text-muted">Lic. Laura Molinas · Reg. Prof. 6020</footer>
        </blockquote>
        <p className="text-[13px] text-muted">Planificación por intercambios con alimentos de Paraguay</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-10 font-display text-2xl font-medium tracking-tight lg:hidden">
            NutriPlan<span className="ml-1 align-super font-sans text-[11px] font-semibold tracking-wider text-primary">PY</span>
          </p>

          <h1 className="text-[32px] font-medium leading-tight">{isSignUp ? 'Crea tu cuenta' : 'Bienvenida de vuelta'}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {isSignUp
              ? 'Registro profesional para nutricionistas.'
              : 'Ingresa con tu correo para ver a tus pacientes y sus planes.'}
          </p>

          {errorMsg && (
            <p role="alert" className="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p role="status" className="mt-6 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
              {successMsg}
            </p>
          )}

          <form onSubmit={handleAuth} className="mt-8 space-y-5">
            <Field label="Correo electrónico">
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                />
              )}
            </Field>

            <Field label="Contraseña">
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            <Button type="submit" variant="primary" disabled={isPending} className="w-full">
              {isPending ? 'Procesando…' : isSignUp ? 'Crear cuenta' : 'Ingresar'}
              {!isPending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-[15px] text-muted">
            {isSignUp ? '¿Ya tienes cuenta? ' : '¿Todavía no tienes cuenta? '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? 'Ingresa' : 'Crea una'}
            </button>
          </p>

          {demoEnabled && (
            <div className="mt-8 border-t border-border pt-6">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Entrar con datos de demostración
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-primary text-xs font-semibold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            Cargando acceso profesional...
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}

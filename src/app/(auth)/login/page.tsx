'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured, isDemoAccessEnabled } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui';
import { Brand } from '@/components/layout/Brand';
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
      {/* Panel de marca: grafito con un degradado suave (verde de marca y un tono frío) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0c0d10] p-12 text-[#eceef1] lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(60% 55% at 22% 100%, rgb(31 191 74 / 0.20), transparent 70%), radial-gradient(50% 50% at 95% 0%, rgb(90 130 240 / 0.14), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <Brand size="md" onDark className="relative" />
        <div className="relative max-w-lg">
          <p className="mono-label mb-5 flex items-center gap-2 text-[#a3a8b0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ad15a]" aria-hidden="true" />
            Nutrición por intercambios
          </p>
          <h2 className="text-[52px] font-bold leading-[1.02] tracking-[-0.045em]">
            Planes claros, con alimentos de <span className="text-[#2ad15a]">Paraguay</span>.
          </h2>
          <p className="mt-6 max-w-md text-base text-[#a3a8b0]">
            Arma el plan de cada paciente en minutos y compártelo en un enlace que se actualiza solo.
          </p>
        </div>
        <p className="mono-label relative text-[#737982]">Lic. Laura Molinas · Reg. Prof. 6020</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Brand size="md" className="mb-10 lg:hidden" />

          <h1 className="text-[40px]">{isSignUp ? 'Crea tu cuenta' : 'Bienvenida'}</h1>
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
              className="font-medium text-foreground underline underline-offset-4 decoration-border-strong hover:decoration-foreground"
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
          <div className="text-primary-text text-xs font-semibold flex items-center gap-2">
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

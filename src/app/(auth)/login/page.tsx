'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured, isDemoAccessEnabled } from '@/lib/supabase/client';
import { Badge, Button, Card, Field, Input } from '@/components/ui';
import {
  Apple,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary text-primary-foreground shadow-lg mb-2">
            <Apple className="w-9 h-9" />
          </div>
          <div className="flex items-center justify-center">
            <Badge tone="primary">Lic. Laura Molinas · Reg. 6020</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">NutriPlan PY</h1>
          <p className="text-sm text-muted max-w-xs mx-auto">
            Plataforma clínica de planificación por intercambios y portal del paciente
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" />
              {isSignUp ? 'Registro profesional' : 'Acceso profesional'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {isSignUp ? '¿Ya tienes cuenta? Iniciar' : 'Crear cuenta'}
            </button>
          </div>

          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-danger-soft text-danger-soft-foreground text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" className="p-3 rounded-xl bg-primary-soft text-primary-soft-foreground text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <Field label="Correo electrónico">
              {(p) => (
                <div className="relative">
                  <Mail className="w-4 h-4 text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    {...p}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@nutriplan.py"
                    className="pl-10"
                  />
                </div>
              )}
            </Field>

            <Field label="Contraseña">
              {(p) => (
                <div className="relative">
                  <Lock className="w-4 h-4 text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    {...p}
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10"
                  />
                </div>
              )}
            </Field>

            <Button type="submit" variant="primary" disabled={isPending} className="w-full">
              {isPending ? (
                'Procesando...'
              ) : (
                <>
                  {isSignUp ? 'Crear cuenta profesional' : 'Ingresar al constructor'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {demoEnabled && (
            <div className="pt-2 border-t border-border">
              <Button onClick={handleDemoAccess} className="w-full">
                <Sparkles className="w-3.5 h-3.5 text-warning" />
                Acceso rápido demo (Lic. Laura Molinas)
              </Button>
            </div>
          )}
        </Card>

        <div className="text-center space-y-1 text-xs text-subtle">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Seguridad RLS activa por nutricionista · Asunción, Paraguay
          </p>
          <p>Reg. Prof.: 6020 · Cumplimiento de estándares nutricionales nacionales</p>
        </div>
      </div>
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

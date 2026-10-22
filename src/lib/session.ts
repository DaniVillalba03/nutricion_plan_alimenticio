/** Mensaje que devuelven las acciones de servidor cuando se perdió la sesión. */
export const SESSION_EXPIRED = 'Tu sesión venció. Vuelve a iniciar sesión para continuar.';

export function isSessionExpired(error?: string | null): boolean {
  return error === SESSION_EXPIRED;
}

/**
 * Si el error es de sesión vencida, lleva al inicio de sesión (con aviso) y devuelve `true`.
 * Se usa en el navegador tras una acción que falló.
 */
export function redirectIfSessionExpired(error?: string | null): boolean {
  if (!isSessionExpired(error)) return false;
  // Navegación completa a propósito: reinicia el estado del cliente junto con la sesión
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (typeof window !== 'undefined') window.location.assign('/login?expired=1');
  return true;
}

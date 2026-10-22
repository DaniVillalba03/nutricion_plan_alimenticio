#!/usr/bin/env node
// Guardrail PreToolUse (Bash/PowerShell): convierte las reglas de CLAUDE.md en imposibles físicas.
// - DENIEGA lo destructivo o lo que toca producción (git destructivo, Supabase CLI, deploy a prod…).
// - PIDE CONFIRMACIÓN antes de leer archivos con secretos (.env*).
// Falla cerrado ante la duda razonable y siempre explica la regla y la alternativa.
import fs from 'node:fs';

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const cmd = String(payload?.tool_input?.command ?? '').trim();
if (!cmd) process.exit(0);

const decide = (decision, reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
    })
  );
  process.exit(0);
};

// Quita contenido entre comillas para no disparar por textos (p. ej. mensajes de commit)
const bare = cmd.replace(/<<\s*'?(\w+)'?[\s\S]*?\n\1\b/g, ' ').replace(/"[^"\n]*"|'[^'\n]*'/g, ' "" ');

const DENY = [
  [/\bgit\s+push\b[^|;&]*\s(--force\b|-f\b|--force-with-lease\b|--delete\b|:\w)/, 'Push forzado o borrado de ramas remotas: reescribe el historial que despliega Vercel. Si de verdad hace falta, que la usuaria lo ejecute.'],
  [/\bgit\s+reset\s+--hard\b/, '`git reset --hard` descarta cambios sin guardar. Usa `git stash push` o un commit de respaldo.'],
  [/\bgit\s+clean\s+-[a-z]*f/i, '`git clean -f` borra archivos sin seguimiento (puede incluir `.env.local`). Revisa con `git clean -n` y confirma con la usuaria.'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.\s*($|[;&|])/, 'Descartar todos los cambios del árbol de trabajo. Pide confirmación a la usuaria y nombra los archivos.'],
  [/\bgit\s+branch\s+-D\b/, 'Borrado forzado de rama. Usa `-d` o confirma con la usuaria.'],
  [/\bsupabase\s+(db\s+(push|reset|remote)|link|projects\s+delete)\b/, 'Supabase CLI contra la base real. Las migraciones las aplica la usuaria en el SQL Editor; tú solo escribes el archivo en supabase/migrations/.'],
  [/\b(psql|pg_dump|pg_restore)\b/, 'Acceso directo a Postgres: no se toca la base desde aquí. Genera el SQL y que la usuaria lo ejecute.'],
  [/\bvercel\b[^|;&]*\s(--prod\b|deploy\b|rm\b|remove\b|env\s+(add|rm)\b)/, 'Cambios de despliegue/entorno en Vercel: se despliega con `git push` a main (con permiso de la usuaria) y las variables las gestiona ella en el panel.'],
  [/\bnpm\s+(publish|unpublish|audit\s+fix\s+--force)\b/, 'Operación de npm con efectos amplios. No es necesaria en este proyecto.'],
  [/\b(rm|rmdir)\s+(-[a-z]*r[a-z]*f?|-[a-z]*f[a-z]*r?)\s+(?!(\.next|node_modules|dist|out|coverage|\.turbo|\$TEMP|\/tmp)\b)[^\s;&|]+/i, '`rm -r` fuera de carpetas de compilación (.next, node_modules, dist, out, coverage). Nombra exactamente qué borrar y confirma con la usuaria.'],
  [/\bRemove-Item\b[^|;&]*-Recurse\b(?![^|;&]*(\.next|node_modules|\\dist|\\out|coverage|\$env:TEMP|\$env:TMP))/i, '`Remove-Item -Recurse` fuera de carpetas de compilación. Nombra qué borrar y confirma con la usuaria.'],
];

for (const [re, reason] of DENY) {
  if (re.test(bare)) decide('deny', reason);
}

// Secretos: leer .env* (excepto el ejemplo) pide confirmación; volcar variables también
const readsEnv = /\b(cat|type|more|less|head|tail|grep|rg|sed|awk|Get-Content|gc|Select-String)\b[^|;&]*\.env(\.[\w-]+)?\b(?!\.example)/i;
if (readsEnv.test(bare) && !/\.env\.local\.example/.test(cmd)) {
  decide('ask', 'Vas a leer un archivo .env (contiene llaves de Supabase). Confirma que la usuaria lo pidió; si solo necesitas saber si una variable existe, comprueba su nombre sin imprimir el valor.');
}
if (/\b(printenv|Get-ChildItem\s+env:|gci\s+env:)\b/i.test(bare) || /^\s*env\s*($|\|)/.test(bare)) {
  decide('ask', 'Volcar todas las variables de entorno puede exponer secretos. Pide solo la que necesitas.');
}

process.exit(0);

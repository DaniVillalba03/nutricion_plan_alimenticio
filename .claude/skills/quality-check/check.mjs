#!/usr/bin/env node
// Verificación acotada al diff: tsc (proyecto), eslint y vitest solo sobre lo cambiado.
// Salida compacta: una línea por problema. Código de salida != 0 si algo falla.
import { execFileSync, spawnSync } from 'node:child_process';

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);

// Archivos cambiados: modificados/añadidos frente a HEAD + nuevos sin seguimiento
const changed = [...new Set([...git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])];
const code = changed.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && f.startsWith('src/'));
const sources = code.filter((f) => !/\.test\./.test(f));

const lines = [];
let failed = false;
const fail = (msg) => {
  failed = true;
  lines.push(msg);
};

console.log(`Archivos de código cambiados: ${code.length}`);

// 1) Tipos (proyecto completo: tarda unos segundos y es la única forma fiable)
{
  const r = run('npx', ['tsc', '--noEmit', '--pretty', 'false']);
  const errs = (r.stdout || '').split('\n').filter((l) => /error TS\d+/.test(l));
  if (r.status === 0) lines.push('tipos: OK');
  else errs.slice(0, 15).forEach((l) => fail(`tipos: ${l.trim().slice(0, 160)}`));
  if (errs.length > 15) lines.push(`tipos: … y ${errs.length - 15} errores más`);
  if (r.status !== 0 && errs.length === 0) fail('tipos: tsc falló sin errores TS (ver `npx tsc --noEmit`)');
}

// 2) Lint solo de lo cambiado
if (code.length) {
  const r = run('npx', ['eslint', '--format', 'unix', ...code]);
  const out = (r.stdout || '').split('\n').filter((l) => /:\d+:\d+:/.test(l));
  if (r.status === 0) lines.push(`lint: OK (${code.length} archivos)`);
  else out.slice(0, 15).forEach((l) => fail(`lint: ${l.trim().slice(0, 160)}`));
  if (out.length > 15) lines.push(`lint: … y ${out.length - 15} avisos más`);
} else lines.push('lint: sin archivos de código cambiados');

// 3) Pruebas relacionadas con lo cambiado (si no hay nada relacionado, no corre nada)
if (sources.length || code.some((f) => /\.test\./.test(f))) {
  const r = run('npx', ['vitest', 'related', '--run', '--reporter=dot', ...code]);
  const txt = `${r.stdout || ''}\n${r.stderr || ''}`;
  const summary = txt.match(/Tests\s+.*$/m);
  if (r.status === 0) lines.push(`pruebas: OK${summary ? ' · ' + summary[0].replace(/\s+/g, ' ') : ''}`);
  else {
    const bad = txt.split('\n').filter((l) => /FAIL|AssertionError|Error:/.test(l)).slice(0, 10);
    (bad.length ? bad : ['vitest falló (ver `npx vitest related --run`)']).forEach((l) => fail(`pruebas: ${l.trim().slice(0, 160)}`));
  }
} else lines.push('pruebas: nada relacionado con el diff');

console.log(lines.join('\n'));
console.log(failed ? '\nRESULTADO: FALLA' : '\nRESULTADO: OK (falta `npx next build` antes del commit si tocaste rutas, layout o configuración)');
process.exit(failed ? 1 : 0);

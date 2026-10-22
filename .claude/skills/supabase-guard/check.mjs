#!/usr/bin/env node
// Auditoría de seguridad de Supabase SIN tocar la base: lee migraciones y código.
// Una línea por hallazgo. No ejecuta SQL ni usa llaves.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MIG = 'supabase/migrations';
const findings = [];
const add = (sev, where, msg) => findings.push(`${sev}  ${where}  ${msg}`);

// Tablas de catálogo cuya lectura pública es intencional
const PUBLIC_READ_OK = new Set([
  'measure_units', 'exchange_groups', 'exchange_subgroups', 'foods', 'food_aliases', 'food_portions', 'food_nutrients',
]);

const files = fs.existsSync(MIG) ? fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort() : [];
const all = files.map((f) => ({ f, sql: fs.readFileSync(path.join(MIG, f), 'utf8') }));
const joined = all.map((x) => x.sql).join('\n');

// Orden lógico: lo que una migración posterior elimina deja de contar
const dropped = new Set([...joined.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+"([^"]+)"\s+ON\s+(\w+)/gi)].map((m) => `${m[2]}::${m[1]}`));

for (const { f, sql } of all) {
  // 1) Tablas nuevas sin RLS
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)) {
    const t = m[1];
    if (!new RegExp(`ALTER\\s+TABLE\\s+${t}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(joined))
      add('ALTO', `${f}`, `tabla "${t}" sin ENABLE ROW LEVEL SECURITY`);
  }

  // 2) Políticas de lectura abierta sobre tablas que no son catálogo
  for (const m of sql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(\w+)\s+FOR\s+(\w+)\s+USING\s*\(([\s\S]*?)\)\s*;/gi)) {
    const [, name, table, cmd, using] = m;
    if (dropped.has(`${table}::${name}`)) continue;
    const open = /^\s*true\s*$/i.test(using) || /share_token\s+IS\s+NOT\s+NULL/i.test(using);
    if (open && !PUBLIC_READ_OK.has(table))
      add('CRÍTICO', `${f}`, `política "${name}" (${cmd}) deja leer "${table}" sin ligar a un token ni a auth.uid()`);
  }

  // 3) Funciones SECURITY DEFINER: search_path fijo y permisos explícitos
  for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(([\s\S]*?)\)[\s\S]*?\$\$\s*;/gi)) {
    const block = m[0];
    const fn = m[1];
    if (!/SECURITY\s+DEFINER/i.test(block)) continue;
    if (!/SET\s+search_path/i.test(block)) add('ALTO', `${f}`, `función ${fn}: SECURITY DEFINER sin SET search_path`);
    if (!new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+${fn}`, 'i').test(sql))
      add('MEDIO', `${f}`, `función ${fn}: falta REVOKE ALL ... FROM PUBLIC (y GRANT solo a los roles necesarios)`);
  }
}

// 4) Llaves y variables peligrosas en el código
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p);
    } else if (/\.(ts|tsx|mjs|js|json|md)$/.test(e.name) && !/package-lock/.test(e.name)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/service_role|SERVICE_ROLE/.test(line)) hits.push(`${p.split(path.sep).join('/')}:${i + 1}`);
        if (/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE)/.test(line)) hits.push(`${p.split(path.sep).join('/')}:${i + 1}  (variable pública con nombre de secreto)`);
        if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(line)) hits.push(`${p.split(path.sep).join('/')}:${i + 1}  (parece un JWT pegado)`);
      });
    }
  }
})('src');
hits.forEach((h) => add('CRÍTICO', h, 'llave/secreto en el código'));

// 5) Migraciones nuevas o modificadas: recordatorio de aplicación manual
let pending = [];
try {
  const run = (a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  pending = [...run(['diff', '--name-only', 'HEAD', '--', MIG]), ...run(['ls-files', '--others', '--exclude-standard', '--', MIG])];
} catch {
  /* sin git */
}

if (findings.length) console.log(findings.join('\n'));
else console.log(`supabase-guard: OK (${files.length} migraciones, sin hallazgos)`);
if (pending.length) {
  console.log(`\nMIGRACIONES SIN SUBIR/APLICAR: ${[...new Set(pending)].join(', ')}`);
  console.log('→ Recuérdale a la usuaria aplicarlas en Supabase → SQL Editor. Tú no ejecutes SQL.');
}
process.exit(findings.some((x) => x.startsWith('CRÍTICO')) ? 2 : 0);

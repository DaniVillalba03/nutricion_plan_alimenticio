#!/usr/bin/env node
// Revisa que el código respete el sistema de diseño. Solo reporta (no corrige).
// Una línea por hallazgo: archivo:línea  regla. Sin dependencias.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
// Archivos que, por diseño, pueden salirse de las reglas
const ALLOW = {
  hex: ['src/app/globals.css', 'src/lib/mock-data.ts', 'src/app/(auth)/login/page.tsx', 'src/components/layout/Brand.tsx'],
  slate: ['src/lib/mock-data.ts'],
  // ThemeToggle alterna iconos con `dark:` a propósito (evita parpadeo en el primer render)
  dark: ['src/lib/mock-data.ts', 'src/components/theme/ThemeToggle.tsx'],
};

const RULES = [
  {
    id: 'hex',
    re: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/,
    skip: (f) => ALLOW.hex.includes(f),
    msg: 'color hexadecimal fijo: usa un token (bg-surface, text-muted, border-border…)',
  },
  {
    id: 'slate',
    re: /\b(?:bg|text|border|ring|from|to|via|divide|stroke|fill)-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/,
    skip: (f) => ALLOW.slate.includes(f),
    msg: 'paleta heredada (slate/zinc/gray): usa tokens',
  },
  {
    id: 'text-primary',
    // `text-primary/10` (decorativo con opacidad) sí se permite
    re: /\btext-primary(?![-\w/])/,
    skip: () => false,
    msg: '`text-primary` es el verde de relleno (sin contraste como texto): usa `text-primary-text`',
  },
  {
    id: 'dark-variant',
    re: /\bdark:[\w[-]/,
    skip: (f) => ALLOW.dark.includes(f),
    msg: 'variante `dark:` suelta: los tokens ya cambian con el tema (salvo sombras: `dark:shadow-none`)',
    except: /dark:shadow-none/,
  },
  {
    id: 'radius',
    re: /\brounded-(?:2xl|3xl)\b/,
    skip: (f) => f.endsWith('layout.tsx') || f.endsWith('mock-data.ts'),
    msg: 'radio fuera del sistema (tarjetas 14 px, controles 10 px, píldoras `rounded-full`)',
  },
  {
    id: 'tiny-text',
    re: /\btext-\[(?:9|10|11)px\]/,
    skip: () => false,
    msg: 'texto de 9–11 px: usa `mono-label` o ≥ 12 px',
    except: /mono-label/,
  },
  {
    id: 'serif',
    re: /\bfont-serif\b|Newsreader|Figtree|Geist/,
    skip: () => false,
    msg: 'tipografía fuera del sistema (Space Grotesk + JetBrains Mono)',
  },
  {
    id: 'emoji',
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    skip: (f) => f.endsWith('mock-data.ts'),
    msg: 'emoji en la interfaz: usa un icono de lucide-react o nada',
  },
];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p);
    } else if (/\.(tsx|css)$/.test(e.name)) files.push(p.split(path.sep).join('/'));
  }
})(ROOT);

const findings = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comentarios
    for (const r of RULES) {
      if (r.skip(f)) continue;
      if (r.re.test(line) && !(r.except && r.except.test(line))) findings.push(`${f}:${i + 1}  [${r.id}] ${r.msg}`);
    }
  });
}

if (!findings.length) {
  console.log(`design-check: OK (${files.length} archivos revisados)`);
} else {
  const max = Number(process.env.MAX) || 40;
  console.log(findings.slice(0, max).join('\n'));
  if (findings.length > max) console.log(`… y ${findings.length - max} hallazgos más (MAX=${findings.length} para verlos todos)`);
  console.log(`\ndesign-check: ${findings.length} hallazgos en ${files.length} archivos`);
}

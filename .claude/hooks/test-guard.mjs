// Pruebas del guardrail: node .claude/hooks/test-guard.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard.mjs');
const run = (command) => {
  const r = spawnSync('node', [guard], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  if (!r.stdout.trim()) return 'allow';
  return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
};

const cases = [
  // Debe PERMITIR (flujo normal de trabajo)
  ['git status', 'allow'],
  ['git push origin main', 'allow'],
  ['git reset -q origin/main', 'allow'],
  ['git stash push -m x', 'allow'],
  ['git commit -m "no uses git push --force ni git reset --hard"', 'allow'],
  ['rm -rf .next', 'allow'],
  ['rm -rf node_modules', 'allow'],
  ['grep -n NEXT_PUBLIC .env.local.example', 'allow'],
  ['npx next build', 'allow'],
  // Debe DENEGAR
  ['git push --force origin main', 'deny'],
  ['git push origin main -f', 'deny'],
  ['git reset --hard HEAD~1', 'deny'],
  ['git clean -fd', 'deny'],
  ['git checkout -- .', 'deny'],
  ['git branch -D main', 'deny'],
  ['supabase db push', 'deny'],
  ['psql "$DATABASE_URL"', 'deny'],
  ['vercel --prod', 'deny'],
  ['npm audit fix --force', 'deny'],
  ['rm -rf src', 'deny'],
  ['rm -rf /', 'deny'],
  ['Remove-Item -Recurse -Force src', 'deny'],
  // Debe PEDIR confirmación
  ['cat .env.local', 'ask'],
  ['grep KEY .env.local', 'ask'],
  ['Get-Content .env.local', 'ask'],
  ['printenv', 'ask'],
];

let bad = 0;
for (const [c, expected] of cases) {
  const got = run(c);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'MAL'}  ${expected.padEnd(5)} ${ok ? '' : `(dio ${got}) `}${c}`);
}
console.log(bad ? `\n${bad} casos fallan` : `\nTodos los casos pasan (${cases.length})`);
process.exit(bad ? 1 : 0);

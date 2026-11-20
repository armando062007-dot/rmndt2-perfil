import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Read only the staging index: unselected workspace files are never published.
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = /(^|\/)(\.openai|\.env(?:\..*)?|\.dev\.vars.*|node_modules|\.wrangler|credentials|auth_info|sessions|outputs)(\/|$)|\.(?:pem|key|p12|pfx|sqlite(?:3)?|db|log|zip|tar\.gz)$/i;
const secrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/,
  /https?:\/\/[^\s/:]+:[^\s/@]+@/,
  /[A-Z]:[\\/]Users[\\/][^\s"'<>]+/i,
];
const failures = [];
for (const path of paths) {
  if (forbidden.test(path)) { failures.push(`${path}: archivo privado o de ejecución`); continue; }
  if (!/\.(?:m?js|json|sql|md|html|css|svg)$|(^|\/)\.gitignore$/.test(path)) continue;
  const content = readFileSync(path, 'utf8');
  if (secrets.some(pattern => pattern.test(content))) failures.push(`${path}: patrón de dato sensible; revisar sin mostrar el valor`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Revisión preventiva: ${paths.length} archivos seleccionados, sin patrones de credenciales ni archivos privados conocidos. No sustituye una auditoría completa.`);

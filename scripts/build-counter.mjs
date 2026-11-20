import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Preserve all existing media; add the small API without rebuilding the profile.
mkdirSync('dist/client', { recursive: true });
mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
for (const file of readdirSync('dist', { withFileTypes: true })) {
  if (file.isFile()) copyFileSync(path.join('dist', file.name), path.join('dist/client', file.name));
}
copyFileSync('worker/index.mjs', 'dist/server/index.js');
if (existsSync('.openai/hosting.json')) copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json');
writeFileSync('dist/server/wrangler.json', JSON.stringify({
  name: 'rmndt2-profile', main: 'index.js', compatibility_date: '2026-11-20',
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: ['/api/*'] },
  d1_databases: [{ binding: 'DB', database_name: 'profile-visitors', database_id: '00000000-0000-4000-8000-000000000000' }],
}, null, 2) + '\n');
console.log('Profile assets and visit counter built.');

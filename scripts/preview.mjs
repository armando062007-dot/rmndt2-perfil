import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import worker from '../worker/index.mjs';

// Development only: isolated, disposable database; never uses hosted visitor data.
const db = new DatabaseSync(':memory:');
for (const file of ['0000_profile_visitors.sql', '0001_profile_votes.sql']) db.exec(readFileSync('drizzle/' + file, 'utf8'));
function prepare(sql) {
  let values = [];
  return {
    bind(...args) { values = args; return this; },
    first() { return db.prepare(sql).get(...values); },
    run() {
      return sql.startsWith('SELECT') ? { results: db.prepare(sql).all(...values) } : { meta: { changes: Number(db.prepare(sql).run(...values).changes) } };
    },
  };
}
const mime = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', png: 'image/png', mp3: 'audio/mpeg', mp4: 'video/mp4', svg: 'image/svg+xml' };
const env = {
  DB: { prepare, async batch(statements) {
    db.exec('BEGIN');
    try { const results = statements.map(s => s.run()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } },
  ASSETS: { fetch(request) {
    const file = new URL(request.url).pathname.slice(1) || 'index.html';
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(file)) return new Response(null, { status: 404 });
    try {
      readFileSync('dist/' + file);
      return new Response(Readable.toWeb(createReadStream('dist/' + file)), { headers: { 'Content-Type': mime[file.split('.').at(-1)] || 'application/octet-stream' } });
    } catch { return new Response(null, { status: 404 }); }
  } },
};
http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
    headers.set('CF-Connecting-IP', '127.0.0.1');
    const request = new Request('http://127.0.0.1:8847' + req.url, { method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }) });
    const result = await worker.fetch(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) Readable.fromWeb(result.body).pipe(res); else res.end();
  } catch { res.writeHead(500); res.end('Preview error'); }
}).listen(8847, '127.0.0.1', () => console.log('http://127.0.0.1:8847/'));

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync('drizzle/0000_profile_visitors.sql', 'utf8'));
function prepare(sql) {
  let args = [];
  return {
    bind(...values) { args = values; return this; },
    first() { return sqlite.prepare(sql).get(...args); },
    run() { return sql.startsWith('SELECT') ? { results: sqlite.prepare(sql).all(...args) } : sqlite.prepare(sql).run(...args); },
  };
}
const env = {
  DB: {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = statements.map(s => s.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  },
  ASSETS: { fetch: () => new Response('existing asset') },
};
const request = (method = 'GET', headers = {}) => new Request('https://rmndt2.freeddns.org/api/visits', {
  method, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...headers },
});
assert.equal((await worker.fetch(request(), env)).status, 200);
assert.equal((await (await worker.fetch(request(), env)).json()).total, 0);
const first = await worker.fetch(request('POST'), env);
assert.equal((await first.json()).total, 1);
const cookie = first.headers.get('Set-Cookie').split(';')[0];
assert.match(first.headers.get('Set-Cookie'), /Secure; HttpOnly; SameSite=Lax/);
for (let i = 0; i < 4; i++) assert.equal((await (await worker.fetch(request('POST', { Cookie: cookie }), env)).json()).total, 1);
assert.equal((await (await worker.fetch(request('POST'), env)).json()).total, 2);
assert.equal((await (await worker.fetch(request('POST', { 'User-Agent': 'SearchBot' }), env)).json()).total, 2);
const visitor = crypto.randomUUID();
assert.equal((await (await worker.fetch(request('POST', { 'X-Visitor-Id': visitor }), env)).json()).total, 3);
for (let i = 0; i < 3; i++) assert.equal((await (await worker.fetch(request('POST', { 'X-Visitor-Id': visitor }), env)).json()).total, 3);
assert.equal((await (await worker.fetch(request('POST', { 'X-Visitor-Id': visitor.toUpperCase() }), env)).json()).total, 3);
const restored = await (await worker.fetch(request('POST', { Cookie: cookie, 'X-Visitor-Id': crypto.randomUUID() }), env)).json();
assert.equal(restored.total, 3);
assert.equal(restored.visitorId, cookie.split('=')[1]);
assert.equal((await worker.fetch(request('POST', { 'Content-Length': '4096' }), env)).status, 413);
assert.equal((await worker.fetch(request('POST', { Origin: 'https://other.example' }), env)).status, 403);
assert.equal((await worker.fetch(request('DELETE'), env)).status, 405);
assert.equal((await worker.fetch(request('POST', { 'Content-Type': 'text/plain' }), env)).status, 415);
assert.equal((await worker.fetch(request(), {})).status, 503);
assert.equal(await (await worker.fetch(new Request('https://rmndt2.freeddns.org/musica-perfil.mp3'), env)).text(), 'existing asset');
sqlite.close();
console.log('Counter: shared total, duplicate reloads, cookies, bot filter, origin, errors, media passthrough: OK');

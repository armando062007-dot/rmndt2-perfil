import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync('drizzle/0001_profile_votes.sql', 'utf8'));
function prepare(sql) {
  let args = [];
  return {
    bind(...values) { args = values; return this; },
    first() { return sqlite.prepare(sql).get(...args); },
    run() {
      const statement = sqlite.prepare(sql);
      return sql.startsWith('SELECT') ? { results: statement.all(...args) } : { meta: { changes: Number(statement.run(...args).changes) } };
    },
  };
}
const env = { DB: { prepare, async batch(statements) {
  sqlite.exec('BEGIN');
  try { const results = statements.map(s => s.run()); sqlite.exec('COMMIT'); return results; }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
} } };
function request(ip, vote, extra = {}) {
  return new Request('https://rmndt2.freeddns.org/api/votes', {
    method: vote === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...extra },
    ...(vote === undefined ? {} : { body: JSON.stringify({ vote }) }),
  });
}
const first = await (await worker.fetch(request('198.51.100.1'), env)).json();
assert.deepEqual(first, { positive: 0, negative: 0, mine: null, canVote: true });
let result = await worker.fetch(request('198.51.100.1', 'up'), env);
assert.equal(result.status, 200);
assert.equal((await result.json()).added, true);
for (const choice of ['up', 'down']) {
  result = await worker.fetch(request('198.51.100.1', choice, { 'X-Visitor-Id': crypto.randomUUID() }), env);
  assert.equal(result.status, 409);
  const data = await result.json();
  assert.equal(data.positive, 1); assert.equal(data.negative, 0); assert.equal(data.mine, 'up');
}
assert.equal((await worker.fetch(request('::ffff:198.51.100.1', 'down'), env)).status, 409);
assert.equal((await worker.fetch(request('198.51.100.2', 'down'), env)).status, 200);
const concurrent = await Promise.all(Array.from({ length: 20 }, () => worker.fetch(request('198.51.100.3', 'up'), env)));
assert.equal(concurrent.filter(response => response.status === 200).length, 1);
assert.equal(concurrent.filter(response => response.status === 409).length, 19);
assert.equal((await worker.fetch(request('2001:db8:0:0:0:0:0:1', 'up'), env)).status, 200);
assert.equal((await worker.fetch(request('2001:db8::1', 'down'), env)).status, 409);
assert.equal((await worker.fetch(request(null, 'up', { 'X-Forwarded-For': '198.51.100.4' }), env)).status, 503);
assert.equal((await worker.fetch(request('invalid', 'up'), env)).status, 503);
assert.equal((await worker.fetch(request('198.51.100.4', 'up', { Origin: 'https://other.example' }), env)).status, 403);
assert.equal((await worker.fetch(request('198.51.100.4', 'invalid'), env)).status, 400);
assert.equal((await worker.fetch(request('198.51.100.4', 'x'.repeat(2000)), env)).status, 400);
const rows = sqlite.prepare('SELECT * FROM profile_votes').all();
assert.equal(rows.length, 4);
assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.ip_hash)));
assert.equal((await (await worker.fetch(request('198.51.100.1'), env)).json()).mine, 'up');
sqlite.close();
console.log('Votes: one per IP across both choices, concurrent duplicates, IPv4/IPv6 normalization, forged visitor IDs, errors and hashed-only storage: OK');

const responseHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const cookieName = '__Host-rmndt2-visitor';
const validVisitor = token => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '');

function clientAddress(request) {
  // Cloudflare supplies this header; never trust X-Forwarded-For or a browser ID.
  const ip = (request.headers.get('CF-Connecting-IP') || '').trim();
  if (ip.includes(':')) {
    try {
      const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
      const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
      if (mapped) {
        const a = parseInt(mapped[1], 16), b = parseInt(mapped[2], 16);
        return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
      }
      return canonical;
    } catch { return null; }
  }
  const parts = ip.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ? parts.map(Number).join('.') : null;
}

async function voteKey(db, ip) {
  // Persist a random server-only HMAC key, not an IP or a secret in source control.
  await db.prepare('INSERT OR IGNORE INTO vote_security (singleton, secret) VALUES (1, ?)')
    .bind(crypto.randomUUID() + crypto.randomUUID()).run();
  const row = await db.prepare('SELECT secret FROM vote_security WHERE singleton = 1').first();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(row.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('rmndt2-vote:' + ip));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}

async function readVoteBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body');
  let text = '', size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error('Invalid body'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

async function handleVotes(request, env) {
  try {
    if (!env.DB) throw new Error('Unavailable');
    const ip = clientAddress(request);
    const key = ip ? await voteKey(env.DB, ip) : null;
    let added = null;
    if (request.method === 'POST') {
      if (!key) return Response.json({ error: 'No se pudo comprobar tu conexión. Inténtalo más tarde.' }, { status: 503, headers: responseHeaders });
      let data;
      try { data = await readVoteBody(request); }
      catch { return Response.json({ error: 'Voto inválido' }, { status: 400, headers: responseHeaders }); }
      if (!data || Object.keys(data).length !== 1 || !['up', 'down'].includes(data.vote)) {
        return Response.json({ error: 'Voto inválido' }, { status: 400, headers: responseHeaders });
      }
      const result = await env.DB.prepare('INSERT OR IGNORE INTO profile_votes (ip_hash, choice) VALUES (?, ?)').bind(key, data.vote).run();
      added = result.meta.changes === 1;
    }
    const results = await env.DB.batch([
      env.DB.prepare("SELECT COALESCE(SUM(choice = 'up'), 0) AS positive, COALESCE(SUM(choice = 'down'), 0) AS negative FROM profile_votes"),
      env.DB.prepare('SELECT choice FROM profile_votes WHERE ip_hash = ?').bind(key || ''),
    ]);
    const totals = results[0].results[0];
    return Response.json({ positive: Number(totals.positive), negative: Number(totals.negative), mine: results[1].results[0]?.choice || null, canVote: Boolean(key), ...(added === null ? {} : { added }) }, {
      status: added === false ? 409 : 200, headers: responseHeaders,
    });
  } catch {
    return Response.json({ error: 'Votaciones temporalmente no disponibles' }, { status: 503, headers: responseHeaders });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/visits', '/api/votes'].includes(url.pathname)) return env.ASSETS.fetch(request);
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: 'GET, POST' } });
    }
    if (request.method === 'POST') {
      if (Number(request.headers.get('Content-Length') || 0) > 1024) {
        return new Response(null, { status: 413, headers: responseHeaders });
      }
      const origin = request.headers.get('Origin');
      const allowed = new Set([url.origin, 'https://rmndt2.freeddns.org', 'https://nuruxion-perfil.armandoggz09a.chatgpt.site']);
      if ((origin && !allowed.has(origin)) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return new Response('{"error":"Solicitud no permitida"}', { status: 403, headers: responseHeaders });
      }
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
        return new Response(null, { status: 415, headers: responseHeaders });
      }
    }
    if (url.pathname === '/api/votes') return handleVotes(request, env);
    try {
      if (!env.DB) throw new Error('Missing DB');
      const headers = new Headers(responseHeaders);
      if (request.method === 'POST' && !/bot|crawler|spider|headless/i.test(request.headers.get('User-Agent') || '')) {
        const cookie = request.headers.get('Cookie') || '';
        const saved = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
        const client = request.headers.get('X-Visitor-Id');
        // Prefer the server cookie: changing browser storage alone must not add a visit.
        const token = (validVisitor(saved) ? saved : validVisitor(client) ? client : crypto.randomUUID()).toLowerCase();
        headers.set('Set-Cookie', `${cookieName}=${token}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        const results = await env.DB.batch([
          env.DB.prepare('INSERT OR IGNORE INTO profile_visitors (visitor_hash) VALUES (?)').bind(key),
          env.DB.prepare('SELECT COUNT(*) AS total FROM profile_visitors'),
        ]);
        // This anonymous ID grants no access and is returned only to its own caller.
        return Response.json({ total: Number(results[1].results[0].total), visitorId: token }, { headers });
      }
      const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM profile_visitors').first();
      return Response.json({ total: Number(row.total) }, { headers });
    } catch {
      return Response.json({ error: 'Contador temporalmente no disponible' }, { status: 503, headers: responseHeaders });
    }
  },
};

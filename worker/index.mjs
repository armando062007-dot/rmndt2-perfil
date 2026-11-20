const responseHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const cookieName = '__Host-rmndt2-visitor';
const validVisitor = token => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/visits') return env.ASSETS.fetch(request);
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

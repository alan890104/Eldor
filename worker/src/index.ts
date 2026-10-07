// Cloud save Worker: anonymous accounts (one key is one account) + saves in D1, and it serves dist/ as the static site.
//
// API (all under /api; requests that need authentication carry `Authorization: Bearer <key>`):
//   POST   /api/account   create an anonymous account → { id, key } (the key is returned only this once)
//   GET    /api/me        verify the key → { id, createdAt }
//   GET    /api/save      read the save → { rev, updatedAt, data }; 204 when there is no save
//   PUT    /api/save      write the save, body { rev: the rev last received, updatedAt, data }; a mismatched rev returns 409 with the cloud version attached
//   DELETE /api/save      delete the save (the account is kept)
//   GET    /api/health    → { ok: true }

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

interface SaveRow {
  rev: number;
  updated_at: number;
  data: string;
}

/** Key alphabet: leaves out easily confused characters 0/O, 1/I/L and U */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const KEY_BODY_LEN = 25;
const ID_LEN = 8;
/** Size limit for the save JSON (a real save is about 2-10 KB) */
const MAX_SAVE_BYTES = 64 * 1024;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
}

function empty(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...CORS } });
}

/** Random string: uses rejection sampling to avoid the bias from 256 % 30 */
function randomString(len: number): string {
  let out = '';
  const buf = new Uint8Array(len * 2);
  while (out.length < len) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= 240) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === len) break;
    }
  }
  return out;
}

/** Key display format: ELDOR-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX */
function formatKey(body: string): string {
  return `ELDOR-${body.match(/.{1,5}/g)!.join('-')}`;
}

/** A key typed by the user: ignores case, whitespace and hyphens and returns the 25-character body; null if the format is wrong */
function parseKey(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('ELDOR') ? s.slice(5) : s;
  if (body.length !== KEY_BODY_LEN) return null;
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;
  return body;
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function authenticate(req: Request, env: Env): Promise<{ id: string } | null> {
  const h = req.headers.get('Authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const body = parseKey(m[1]);
  if (!body) return null;
  const hash = await sha256(body);
  const row = await env.DB.prepare('SELECT id FROM accounts WHERE token_hash = ?1').bind(hash).first<{ id: string }>();
  return row ? { id: row.id } : null;
}

function rowToSave(r: SaveRow): { rev: number; updatedAt: number; data: unknown } {
  return { rev: r.rev, updatedAt: r.updated_at, data: JSON.parse(r.data) };
}

async function readSave(env: Env, accountId: string): Promise<SaveRow | null> {
  return env.DB.prepare('SELECT rev, updated_at, data FROM saves WHERE account_id = ?1').bind(accountId).first<SaveRow>();
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  if (req.method === 'OPTIONS') return empty(204);
  if (path === '/api/health') return json({ ok: true });

  if (path === '/api/account') {
    if (req.method !== 'POST') return empty(405);
    const now = Date.now();
    // The id and the key are both random; a collision with an existing one is very unlikely, and if it happens, retry
    for (let attempt = 0; attempt < 3; attempt++) {
      const body = randomString(KEY_BODY_LEN);
      const id = randomString(ID_LEN);
      const hash = await sha256(body);
      try {
        await env.DB.prepare('INSERT INTO accounts (id, token_hash, created_at, last_seen) VALUES (?1, ?2, ?3, ?3)').bind(id, hash, now).run();
        return json({ id, key: formatKey(body) }, 201);
      } catch {
        /* UNIQUE conflict: retry */
      }
    }
    return json({ error: 'could not create account' }, 500);
  }

  const who = await authenticate(req, env);
  if (!who) return json({ error: 'unauthorized' }, 401);

  if (path === '/api/me') {
    if (req.method !== 'GET') return empty(405);
    const row = await env.DB.prepare('SELECT created_at FROM accounts WHERE id = ?1').bind(who.id).first<{ created_at: number }>();
    return json({ id: who.id, createdAt: row?.created_at ?? 0 });
  }

  if (path === '/api/save') {
    if (req.method === 'GET') {
      const row = await readSave(env, who.id);
      return row ? json(rowToSave(row)) : empty(204);
    }
    if (req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM saves WHERE account_id = ?1').bind(who.id).run();
      return empty(204);
    }
    if (req.method === 'PUT') {
      let body: { rev?: unknown; updatedAt?: unknown; data?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: 'bad json' }, 400);
      }
      const baseRev = typeof body.rev === 'number' && Number.isInteger(body.rev) && body.rev >= 0 ? body.rev : 0;
      const updatedAt = typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt) ? body.updatedAt : Date.now();
      const data = body.data;
      if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1) return json({ error: 'bad save' }, 400);
      const text = JSON.stringify(data);
      if (text.length > MAX_SAVE_BYTES) return json({ error: 'save too large' }, 413);

      const now = Date.now();
      const cur = await readSave(env, who.id);
      if (!cur) {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO saves (account_id, rev, updated_at, data) VALUES (?1, 1, ?2, ?3)').bind(who.id, updatedAt, text),
          env.DB.prepare('UPDATE accounts SET last_seen = ?2 WHERE id = ?1').bind(who.id, now),
        ]);
        return json({ rev: 1 });
      }
      if (cur.rev !== baseRev) return json({ error: 'conflict', ...rowToSave(cur) }, 409);
      const res = await env.DB.prepare('UPDATE saves SET rev = rev + 1, updated_at = ?2, data = ?3 WHERE account_id = ?1 AND rev = ?4').bind(who.id, updatedAt, text, baseRev).run();
      if (!res.meta.changes) {
        // Two devices wrote at the same time: read again and report the conflict
        const fresh = await readSave(env, who.id);
        return json({ error: 'conflict', ...(fresh ? rowToSave(fresh) : { rev: 0, updatedAt: 0, data: null }) }, 409);
      }
      await env.DB.prepare('UPDATE accounts SET last_seen = ?2 WHERE id = ?1').bind(who.id, now).run();
      return json({ rev: baseRev + 1 });
    }
    return empty(405);
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url.pathname);
      } catch (e) {
        console.error('api error', e);
        return json({ error: 'internal error' }, 500);
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

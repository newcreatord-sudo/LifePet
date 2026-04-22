type CacheEntry = { uid: string | null; expMs: number; aud?: string; iss?: string };

const cache = new Map<string, CacheEntry>();

function prune() {
  const t = Date.now();
  for (const [k, v] of cache) {
    if (v.expMs <= t) cache.delete(k);
  }
}

export async function requireFirebaseUser(req: Request) {
  prune();
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return null;

  const cached = cache.get(token);
  if (cached && cached.expMs > Date.now()) {
    if (!cached.uid) return null;
    return { uid: cached.uid };
  }

  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", token);
  const ctrl = new AbortController();
  const tt = setTimeout(() => ctrl.abort(), 4000);
  const res = await fetch(url.toString(), { signal: ctrl.signal }).finally(() => clearTimeout(tt));
  if (!res.ok) {
    cache.set(token, { uid: null, expMs: Date.now() + 30_000 });
    return null;
  }
  const json = (await res.json()) as { sub?: string; aud?: string; exp?: string; iss?: string };
  const uid = typeof json.sub === "string" ? json.sub : "";
  if (!uid) {
    cache.set(token, { uid: null, expMs: Date.now() + 30_000 });
    return null;
  }

  const expectedAud = String(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "lifepet-3c2195d42c1e");
  const aud = typeof json.aud === "string" ? json.aud : "";
  if (expectedAud && aud && aud !== expectedAud) {
    cache.set(token, { uid: null, expMs: Date.now() + 30_000, aud });
    return null;
  }

  const iss = typeof json.iss === "string" ? json.iss : "";
  if (iss && iss !== "https://securetoken.google.com/" + expectedAud) {
    cache.set(token, { uid: null, expMs: Date.now() + 30_000, aud, iss });
    return null;
  }

  const exp = Number(json.exp || 0);
  if (Number.isFinite(exp) && exp > 0 && exp * 1000 < Date.now()) {
    cache.set(token, { uid: null, expMs: Date.now() + 30_000, aud, iss });
    return null;
  }

  const expMs = Number.isFinite(exp) && exp > 0 ? exp * 1000 : Date.now() + 60_000;
  cache.set(token, { uid, expMs, aud, iss });
  return { uid };
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

function prune() {
  const t = now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= t) buckets.delete(k);
  }
}

export function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || "unknown";
}

export function rateLimit(
  req: Request,
  opts: {
    key: string;
    limit: number;
    windowMs: number;
    headers?: Record<string, string>;
  }
): Response | null {
  prune();
  const t = now();
  const bucketKey = `${opts.key}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= t) {
    buckets.set(bucketKey, { count: 1, resetAt: t + opts.windowMs });
    return null;
  }
  existing.count += 1;
  if (existing.count <= opts.limit) return null;

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - t) / 1000));
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "retry-after": String(retryAfterSec),
      ...opts.headers,
    },
  });
}


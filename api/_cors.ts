function requestOriginFromHost(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!host) return "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export function corsHeaders(req: Request, opts?: { methods?: string }) {
  const origin = req.headers.get("origin");
  const rawAllow = String(process.env.APP_ORIGINS || "").trim();
  const allowList = rawAllow
    ? rawAllow
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const isLocal = Boolean(origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));
  const sameOrigin = requestOriginFromHost(req);
  const isAllowed = Boolean(origin && (isLocal || origin === sameOrigin || allowList.includes(origin)));
  const allowOrigin = isAllowed ? String(origin) : "null";
  const methods = String(opts?.methods || "POST, OPTIONS");
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function corsOptionsResponse(req: Request, opts?: { methods?: string }) {
  return new Response(null, { status: 204, headers: corsHeaders(req, opts) });
}

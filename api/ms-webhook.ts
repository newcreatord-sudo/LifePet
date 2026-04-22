import { corsHeaders, corsOptionsResponse } from "./_cors";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req, { methods: "POST, OPTIONS" });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(req, { methods: "POST, OPTIONS" }) });

  const limited = rateLimit(req, {
    key: `ms:webhook:ip:${getClientIp(req)}`,
    limit: 600,
    windowMs: 60_000,
    headers: corsHeaders(req, { methods: "POST, OPTIONS" }),
  });
  if (limited) return limited;

  const expected = process.env.MS_WEBHOOK_SECRET;
  if (!expected) {
    return new Response("Server not configured", { status: 500, headers: corsHeaders(req, { methods: "POST, OPTIONS" }) });
  }
  const provided = req.headers.get("x-ms-secret") || "";
  if (provided !== expected) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders(req, { methods: "POST, OPTIONS" }) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers: corsHeaders(req, { methods: "POST, OPTIONS" }) });
  }

  const b = body as Record<string, unknown>;
  const uid = typeof b.uid === "string" ? b.uid : "";
  const adapterType = typeof b.adapterType === "string" ? b.adapterType : "";
  const subjectId = typeof b.subjectId === "string" ? b.subjectId : "";
  const deviceId = typeof b.deviceId === "string" ? b.deviceId : "";
  const payload = (b.payload ?? null) as unknown;

  if (!uid || !adapterType || !subjectId || !deviceId || !payload || typeof payload !== "object") {
    return new Response("Bad Request", { status: 400, headers: corsHeaders(req, { methods: "POST, OPTIONS" }) });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const region = process.env.FIREBASE_FUNCTIONS_REGION || "us-central1";
  if (!projectId) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_FIREBASE_PROJECT_ID", hint: "Call Firebase Functions msIngestWebhook directly." }),
      { status: 500, headers: { ...corsHeaders(req, { methods: "POST, OPTIONS" }), "content-type": "application/json; charset=utf-8" } }
    );
  }

  const upstream = `https://${region}-${projectId}.cloudfunctions.net/msIngestWebhook`;
  const resp = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ms-secret": provided,
    },
    body: JSON.stringify({ uid, deviceId, subjectId, adapterType, payload, receivedAt: Date.now() }),
  });
  const text = await resp.text();
  return new Response(text, {
    status: resp.status,
    headers: { ...corsHeaders(req, { methods: "POST, OPTIONS" }), "content-type": resp.headers.get("content-type") || "application/json; charset=utf-8" },
  });
}

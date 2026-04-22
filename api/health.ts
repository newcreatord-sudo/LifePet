import { corsHeaders, corsOptionsResponse } from "./_cors";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req);
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(req) });

  const firebaseProjectId = String(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "lifepet-3c2195d42c1e").trim();
  const firebaseRegion = String(process.env.FIREBASE_FUNCTIONS_REGION || "us-central1").trim();
  const hasAi = Boolean(String(process.env.AI_GATEWAY_API_KEY || "").trim() || String(process.env.OPENAI_API_KEY || "").trim() || String(process.env.VERCEL_OIDC_TOKEN || "").trim());
  const hasWebhookSecret = Boolean(String(process.env.MS_WEBHOOK_SECRET || "").trim());

  return Response.json(
    {
      ok: true,
      firebase: {
        configured: Boolean(firebaseProjectId),
        projectId: firebaseProjectId || null,
        region: firebaseRegion,
      },
      ai: {
        configured: hasAi,
        model: String(process.env.OPENAI_MODEL || "").trim() || null,
      },
      multispecies: {
        webhookConfigured: hasWebhookSecret,
      },
      timestamp: Date.now(),
    },
    { headers: corsHeaders(req) }
  );
}

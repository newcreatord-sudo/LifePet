import { getChatModel, getOpenAI } from "./_openai";
import { corsHeaders, corsOptionsResponse } from "./_cors";
import { requireFirebaseUser } from "./_auth";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const ipLimited = rateLimit(req, {
    key: `ai:chat:ip:${getClientIp(req)}`,
    limit: 120,
    windowMs: 60_000,
    headers: corsHeaders(req),
  });
  if (ipLimited) return ipLimited;

  let user: { uid: string } | null = null;
  try {
    user = await requireFirebaseUser(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AUTH_MISCONFIGURED") {
      return Response.json(
        { error: "Auth non configurata: imposta FIREBASE_PROJECT_ID su Vercel." },
        { status: 503, headers: corsHeaders(req) }
      );
    }
    throw e;
  }
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(req) });

  const uidLimited = rateLimit(req, {
    key: `ai:chat:uid:${user.uid}`,
    limit: 30,
    windowMs: 60_000,
    headers: corsHeaders(req),
  });
  if (uidLimited) return uidLimited;

  const body = (await req.json().catch(() => null)) as null | {
    messages?: ChatMsg[];
  };
  const messages = Array.isArray(body?.messages) ? body!.messages.filter((m) => m && typeof m.content === "string") : [];
  if (!messages.length) return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });

  const totalChars = messages.reduce((sum, m) => sum + String(m.content || "").length, 0);
  if (totalChars > 12_000) return new Response("Payload too large", { status: 413, headers: corsHeaders(req) });

  try {
    const client = getOpenAI();
    const model = getChatModel();
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.35,
    });

    const answer = res.choices?.[0]?.message?.content || "";
    return Response.json({ answer }, { headers: corsHeaders(req) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    if (/^AI_DISABLED$/.test(msg)) {
      return Response.json(
        { error: "AI non configurata in produzione. Imposta AI_GATEWAY_API_KEY (consigliata) o OPENAI_API_KEY." },
        { status: 503, headers: corsHeaders(req) }
      );
    }
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders(req) });
  }
}

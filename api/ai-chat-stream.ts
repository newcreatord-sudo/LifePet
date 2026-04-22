import { corsHeaders, corsOptionsResponse } from "./_cors";
import { getChatModel, getOpenAI } from "./_openai";
import { requireFirebaseUser } from "./_auth";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const ipLimited = rateLimit(req, {
    key: `ai:stream:ip:${getClientIp(req)}`,
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
    key: `ai:stream:uid:${user.uid}`,
    limit: 30,
    windowMs: 60_000,
    headers: corsHeaders(req),
  });
  if (uidLimited) return uidLimited;
  const body = (await req.json().catch(() => null)) as null | {
    messages?: ChatMsg[];
  };
  const messages = Array.isArray(body?.messages)
    ? body!.messages.filter(
        (m) => m && (m.role === "system" || m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
    : [];
  if (!messages.length) return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > 12_000) return new Response("Payload too large", { status: 413, headers: corsHeaders(req) });

  let client: ReturnType<typeof getOpenAI>;
  try {
    client = getOpenAI();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/^AI_DISABLED$/.test(String(msg || ""))) {
      return Response.json(
        { error: "AI non configurata in produzione. Imposta AI_GATEWAY_API_KEY (consigliata) o OPENAI_API_KEY." },
        { status: 503, headers: corsHeaders(req) }
      );
    }
    return Response.json({ error: "AI error" }, { status: 500, headers: corsHeaders(req) });
  }

  const model = getChatModel();
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const r = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.35,
        stream: true,
      });

      for await (const chunk of r) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          await writer.write(encoder.encode(delta));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      const safe = /^AI_DISABLED$/.test(String(msg || ""))
        ? "AI non configurata in produzione. Imposta AI_GATEWAY_API_KEY (consigliata) o OPENAI_API_KEY."
        : String(msg || "AI error");
      await writer.write(encoder.encode(`\n\n[AI_ERROR] ${safe}`));
    } finally {
      try {
        await writer.close();
      } catch {
        await Promise.resolve();
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders(req),
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

import { getOpenAI, getVisionModel } from "./_openai";
import { corsHeaders, corsOptionsResponse } from "./_cors";
import { requireFirebaseUser } from "./_auth";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const ipLimited = rateLimit(req, {
    key: `ai:vision:ip:${getClientIp(req)}`,
    limit: 60,
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
    key: `ai:vision:uid:${user.uid}`,
    limit: 15,
    windowMs: 60_000,
    headers: corsHeaders(req),
  });
  if (uidLimited) return uidLimited;

  const body = (await req.json().catch(() => null)) as null | {
    imageDataUrl?: string;
    prompt?: string;
  };
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl.startsWith("data:image/")) return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });
  const prompt = typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : "Analizza.";

  try {
    const client = getOpenAI();
    const model = getVisionModel();
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente veterinario. Metti la sicurezza dell'animale al primo posto. Se noti segnali di emergenza (respiro difficile, collasso, sanguinamento, convulsioni, intossicazione, trauma), consiglia pronto intervento veterinario. Non fare diagnosi certa: fornisci ipotesi e controlli pratici.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.25,
    });

    const answer = res.choices?.[0]?.message?.content || "";
    return Response.json({ answer }, { headers: corsHeaders(req) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI error";
    if (/^AI_DISABLED$/.test(msg)) {
      return Response.json(
        { error: "AI non configurata in produzione. Imposta AI_GATEWAY_API_KEY (consigliata) o OPENAI_API_KEY." },
        { status: 503, headers: corsHeaders(req) }
      );
    }
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders(req) });
  }
}

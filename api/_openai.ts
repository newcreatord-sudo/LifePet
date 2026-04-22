import OpenAI from "openai";

export function getOpenAI() {
  const gatewayKey = String(process.env.AI_GATEWAY_API_KEY || "");
  const oidcToken = String(process.env.VERCEL_OIDC_TOKEN || "");
  const gatewayAuth = gatewayKey || oidcToken;
  if (gatewayAuth) {
    return new OpenAI({
      apiKey: gatewayAuth,
      baseURL: "https://ai-gateway.vercel.sh/v1",
    });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "");
  if (!apiKey) throw new Error("AI_DISABLED");
  return new OpenAI({ apiKey });
}

export function getChatModel() {
  const usesGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  const fallback = usesGateway ? "openai/gpt-4o-mini" : "gpt-4o-mini";
  return String(process.env.OPENAI_MODEL || fallback);
}

export function getVisionModel() {
  const usesGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  const fallback = usesGateway ? "openai/gpt-4o-mini" : "gpt-4o-mini";
  return String(process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || fallback);
}

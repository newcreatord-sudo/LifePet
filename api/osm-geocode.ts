import { corsHeaders, corsOptionsResponse } from "./_cors";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req, { methods: "GET, OPTIONS" });
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const limited = rateLimit(req, {
    key: `osm:geocode:ip:${getClientIp(req)}`,
    limit: 120,
    windowMs: 60_000,
    headers: corsHeaders(req, { methods: "GET, OPTIONS" }),
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "").trim();
  if (!q) return new Response("Bad Request", { status: 400, headers: corsHeaders(req, { methods: "GET, OPTIONS" }) });

  const nominatim = new URL("https://nominatim.openstreetmap.org/search");
  nominatim.searchParams.set("q", q);
  nominatim.searchParams.set("format", "json");
  nominatim.searchParams.set("limit", "5");
  nominatim.searchParams.set("addressdetails", "1");

  const r = await fetch(nominatim.toString(), {
    headers: {
      "accept": "application/json",
      "user-agent": "PetLyon/1.0 (https://petlion.app)",
    },
  });
  const text = await r.text();
  if (!r.ok) return new Response(text || "Geocode error", { status: 502, headers: corsHeaders(req, { methods: "GET, OPTIONS" }) });

  return new Response(text, {
    headers: {
      ...corsHeaders(req, { methods: "GET, OPTIONS" }),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

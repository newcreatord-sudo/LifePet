import { corsHeaders, corsOptionsResponse } from "./_cors";
import { getClientIp, rateLimit } from "./_ratelimit";

export const config = { runtime: "edge" };

type Category = "veterinary" | "grooming" | "boarding" | "pet_store";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function overpassQuery(category: Category, lat: number, lon: number, radiusM: number) {
  const around = `around:${radiusM},${lat},${lon}`;
  const parts: string[] = [];

  if (category === "veterinary") {
    parts.push(`node["amenity"="veterinary"](${around});`);
    parts.push(`way["amenity"="veterinary"](${around});`);
    parts.push(`relation["amenity"="veterinary"](${around});`);
  }

  if (category === "grooming") {
    parts.push(`node["shop"="pet_grooming"](${around});`);
    parts.push(`way["shop"="pet_grooming"](${around});`);
    parts.push(`relation["shop"="pet_grooming"](${around});`);
    parts.push(`node["craft"="pet_groomer"](${around});`);
    parts.push(`way["craft"="pet_groomer"](${around});`);
    parts.push(`relation["craft"="pet_groomer"](${around});`);
  }

  if (category === "boarding") {
    parts.push(`node["amenity"="animal_boarding"](${around});`);
    parts.push(`way["amenity"="animal_boarding"](${around});`);
    parts.push(`relation["amenity"="animal_boarding"](${around});`);
  }

  if (category === "pet_store") {
    parts.push(`node["shop"="pet"](${around});`);
    parts.push(`way["shop"="pet"](${around});`);
    parts.push(`relation["shop"="pet"](${around});`);
  }

  return `[out:json][timeout:25];(\n${parts.join("\n")}\n);out center tags;`;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return corsOptionsResponse(req);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const limited = rateLimit(req, {
    key: `osm:nearby:ip:${getClientIp(req)}`,
    limit: 60,
    windowMs: 60_000,
    headers: corsHeaders(req),
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as null | {
    lat?: number;
    lon?: number;
    radiusKm?: number;
    category?: Category;
  };

  const lat = typeof body?.lat === "number" ? body.lat : NaN;
  const lon = typeof body?.lon === "number" ? body.lon : NaN;
  const radiusKm = typeof body?.radiusKm === "number" ? body.radiusKm : 3;
  const category = body?.category;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });
  if (category !== "veterinary" && category !== "grooming" && category !== "boarding" && category !== "pet_store") {
    return new Response("Bad Request", { status: 400, headers: corsHeaders(req) });
  }

  const radiusM = Math.round(clamp(radiusKm, 0.5, 25) * 1000);
  const query = overpassQuery(category, lat, lon, radiusM);

  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": "PetLyon/1.0 (https://petlion.app)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  const text = await r.text();
  if (!r.ok) return new Response(text || "Overpass error", { status: 502, headers: corsHeaders(req) });

  return new Response(text, {
    headers: {
      ...corsHeaders(req),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

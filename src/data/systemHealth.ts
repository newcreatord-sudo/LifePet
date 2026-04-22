import { getApiBase } from "@/lib/apiBase";

export type SystemHealth = {
  ok: boolean;
  firebase: { configured: boolean; projectId: string | null; region: string };
  ai: { configured: boolean; model: string | null };
  multispecies: { webhookConfigured: boolean };
  timestamp: number;
};

export async function fetchSystemHealth() {
  const base = getApiBase();
  const res = await fetch(`${base}/api/health`, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Health check failed");
  return (text ? (JSON.parse(text) as SystemHealth) : null) as SystemHealth;
}


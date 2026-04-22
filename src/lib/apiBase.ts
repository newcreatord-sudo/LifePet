export function getApiBase() {
  const v = String(import.meta.env.VITE_API_BASE || import.meta.env.VITE_AI_API_BASE || "").trim();
  return v ? v.replace(/\/$/, "") : "";
}


import type { UserProfile } from "@/data/users";
import { logTelemetry, type TelemetryEventName } from "@/data/telemetry";

function nowMs() {
  return Date.now();
}

function keyFor(event: string) {
  return `lifepet:telemetry:last:${event}`;
}

function canSend(event: string, minIntervalMs: number) {
  try {
    const k = keyFor(event);
    const raw = localStorage.getItem(k);
    const last = raw ? Number(raw) : 0;
    const n = nowMs();
    if (Number.isFinite(last) && n - last < minIntervalMs) return false;
    localStorage.setItem(k, String(n));
    return true;
  } catch {
    return true;
  }
}

export async function trackEvent({
  uid,
  profile,
  event,
  route,
  props,
  minIntervalMs = 0,
}: {
  uid: string | null | undefined;
  profile: UserProfile | null;
  event: TelemetryEventName;
  route?: string;
  props?: Record<string, string | number | boolean>;
  minIntervalMs?: number;
}) {
  const enabled = profile?.preferences?.telemetryEnabled === true;
  if (!enabled) return;
  const safeUid = String(uid || "").trim();
  if (!safeUid) return;
  if (minIntervalMs > 0 && !canSend(event, minIntervalMs)) return;

  try {
    await logTelemetry(safeUid, { event, at: nowMs(), route, props });
  } catch {
    return;
  }
}


import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export type TelemetryEventName =
  | "page_view"
  | "dashboard_checklist_cta"
  | "documents_bulk_action"
  | "pet_protection_enabled"
  | "onboarding_started"
  | "onboarding_goal_selected"
  | "onboarding_step_cta"
  | "onboarding_skipped"
  | "onboarding_completed";

export type TelemetryPayload = {
  event: TelemetryEventName;
  at: number;
  route?: string;
  props?: Record<string, string | number | boolean>;
};

function clampString(v: string, maxLen: number) {
  const s = String(v || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen).trim() : s;
}

function sanitizeProps(props: Record<string, string | number | boolean> | undefined) {
  if (!props) return undefined;
  const entries = Object.entries(props);
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [kRaw, v] of entries) {
    if (count >= 12) break;
    const k = clampString(kRaw, 24);
    if (!k) continue;
    if (typeof v === "string") {
      const sv = clampString(v, 80);
      if (!sv) continue;
      out[k] = sv;
      count++;
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) continue;
      out[k] = v;
      count++;
      continue;
    }
    if (typeof v === "boolean") {
      out[k] = v;
      count++;
      continue;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export async function logTelemetry(uid: string, payload: TelemetryPayload) {
  if (!uid) return;
  if (shouldUseDemoData()) return;
  const { db } = getFirebase();

  const safeRoute = payload.route ? clampString(payload.route, 220) : "";
  const safe = {
    event: payload.event,
    at: payload.at,
    ...(safeRoute ? { route: safeRoute } : {}),
    ...(payload.props ? { props: sanitizeProps(payload.props) } : {}),
  };

  await addDoc(collection(db, "users", uid, "telemetry"), safe);
}

export async function deleteRecentTelemetry(uid: string, maxItems = 200) {
  if (!uid) return;
  if (shouldUseDemoData()) return;
  const { db } = getFirebase();

  const colRef = collection(db, "users", uid, "telemetry");
  const snap = await getDocs(query(colRef, orderBy("at", "desc"), limit(maxItems)));
  const deletes: Promise<void>[] = [];
  for (const d of snap.docs) {
    deletes.push(deleteDoc(doc(db, "users", uid, "telemetry", d.id)));
  }
  await Promise.all(deletes);
}

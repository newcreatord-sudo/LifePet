import { isDemoModeEnabled } from "@/lib/runtimeMode";
import { useToastStore } from "@/stores/toastStore";

function toMessage(err: unknown) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as { message?: unknown; code?: unknown };
  const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  return [code, msg].filter(Boolean).join(" ").trim();
}

function isLikelyNetworkOrPermission(err: unknown) {
  const anyErr = err as { code?: unknown; message?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const msg = typeof anyErr?.message === "string" ? anyErr.message : toMessage(err);
  return (
    code === "permission-denied" ||
    code === "unauthenticated" ||
    code === "unavailable" ||
    /Missing\s+or\s+insufficient\s+permissions/i.test(msg) ||
    /permission\s*denied/i.test(msg) ||
    /unauthenticated/i.test(msg) ||
    /net::ERR_ABORTED/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    /client is offline/i.test(msg)
  );
}

function isPermissionDenied(err: unknown) {
  const anyErr = err as { code?: unknown; message?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const msg = typeof anyErr?.message === "string" ? anyErr.message : toMessage(err);
  return code === "permission-denied" || /Missing\s+or\s+insufficient\s+permissions/i.test(msg) || /permission\s*denied/i.test(msg);
}

type FailureState = { count: number; firstAt: number };

function readState(): FailureState {
  try {
    const raw = sessionStorage.getItem("lifepet:fsFail");
    if (!raw) return { count: 0, firstAt: 0 };
    const parsed = JSON.parse(raw) as FailureState;
    if (!parsed || !Number.isFinite(parsed.count) || !Number.isFinite(parsed.firstAt)) return { count: 0, firstAt: 0 };
    return parsed;
  } catch {
    return { count: 0, firstAt: 0 };
  }
}

function writeState(next: FailureState) {
  try {
    sessionStorage.setItem("lifepet:fsFail", JSON.stringify(next));
  } catch {
    return;
  }
}

function markTriggered() {
  try {
    sessionStorage.setItem("lifepet:fsAutoDemo", "1");
  } catch {
    return;
  }
}

function alreadyTriggered() {
  try {
    return sessionStorage.getItem("lifepet:fsAutoDemo") === "1";
  } catch {
    return false;
  }
}

export function reportFirestoreError(err: unknown, context?: string) {
  if (typeof window === "undefined") return;
  if (isDemoModeEnabled()) return;
  if (!isLikelyNetworkOrPermission(err)) return;
  if (alreadyTriggered()) return;

  const now = Date.now();
  const prev = readState();
  const windowMs = 18_000;
  const next: FailureState =
    prev.firstAt && now - prev.firstAt < windowMs
      ? { firstAt: prev.firstAt, count: prev.count + 1 }
      : { firstAt: now, count: 1 };
  writeState(next);

  const anyErr = err as { code?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const threshold = isPermissionDenied(err) || code === "unavailable" ? 1 : 3;
  if (next.count < threshold) return;

  markTriggered();
  useToastStore.getState().push({
    type: "error",
    title: "Connessione instabile",
    message: isPermissionDenied(err)
      ? "Permessi mancanti o sessione scaduta. Ricarica la pagina e accedi di nuovo."
      : context
        ? `Connessione a Firestore instabile (${context}). Riprova tra poco.`
        : "Connessione a Firestore instabile. Riprova tra poco.",
  });
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { createNotification } from "@/data/notifications";
import { createProvider, subscribeProviders } from "@/data/providers";
import { exportAccountData, exportPetData } from "@/data/export";
import { seedEnabledRoutinesOncePerDay, subscribeRoutines } from "@/data/routines";
import { ensureUserProfile, subscribeUserProfile, updateUserPreferences, type UserProfile } from "@/data/users";
import { getFirebase, getFirebaseConfigError } from "@/lib/firebase";
import { getVapidKey, isPushSupported } from "@/lib/push";
import { isDemoModeEnabled, setDemoModeEnabled } from "@/lib/runtimeMode";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { useThemeStore } from "@/stores/themeStore";
import type { PetRoutine } from "@/types";
import { Alert } from "@/components/ui/Alert";
import type { DocumentData, DocumentReference } from "firebase/firestore";
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

async function resetCaches() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

function clearLifePetStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("lifepet:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    return;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type CheckItem = { key: string; label: string; status: "ok" | "warn" | "error"; detail: string };

type WizardStepKey = "healthcheck" | "repair_profile" | "repair_pet" | "regen_routines";
type WizardStepStatus = "pending" | "running" | "ok" | "warn" | "error";
type WizardStep = { key: WizardStepKey; title: string; status: WizardStepStatus; detail?: string };
type WizardStepReport = { key: WizardStepKey; status: Exclude<WizardStepStatus, "pending" | "running">; detail: string; checks?: CheckItem[] };
type WizardReport = {
  schemaVersion: 1;
  startedAt: number;
  finishedAt?: number;
  user: { uid: string; demo: boolean };
  initial: {
    activePetId: string | null;
    petsCount: number;
    aiEnabled: boolean;
    demoFlag: boolean;
    firebaseConfigError: string | null;
  };
  steps: WizardStepReport[];
  final?: { activePetId: string | null; routinesCount: number };
};

function badgeClass(s: CheckItem["status"]) {
  if (s === "ok") return "lp-badge lp-badge-success";
  if (s === "warn") return "lp-badge lp-badge-warn";
  return "lp-badge lp-badge-danger";
}

function wizardBadgeClass(s: WizardStepStatus) {
  if (s === "ok") return "lp-badge lp-badge-success";
  if (s === "warn") return "lp-badge lp-badge-warn";
  if (s === "error") return "lp-badge lp-badge-danger";
  if (s === "running") return "lp-badge lp-badge-info";
  return "lp-badge";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getUrlFromExportResult(res: unknown): string | null {
  if (!isRecord(res)) return null;
  const url = res.url;
  return typeof url === "string" && url.trim() ? url : null;
}

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

async function probeFetch(url: string, timeoutMs = 4500) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Fetch fallita" };
  } finally {
    window.clearTimeout(t);
  }
}

async function probeImage(url: string, timeoutMs = 4500) {
  return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const img = new Image();
    let done = false;
    const t = window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, error: "Timeout" });
    }, timeoutMs);

    img.onload = () => {
      if (done) return;
      done = true;
      window.clearTimeout(t);
      resolve({ ok: true });
    };
    img.onerror = () => {
      if (done) return;
      done = true;
      window.clearTimeout(t);
      resolve({ ok: false, error: "Errore caricamento" });
    };

    img.referrerPolicy = "no-referrer";
    img.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  });
}

export default function Diagnostics() {
  const user = useAuthStore((s) => s.user);
  const demo = useAuthStore((s) => s.demo);
  const configError = useAuthStore((s) => s.configError);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const pushToast = useToastStore((s) => s.push);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const resetTheme = useThemeStore((s) => s.reset);
  const navigate = useNavigate();

  const firebaseConfigError = getFirebaseConfigError();
  const demoFlag = isDemoModeEnabled();

  function errMsg(e: unknown) {
    return e instanceof Error ? e.message : "Operazione fallita";
  }

  const [providersCount, setProvidersCount] = useState<number>(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [routines, setRoutines] = useState<PetRoutine[]>([]);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [exportDays, setExportDays] = useState("365");
  const [exporting, setExporting] = useState<"pet" | "account" | null>(null);
  const [importJson, setImportJson] = useState<unknown>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importName, setImportName] = useState<string>("");

  const [forceLongPollingEnabled, setForceLongPollingEnabled] = useState(() => {
    try {
      return localStorage.getItem("lifepet:forceLongPolling") === "1";
    } catch {
      return false;
    }
  });

  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>([
    { key: "healthcheck", title: "Healthcheck", status: "pending" },
    { key: "repair_profile", title: "Ripara profilo", status: "pending" },
    { key: "repair_pet", title: "Ripara pet attivo", status: "pending" },
    { key: "regen_routines", title: "Rigenera routine", status: "pending" },
  ]);
  const [wizardStatus, setWizardStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [wizardReport, setWizardReport] = useState<WizardReport | null>(null);

  const [uiState, setUiState] = useState(() => {
    const el = document.documentElement;
    const body = document.body;
    return {
      htmlClass: el.className,
      bodyClass: body.className,
      palette: el.dataset.lpPalette ?? "—",
      bg: el.dataset.lpBg ?? "—",
      sheet: el.dataset.lpSheet ?? "—",
    };
  });

  useEffect(() => {
    const unsub = subscribeProviders((items) => setProvidersCount(items.length));
    return () => unsub();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const el = document.documentElement;
      const body = document.body;
      setUiState({
        htmlClass: el.className,
        bodyClass: body.className,
        palette: el.dataset.lpPalette ?? "—",
        bg: el.dataset.lpBg ?? "—",
        sheet: el.dataset.lpSheet ?? "—",
      });
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!activePetId) {
      setRoutines([]);
      return;
    }
    const unsub = subscribeRoutines(activePetId, setRoutines);
    return () => unsub();
  }, [activePetId]);

  const aiEnabled = profile?.preferences?.aiEnabled !== false;
  const canFirestore = Boolean(!demo && user && !firebaseConfigError);
  const isEmulator = (import.meta.env.VITE_FIREBASE_EMULATORS as string | undefined) === "1";

  function hasActivePet() {
    return Boolean(activePetId && pets.some((p) => p.id === activePetId));
  }

  function wizardReset() {
    setWizardStatus("idle");
    setWizardReport(null);
    setWizardSteps([
      { key: "healthcheck", title: "Controllo salute", status: "pending" },
      { key: "repair_profile", title: "Ripara profilo", status: "pending" },
      { key: "repair_pet", title: "Ripara pet attivo", status: "pending" },
      { key: "regen_routines", title: "Rigenera routine", status: "pending" },
    ]);
  }

  function setStep(key: WizardStepKey, patch: Partial<WizardStep>) {
    setWizardSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function computeHealthcheck(): Promise<CheckItem[]> {
    if (!user) return [];
    const next: CheckItem[] = [];
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const vapidKey = getVapidKey();
    next.push({ key: "mode", label: "Modalità", status: demo ? "warn" : "ok", detail: demo ? "Locale" : "Online" });
    next.push({
      key: "domain",
      label: "Dominio",
      status: host === "petlion.app" ? "ok" : host.endsWith(".vercel.app") || host === "localhost" || host === "127.0.0.1" ? "warn" : "error",
      detail: host ? host : "—",
    });

    next.push({
      key: "network",
      label: "Rete",
      status: typeof navigator !== "undefined" && navigator.onLine ? "ok" : "warn",
      detail: typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline/limitata",
    });

    try {
      const m = await probeFetch("/manifest.webmanifest");
      next.push({
        key: "pwa_manifest",
        label: "PWA manifest",
        status: m.ok ? "ok" : "warn",
        detail: m.ok ? "OK" : m.status ? `HTTP ${m.status}` : (m as { error?: string }).error ?? "Non raggiungibile",
      });
    } catch {
      next.push({ key: "pwa_manifest", label: "PWA manifest", status: "warn", detail: "Non verificabile" });
    }

    try {
      const est = await navigator.storage?.estimate?.();
      const usage = typeof est?.usage === "number" ? est.usage : null;
      const quota = typeof est?.quota === "number" ? est.quota : null;
      if (usage !== null && quota !== null && quota > 0) {
        const pct = Math.round((usage / quota) * 100);
        next.push({
          key: "storage",
          label: "Storage (browser)",
          status: pct >= 85 ? "warn" : "ok",
          detail: `${fmtBytes(usage)} / ${fmtBytes(quota)} (${pct}%)`,
        });
      }
    } catch {
      next.push({ key: "storage", label: "Storage (browser)", status: "warn", detail: "Non verificabile" });
    }

    try {
      const osm = await probeImage("https://tile.openstreetmap.org/0/0/0.png");
      next.push({
        key: "osm",
        label: "Mappa (tile)",
        status: osm.ok ? "ok" : "warn",
        detail: osm.ok ? "OK" : osm.error ?? "Bloccata",
      });
    } catch {
      next.push({ key: "osm", label: "Mappa (tile)", status: "warn", detail: "Non verificabile" });
    }
    next.push({
      key: "firebase_env",
      label: "Config Firebase",
      status: firebaseConfigError ? "error" : "ok",
      detail: firebaseConfigError ? firebaseConfigError : "OK",
    });
    next.push({
      key: "push_support",
      label: "Push (browser)",
      status: isPushSupported() ? (vapidKey ? "ok" : "warn") : "warn",
      detail: isPushSupported() ? (vapidKey ? "Supportate + VAPID" : "Supportate (manca VAPID)") : "Non supportate",
    });
    next.push({
      key: "pet_active",
      label: "Pet attivo",
      status: hasActivePet() ? "ok" : "warn",
      detail: hasActivePet() ? String(activePetId) : pets.length ? "Non selezionato o non valido" : "Nessun pet",
    });
    next.push({
      key: "profile",
      label: "Profilo utente",
      status: profile ? "ok" : "warn",
      detail: profile ? `plan=${profile.plan}` : "Non trovato",
    });
    next.push({
      key: "ai_pref",
      label: "Preferenze AI",
      status: aiEnabled ? "ok" : "warn",
      detail: aiEnabled ? "AI attiva" : "AI disattivata",
    });
    next.push({ key: "emulators", label: "Emulator", status: isEmulator ? "warn" : "ok", detail: isEmulator ? "Attivo" : "Disattivo" });

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        const hasSw = Boolean(regs.length);
        next.push({
          key: "sw",
          label: "Service worker",
          status: hasSw ? "ok" : "warn",
          detail: hasSw ? `${regs.length}` : "Nessuno",
        });
      }
    } catch {
      next.push({ key: "sw", label: "Service worker", status: "warn", detail: "Non verificabile" });
    }

    if (aiEnabled) {
      try {
        const token = await (async () => {
          try {
            const u = getFirebase().auth.currentUser;
            if (!u) return "";
            return await u.getIdToken();
          } catch {
            return "";
          }
        })();
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] }),
        });

        if (res.status === 200) {
          next.push({ key: "ai_api", label: "AI (API)", status: "ok", detail: "OK" });
        } else if (res.status === 503) {
          next.push({ key: "ai_api", label: "AI (API)", status: "warn", detail: "Non configurata (503)" });
        } else if (res.status === 401) {
          next.push({ key: "ai_api", label: "AI (API)", status: "error", detail: "Unauthorized (token/domains/env)" });
        } else {
          next.push({ key: "ai_api", label: "AI (API)", status: "warn", detail: `HTTP ${res.status}` });
        }
      } catch (e) {
        next.push({ key: "ai_api", label: "AI (API)", status: "warn", detail: errMsg(e) });
      }
    }

    if (!canFirestore || !activePetId) return next;

    try {
      const { db } = getFirebase();
      try {
        const tokenSnap = await getDocs(query(collection(db, "users", user.uid, "pushTokens"), limit(1)));
        next.push({
          key: "push_token",
          label: "Push (token)",
          status: tokenSnap.size ? "ok" : "warn",
          detail: tokenSnap.size ? "Salvato" : "Assente",
        });
      } catch {
        next.push({ key: "push_token", label: "Push (token)", status: "warn", detail: "Non verificabile" });
      }
      const petsSnap = await getDocs(query(collection(db, "pets"), where("ownerId", "==", user.uid), limit(1)));
      next.push({ key: "pets_query", label: "Query pet", status: petsSnap.size ? "ok" : "warn", detail: petsSnap.size ? "OK" : "Vuoto" });

      const checkSub = async (key: string, label: string, sub: string) => {
        const base = collection(db, "pets", activePetId, sub);
        const snap = await getDocs(query(base, limit(1)));
        next.push({ key, label, status: snap.size ? "ok" : "warn", detail: snap.size ? "OK" : "Vuoto" });
      };

      await Promise.all([
        checkSub("logs", "Log", "logs"),
        checkSub("health", "Eventi salute", "healthEvents"),
        checkSub("tasks", "Task", "tasks"),
        checkSub("routines", "Routine", "routines"),
        checkSub("agenda", "Agenda", "agendaEvents"),
        checkSub("notifications", "Notifiche", "notifications"),
        checkSub("documents", "Documenti", "documents"),
        checkSub("vaccines", "Vaccini", "vaccines"),
        checkSub("meds", "Terapie", "medications"),
      ]);
    } catch (e) {
      next.push({ key: "firestore", label: "Archivio dati", status: "error", detail: errMsg(e) });
    }

    return next;
  }

  async function runHealthcheck() {
    if (!user) {
      pushToast({ type: "info", title: "Diagnostica", message: "Accedi per eseguire controlli completi." });
      return;
    }
    setChecking(true);
    try {
      const next = await computeHealthcheck();
      setChecks(next);
    } finally {
      setChecking(false);
    }
  }

  async function loadRoutinesOnce(petId: string) {
    return await new Promise<PetRoutine[]>((resolve) => {
      let done = false;
      const unsub = subscribeRoutines(petId, (items) => {
        if (done) return;
        done = true;
        unsub();
        resolve(items);
      });
      setTimeout(() => {
        if (done) return;
        done = true;
        unsub();
        resolve([]);
      }, 2000);
    });
  }

  async function runWizard() {
    if (!user) {
      pushToast({ type: "info", title: "Wizard", message: "Accedi per usare il wizard." });
      return;
    }
    if (wizardStatus === "running") return;

    setWizardStatus("running");
    setWizardReport(null);
    setWizardSteps((prev) => prev.map((s) => ({ ...s, status: "pending", detail: undefined })));

    const report: WizardReport = {
      schemaVersion: 1,
      startedAt: Date.now(),
      user: { uid: user.uid, demo },
      initial: {
        activePetId: activePetId ?? null,
        petsCount: pets.length,
        aiEnabled,
        demoFlag,
        firebaseConfigError: firebaseConfigError ? String(firebaseConfigError) : null,
      },
      steps: [],
    };

    try {
      setStep("healthcheck", { status: "running" });
      const hc = await computeHealthcheck();
      setChecks(hc);
      const hcStatus: WizardStepReport["status"] = hc.some((c) => c.status === "error")
        ? "error"
        : hc.some((c) => c.status === "warn")
          ? "warn"
          : "ok";
      const hcDetail = `Risultati: ok=${hc.filter((c) => c.status === "ok").length}, warn=${hc.filter((c) => c.status === "warn").length}, error=${hc.filter((c) => c.status === "error").length}`;
      report.steps.push({ key: "healthcheck", status: hcStatus, detail: hcDetail, checks: hc });
      setStep("healthcheck", { status: hcStatus, detail: hcDetail });

      setStep("repair_profile", { status: "running" });
      try {
        await ensureUserProfile(user.uid);
        const detail = "Profilo verificato/creato.";
        report.steps.push({ key: "repair_profile", status: "ok", detail });
        setStep("repair_profile", { status: "ok", detail });
      } catch (e) {
        const detail = errMsg(e);
        report.steps.push({ key: "repair_profile", status: "error", detail });
        setStep("repair_profile", { status: "error", detail });
      }

      setStep("repair_pet", { status: "running" });
      let nextPetId = activePetId ?? null;
      let finalRoutinesCount = 0;
      if (nextPetId && pets.some((p) => p.id === nextPetId)) {
        const detail = "Pet attivo già valido.";
        report.steps.push({ key: "repair_pet", status: "ok", detail });
        setStep("repair_pet", { status: "ok", detail });
      } else if (pets.length) {
        nextPetId = pets[0].id;
        setActivePetId(nextPetId);
        const detail = `Impostato pet attivo: ${nextPetId}`;
        report.steps.push({ key: "repair_pet", status: "warn", detail });
        setStep("repair_pet", { status: "warn", detail });
      } else {
        const detail = "Nessun pet disponibile.";
        report.steps.push({ key: "repair_pet", status: "warn", detail });
        setStep("repair_pet", { status: "warn", detail });
      }

      setStep("regen_routines", { status: "running" });
      if (!nextPetId) {
        const detail = "Pet non disponibile: impossibile rigenerare.";
        report.steps.push({ key: "regen_routines", status: "warn", detail });
        setStep("regen_routines", { status: "warn", detail });
      } else {
        const list = nextPetId === activePetId ? routines : await loadRoutinesOnce(nextPetId);
        finalRoutinesCount = list.length;
        const enabledCount = list.filter((r) => r.enabled).length;
        if (!list.length) {
          const detail = "Nessuna routine trovata.";
          report.steps.push({ key: "regen_routines", status: "warn", detail });
          setStep("regen_routines", { status: "warn", detail });
        } else {
          try {
            await seedEnabledRoutinesOncePerDay(nextPetId, list);
            const detail = `Routine totali=${list.length}, abilitate=${enabledCount}. Task generati (se mancanti).`;
            report.steps.push({ key: "regen_routines", status: "ok", detail });
            setStep("regen_routines", { status: "ok", detail });
          } catch (e) {
            const detail = errMsg(e);
            report.steps.push({ key: "regen_routines", status: "error", detail });
            setStep("regen_routines", { status: "error", detail });
          }
        }
      }

      report.final = { activePetId: nextPetId, routinesCount: finalRoutinesCount };
      report.finishedAt = Date.now();
      setWizardReport(report);
      setWizardStatus(report.steps.some((s) => s.status === "error") ? "error" : "done");
      pushToast({ type: "success", title: "Wizard", message: "Esecuzione completata." });
    } catch (e) {
      report.finishedAt = Date.now();
      setWizardReport(report);
      setWizardStatus("error");
      pushToast({ type: "error", title: "Wizard", message: errMsg(e) });
    }
  }

  function summarizeImport(payload: unknown) {
    const p = isRecord(payload) ? payload : null;
    const schemaVersion = typeof p?.schemaVersion === "number" ? p.schemaVersion : null;
    const exportedAt = typeof p?.exportedAt === "number" ? p.exportedAt : null;
    const collections = p && isRecord(p.collections) ? (p.collections as Record<string, unknown>) : null;
    const counts = collections
      ? Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]))
      : null;
    return {
      schemaVersion,
      exportedAt,
      petId:
        p && isRecord(p.pet) && typeof p.pet.id === "string"
          ? p.pet.id
          : p && typeof p.petId === "string"
            ? p.petId
            : null,
      counts,
    };
  }

  async function importIntoActivePet() {
    if (!user || !activePetId) return;
    if (!isEmulator) {
      pushToast({ type: "error", title: "Import", message: "Import abilitato solo su emulator per sicurezza." });
      return;
    }
    const summary = summarizeImport(importJson);
    if (summary.schemaVersion !== 1 || !summary.counts) {
      pushToast({ type: "error", title: "Import", message: "File non valido o schema non supportato." });
      return;
    }

    const p = isRecord(importJson) ? importJson : null;
    const collections = p && isRecord(p.collections) ? (p.collections as Record<string, unknown>) : null;
    const pick = (k: string) => {
      const v = collections ? collections[k] : null;
      return Array.isArray(v) ? v : [];
    };

    const sets: Array<{ sub: string; docs: unknown[]; coerceCreatedBy?: boolean }> = [
      { sub: "logs", docs: pick("logs"), coerceCreatedBy: true },
      { sub: "healthEvents", docs: pick("healthEvents"), coerceCreatedBy: true },
      { sub: "tasks", docs: pick("tasks"), coerceCreatedBy: true },
      { sub: "routines", docs: pick("routines"), coerceCreatedBy: true },
      { sub: "agendaEvents", docs: pick("agendaEvents"), coerceCreatedBy: true },
      { sub: "notifications", docs: pick("notifications"), coerceCreatedBy: true },
      { sub: "vaccines", docs: pick("vaccines"), coerceCreatedBy: true },
      { sub: "medications", docs: pick("medications"), coerceCreatedBy: true },
      { sub: "expenses", docs: pick("expenses"), coerceCreatedBy: true },
      { sub: "bookings", docs: pick("bookings"), coerceCreatedBy: true },
    ];

    const { db } = getFirebase();
    setImportBusy(true);
    try {
      const chunks: Array<Array<{ ref: DocumentReference<DocumentData>; data: Record<string, unknown> }>> = [];
      let current: Array<{ ref: DocumentReference<DocumentData>; data: Record<string, unknown> }> = [];

      for (const set of sets) {
        for (const raw of set.docs) {
          if (!isRecord(raw)) continue;
          const id = typeof raw.id === "string" ? raw.id : null;
          if (!id) continue;
          const data: Record<string, unknown> = { ...raw };
          delete data["id"];
          data.petId = activePetId;
          if (set.coerceCreatedBy) data.createdBy = user.uid;
          const ref = doc(db, "pets", activePetId, set.sub, id);
          current.push({ ref, data });
          if (current.length >= 400) {
            chunks.push(current);
            current = [];
          }
        }
      }
      if (current.length) chunks.push(current);

      for (const ops of chunks) {
        const b = writeBatch(db);
        for (const op of ops) b.set(op.ref, op.data, { merge: true });
        await b.commit();
      }

      pushToast({ type: "success", title: "Import", message: "Dati importati nel pet attivo (emulator)." });
    } catch (e) {
      pushToast({ type: "error", title: "Import", message: errMsg(e) });
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostica"
        description="Centro controllo: healthcheck dati, preferenze AI, export/import e riparazione guidata."
        imagePrompt="A clean modern dashboard illustration, veterinary app diagnostics screen, accent color, minimal UI, soft gradient background, crisp shapes, high quality"
      />

      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Rete e compatibilità</CardTitle>
              <CardDescription>Se i dati restano vuoti o Firestore si disconnette, abilita questa modalità e ricarica.</CardDescription>
            </div>
            <div className="lp-mini-ill" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Compatibilità rete (Long Polling)</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{forceLongPollingEnabled ? "Attiva" : "Disattiva"}</div>
                <button
                  type="button"
                  className={forceLongPollingEnabled ? "lp-btn-secondary" : "lp-btn-primary"}
                  onClick={() => {
                    try {
                      localStorage.setItem("lifepet:forceLongPolling", forceLongPollingEnabled ? "0" : "1");
                    } catch {
                      return;
                    }
                    setForceLongPollingEnabled((v) => !v);
                  }}
                >
                  {forceLongPollingEnabled ? "Disattiva" : "Attiva"}
                </button>
              </div>
              <div className="mt-2 text-xs lp-muted">
                Utile con reti aziendali, VPN o estensioni che bloccano le connessioni realtime.
              </div>
            </div>

            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Applica impostazione</div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" className="lp-btn-primary" onClick={() => window.location.reload()}>
                  Ricarica app
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={async () => {
                    await resetCaches();
                    clearLifePetStorage();
                    window.location.reload();
                  }}
                >
                  Reset + ricarica
                </button>
              </div>
              <div className="mt-2 text-xs lp-muted">Reset elimina cache PWA e preferenze locali (non tocca i dati cloud).</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Stato UI</CardTitle>
              <CardDescription>Palette, background e classi correnti.</CardDescription>
            </div>
            <div className="lp-mini-ill" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">html.className</div>
              <div className="text-sm font-medium break-words">{uiState.htmlClass || "—"}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">body.className</div>
              <div className="text-sm font-medium break-words">{uiState.bodyClass || "—"}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">palette</div>
              <div className="text-sm font-medium">{uiState.palette}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">bg/sheet</div>
              <div className="text-sm font-medium">{uiState.bg} · {uiState.sheet}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Wizard guidato</CardTitle>
              <CardDescription>Sequenza consigliata: healthcheck → ripara profilo → pet attivo → rigenera routine.</CardDescription>
            </div>
            <div className="lp-mini-ill" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="space-y-2">
                {wizardSteps.map((s) => (
                  <div key={s.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{s.title}</div>
                      {s.detail ? (
                        <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                          {s.detail}
                        </div>
                      ) : null}
                    </div>
                    <span className={wizardBadgeClass(s.status)}>{s.status}</span>
                  </div>
                ))}
              </div>

              {wizardReport ? (
                <div className="mt-3 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  Report: {wizardReport.finishedAt ? new Date(wizardReport.finishedAt).toLocaleString() : "—"} · pet finale: {wizardReport.final?.activePetId ?? "—"}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="lp-btn-primary" disabled={wizardStatus === "running"} onClick={() => void runWizard()}>
                {wizardStatus === "running" ? "Eseguo…" : "Avvia wizard"}
              </button>
              <button type="button" className="lp-btn-secondary" disabled={wizardStatus === "running"} onClick={() => wizardReset()}>
                Reset
              </button>
              <button
                type="button"
                className="lp-btn-secondary"
                disabled={!wizardReport}
                onClick={() => {
                  if (!wizardReport) return;
                  const ts = wizardReport.finishedAt ?? Date.now();
                  downloadText(`lifepet-diagnostics-report-${wizardReport.user.uid}-${ts}.json`, JSON.stringify(wizardReport, null, 2));
                }}
              >
                Esporta report
              </button>
              <button
                type="button"
                className="lp-btn-secondary"
                disabled={!wizardReport}
                onClick={() => {
                  if (!wizardReport) return;
                  const steps = wizardReport.steps.map((s) => `${s.key}=${s.status} (${s.detail})`).join(" | ");
                  openWithDraft(`Interpreta questo report e dimmi cosa fare dopo in ordine. Report: ${steps}. Contesto: pet=${wizardReport.final?.activePetId ?? "-"}.`);
                }}
              >
                Analizza report (AI)
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Healthcheck</CardTitle>
            <CardDescription>Stato app, configurazione e presenza dati.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Utente</div>
                <div className="font-medium">{user ? (user.isDemo ? `Demo (${user.uid})` : user.uid) : "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Modalità</div>
                <div className="font-medium">{demo ? "Demo" : "Firebase"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Demo flag</div>
                <div className="font-medium">{demoFlag ? "ON" : "OFF"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Pet attivo</div>
                <div className="font-medium">{activePetId ?? "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Numero pet</div>
                <div className="font-medium">{pets.length}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Professionisti</div>
                <div className="font-medium">{providersCount}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">AI</div>
                <div className="font-medium">{aiEnabled ? "Attiva" : "Disattivata"}</div>
              </div>

              {configError ? (
                <div className="mt-3">
                  <Alert variant="warn" title="Firebase non configurato">{configError}</Alert>
                </div>
              ) : null}

              {firebaseConfigError ? (
                <div className="mt-3">
                  <Alert variant="warn" title="Env Firebase mancante">{firebaseConfigError}</Alert>
                </div>
              ) : null}

              <div className="pt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="lp-btn-primary" onClick={() => void runHealthcheck()} disabled={checking}>
                  {checking ? "Controllo…" : "Esegui healthcheck"}
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  disabled={!user}
                  onClick={() => {
                    const s = checks.length ? checks : [];
                    openWithDraft(
                      `Analizza questi risultati diagnostica e suggerisci riparazioni in ordine: ${s
                        .map((c) => `${c.label}=${c.status} (${c.detail})`)
                        .join(" | ")}. Contesto: demo=${demo}, petAttivo=${activePetId ?? "-"}, pets=${pets.length}.`
                    );
                  }}
                >
                  Suggerisci riparazione (AI)
                </button>
              </div>

              {checks.length ? (
                <div className="mt-3 space-y-2">
                  {checks.map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                          {c.detail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.key === "pet_active" ? (
                          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/pets")}>Apri</button>
                        ) : null}
                        {c.key === "ai_api" || c.key === "ai_pref" ? (
                          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/ai")}>Apri</button>
                        ) : null}
                        {c.key === "push_support" || c.key === "push_token" ? (
                          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/settings")}>Apri</button>
                        ) : null}
                        <span className={badgeClass(c.status)}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Smoke test</CardTitle>
            <CardDescription>Check rapido pre-lancio: flussi e pagine chiave.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
              <div className="lp-panel p-3">1) Home → Login → Demo</div>
              <div className="lp-panel p-3">2) Onboarding: Skip/Finish</div>
              <div className="lp-panel p-3">3) Dashboard: crea pet → refresh → persistenza</div>
              <div className="lp-panel p-3">4) Documenti: upload/preview (se Firebase) o demo</div>
              <div className="lp-panel p-3">5) AI: Chat e salvataggi (se AI attiva)</div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/")}>Home</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/login")}>Login</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/onboarding")}>Onboarding</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/dashboard")}>Dashboard</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/pets")}>Pet</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/documents")}>Documenti</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/ai")}>AI</button>
                <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/settings")}>Settings</button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferenze AI</CardTitle>
            <CardDescription>Attiva/disattiva AI e ripara il profilo se manca.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm" style={{ color: "rgb(var(--lp-muted))" }}>
                  AI in app
                </div>
                <button
                  type="button"
                  className={aiEnabled ? "lp-btn-primary" : "lp-btn-secondary"}
                  disabled={!user}
                  onClick={async () => {
                    if (!user) return;
                    try {
                      await updateUserPreferences(user.uid, { aiEnabled: !aiEnabled });
                      pushToast({ type: "success", title: "Preferenze", message: !aiEnabled ? "AI attivata." : "AI disattivata." });
                    } catch (e) {
                      pushToast({ type: "error", title: "Preferenze", message: errMsg(e) });
                    }
                  }}
                >
                  {aiEnabled ? "Attiva" : "Disattivata"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="lp-btn-secondary"
                  disabled={!user}
                  onClick={async () => {
                    if (!user) return;
                    try {
                      await ensureUserProfile(user.uid);
                      pushToast({ type: "success", title: "Profilo", message: "Profilo verificato/creato." });
                    } catch (e) {
                      pushToast({ type: "error", title: "Profilo", message: errMsg(e) });
                    }
                  }}
                >
                  Ripara profilo utente
                </button>

                <button
                  type="button"
                  className="lp-btn-secondary"
                  disabled={!user}
                  onClick={() => {
                    openWithDraft(
                      `Crea una checklist per configurare bene l'app: preferenze AI, notifiche, quiet hours, privacy. Contesto: aiEnabled=${aiEnabled}, demo=${demo}, emulators=${isEmulator}.`
                    );
                  }}
                >
                  Checklist setup (AI)
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UI & Tema</CardTitle>
            <CardDescription>Stato reale del tema applicato (utile se vedi colori strani).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">html class</div>
                <div className="font-medium text-right break-all">{uiState.htmlClass || "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">body class</div>
                <div className="font-medium text-right break-all">{uiState.bodyClass || "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Palette</div>
                <div className="font-medium">{uiState.palette}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Sfondo dietro</div>
                <div className="font-medium">{uiState.bg}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Sfondo (foglio)</div>
                <div className="font-medium">{uiState.sheet}</div>
              </div>

              <div className="pt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => {
                    resetTheme();
                    pushToast({ type: "success", title: "Tema", message: "Tema ripristinato." });
                  }}
                >
                  Reset tema
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => {
                    clearLifePetStorage();
                    location.reload();
                  }}
                >
                  Reset tema + reload
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Dati: export/import</CardTitle>
            <CardDescription>Backup per account/pet e ripristino su emulator.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <label className="md:col-span-4 block">
                <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  Range export (giorni)
                </div>
                <input value={exportDays} onChange={(e) => setExportDays(e.target.value)} className="lp-input" />
              </label>
              <div className="md:col-span-8 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="lp-btn-primary"
                  disabled={!activePetId || exporting !== null}
                  onClick={async () => {
                    if (!activePetId) return;
                    const days = Number(exportDays);
                    const range = Number.isFinite(days) && days > 0 ? { fromMs: Date.now() - days * 24 * 60 * 60 * 1000, toMs: Date.now() } : undefined;
                    setExporting("pet");
                    try {
                      const res = await exportPetData(activePetId, range);
                      const url = getUrlFromExportResult(res);
                      if (url) {
                        window.open(url, "_blank", "noopener,noreferrer");
                        pushToast({ type: "success", title: "Export", message: "Download avviato." });
                      } else {
                        downloadText(`lifepet-export-pet-${activePetId}.json`, JSON.stringify(res, null, 2));
                        pushToast({ type: "info", title: "Export", message: "Export locale creato (demo/limitazioni)." });
                      }
                    } catch (e) {
                      pushToast({ type: "error", title: "Export", message: errMsg(e) });
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  {exporting === "pet" ? "Esporto…" : "Esporta pet"}
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  disabled={!user || exporting !== null}
                  onClick={async () => {
                    if (!user) return;
                    const days = Number(exportDays);
                    const range = Number.isFinite(days) && days > 0 ? { fromMs: Date.now() - days * 24 * 60 * 60 * 1000, toMs: Date.now() } : undefined;
                    setExporting("account");
                    try {
                      const res = await exportAccountData(range);
                      const url = getUrlFromExportResult(res);
                      if (url) {
                        window.open(url, "_blank", "noopener,noreferrer");
                        pushToast({ type: "success", title: "Export", message: "Download avviato." });
                      } else {
                        downloadText(`lifepet-export-account-${user.uid}.json`, JSON.stringify(res, null, 2));
                        pushToast({ type: "info", title: "Export", message: "Export locale creato (demo/limitazioni)." });
                      }
                    } catch (e) {
                      pushToast({ type: "error", title: "Export", message: errMsg(e) });
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  {exporting === "account" ? "Esporto…" : "Esporta account"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
              <div className="text-sm font-semibold">Import (emulator)</div>
              <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>
                Importa un export JSON nel pet attivo. Per sicurezza è abilitato solo su emulator.
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  type="file"
                  accept="application/json"
                  className="lp-input"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImportName(file.name);
                    try {
                      const text = await file.text();
                      const json = JSON.parse(text) as unknown;
                      setImportJson(json);
                      pushToast({ type: "success", title: "Import", message: "File caricato." });
                    } catch (err) {
                      setImportJson(null);
                      pushToast({ type: "error", title: "Import", message: err instanceof Error ? err.message : "JSON non valido" });
                    }
                  }}
                />

                {importJson ? (
                  <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                    {(() => {
                      const s = summarizeImport(importJson);
                      const exported = s.exportedAt ? new Date(s.exportedAt).toLocaleString() : "—";
                      const counts = s.counts
                        ? Object.entries(s.counts)
                            .slice(0, 6)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(" · ")
                        : "—";
                      return `File: ${importName || "—"} · schema=${s.schemaVersion ?? "—"} · exported=${exported} · ${counts}`;
                    })()}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="lp-btn-primary"
                    disabled={!importJson || !activePetId || importBusy || !user}
                    onClick={() => void importIntoActivePet()}
                  >
                    {importBusy ? "Importo…" : "Importa nel pet attivo"}
                  </button>
                  <button type="button" className="lp-btn-secondary" disabled={!importJson} onClick={() => setImportJson(null)}>
                    Rimuovi file
                  </button>
                  {!isEmulator ? (
                    <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                      Import disabilitato: abilita emulators.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riparazione guidata</CardTitle>
            <CardDescription>Azioni sicure per ripristinare UI e dati incoerenti.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={async () => {
                  try {
                    await resetCaches();
                    pushToast({ type: "success", title: "Cache", message: "Service worker e cache rimossi." });
                  } catch (e) {
                    pushToast({ type: "error", title: "Cache", message: errMsg(e) });
                  }
                }}
              >
                Reset cache/PWA
              </button>

              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  clearLifePetStorage();
                  pushToast({ type: "success", title: "Reset", message: "Dati locali ripuliti. Ricarico…" });
                  setTimeout(() => window.location.reload(), 300);
                }}
              >
                Reset dati locali
              </button>

              <button
                type="button"
                className="lp-btn-secondary"
                disabled={!pets.length}
                onClick={() => {
                  if (!pets.length) return;
                  if (activePetId && pets.some((p) => p.id === activePetId)) {
                    pushToast({ type: "info", title: "Pet", message: "Pet attivo già valido." });
                    return;
                  }
                  setActivePetId(pets[0].id);
                  pushToast({ type: "success", title: "Pet", message: "Pet attivo ripristinato." });
                }}
              >
                Ripara selezione pet attivo
              </button>

              <button
                type="button"
                className="lp-btn-primary"
                disabled={!activePetId || !routines.length}
                onClick={async () => {
                  if (!activePetId) return;
                  try {
                    await seedEnabledRoutinesOncePerDay(activePetId, routines);
                    pushToast({ type: "success", title: "Routine", message: "Task routine generati (se mancanti)." });
                  } catch (e) {
                    pushToast({ type: "error", title: "Routine", message: errMsg(e) });
                  }
                }}
              >
                Rigenera task da routine
              </button>

              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  setDemoModeEnabled(true);
                  pushToast({ type: "success", title: "Demo", message: "Modalità demo attivata. Ricarico…" });
                  setTimeout(() => window.location.reload(), 300);
                }}
              >
                Attiva demo
              </button>

              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  setDemoModeEnabled(false);
                  pushToast({ type: "success", title: "Demo", message: "Modalità demo disattivata. Ricarico…" });
                  setTimeout(() => window.location.reload(), 300);
                }}
              >
                Disattiva demo
              </button>

              {canFirestore ? (
                <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="text-sm font-semibold">Strumenti dev (Firebase)</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={async () => {
                        if (!user) return;
                        try {
                          const { db } = getFirebase();
                          await updateDoc(doc(db, "users", user.uid), { updatedAt: Date.now() });
                          pushToast({ type: "success", title: "Firebase", message: "Scrittura OK (users)." });
                        } catch (e) {
                          pushToast({ type: "error", title: "Firebase", message: errMsg(e) });
                        }
                      }}
                    >
                      Test scrittura
                    </button>
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={async () => {
                        if (!user) return;
                        try {
                          const { db } = getFirebase();
                          const snap = await getDocs(query(collection(db, "pets"), where("ownerId", "==", user.uid), limit(50)));
                          pushToast({ type: "success", title: "Pet", message: `Su Firestore: ${snap.size}` });
                        } catch (e) {
                          pushToast({ type: "error", title: "Pet", message: errMsg(e) });
                        }
                      }}
                    >
                      Verifica pet
                    </button>
                    <button
                      type="button"
                      className="lp-btn-primary"
                      disabled={!user}
                      onClick={async () => {
                        if (!user) return;
                        try {
                          const now = Date.now();
                          const mk = (kind: "vet" | "nutritionist" | "groomer" | "sitter", name: string) =>
                            createProvider({ kind, name, createdBy: user.uid, createdAt: now });
                          await mk("vet", "Centro Veterinario");
                          await mk("groomer", "Toelettatura");
                          await mk("nutritionist", "Nutrizionista");
                          await mk("sitter", "Pet sitter");
                          pushToast({ type: "success", title: "Professionisti", message: "Creati." });
                        } catch (e) {
                          pushToast({ type: "error", title: "Professionisti", message: errMsg(e) });
                        }
                      }}
                    >
                      Crea professionisti base
                    </button>
                    {isEmulator && activePetId && user ? (
                      <button
                        type="button"
                        className="lp-btn-secondary"
                        onClick={async () => {
                          try {
                            await createNotification(activePetId, {
                              petId: activePetId,
                              createdBy: user.uid,
                              type: "debug_test",
                              title: "Notifica test",
                              body: "Notifica creata su emulator.",
                              severity: "info",
                              createdAt: Date.now(),
                              read: false,
                            });
                            pushToast({ type: "success", title: "Notifica", message: "Creata (emulator)." });
                          } catch (e) {
                            pushToast({ type: "error", title: "Notifica", message: errMsg(e) });
                          }
                        }}
                      >
                        Crea notifica test
                      </button>
                    ) : null}
                    {isEmulator && activePetId && user ? (
                      <button
                        type="button"
                        className="lp-btn-secondary"
                        onClick={async () => {
                          try {
                            const { db } = getFirebase();
                            const snap = await getDocs(
                              query(collection(db, "pets", activePetId, "notifications"), where("createdBy", "==", user.uid), limit(50))
                            );
                            pushToast({ type: "success", title: "Notifiche", message: `Su Firestore: ${snap.size}` });
                          } catch (e) {
                            pushToast({ type: "error", title: "Notifiche", message: errMsg(e) });
                          }
                        }}
                      >
                        Verifica notifiche
                      </button>
                    ) : null}
                    {isEmulator && activePetId && user ? (
                      <button
                        type="button"
                        className="lp-btn-secondary"
                        onClick={async () => {
                          try {
                            const { db } = getFirebase();
                            await setDoc(
                              doc(db, "pets", activePetId, "debug", "ping"),
                              { ok: true, at: Date.now(), petId: activePetId, createdBy: user.uid },
                              { merge: true }
                            );
                            pushToast({ type: "success", title: "Ping", message: "Scrittura OK (debug)." });
                          } catch (e) {
                            pushToast({ type: "error", title: "Ping", message: errMsg(e) });
                          }
                        }}
                      >
                        Ping write
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

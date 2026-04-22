import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const PetPublic = lazy(() => import("@/pages/PetPublic"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Pets = lazy(() => import("@/pages/Pets"));
const Protection = lazy(() => import("@/pages/Protection"));
const Health = lazy(() => import("@/pages/Health"));
const Ai = lazy(() => import("@/pages/Ai"));
const AiChat = lazy(() => import("@/pages/AiChat"));
const AiSymptoms = lazy(() => import("@/pages/AiSymptoms"));
const AiPhoto = lazy(() => import("@/pages/AiPhoto"));
const AiVideo = lazy(() => import("@/pages/AiVideo"));
const AiSummary = lazy(() => import("@/pages/AiSummary"));
const AiSavesPage = lazy(() => import("@/pages/AiSavesPage"));
const Nutrition = lazy(() => import("@/pages/Nutrition"));
const Wellness = lazy(() => import("@/pages/Wellness"));
const Status = lazy(() => import("@/pages/Status"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Planner = lazy(() => import("@/pages/Planner"));
const Training = lazy(() => import("@/pages/Training"));
const Bookings = lazy(() => import("@/pages/Bookings"));
const ProviderConsole = import.meta.env.DEV ? lazy(() => import("@/pages/ProviderConsole")) : null;
const SharedRecords = lazy(() => import("@/pages/SharedRecords"));
const Demo = lazy(() => import("@/pages/Demo"));
const Moderation = import.meta.env.DEV ? lazy(() => import("@/pages/Moderation")) : null;
const Records = lazy(() => import("@/pages/Records"));
const Documents = lazy(() => import("@/pages/Documents"));
const Medications = lazy(() => import("@/pages/Medications"));
const Vaccines = lazy(() => import("@/pages/Vaccines"));
const Gps = lazy(() => import("@/pages/Gps"));
const Nearby = lazy(() => import("@/pages/Nearby"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Community = lazy(() => import("@/pages/Community"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const PlatformDevices = lazy(() => import("@/pages/PlatformDevices"));
const PlatformAlerts = lazy(() => import("@/pages/PlatformAlerts"));
const PlatformDeviceMarketplace = lazy(() => import("@/pages/PlatformDeviceMarketplace"));
const PlatformIntegrations = lazy(() => import("@/pages/PlatformIntegrations"));
const PlatformThresholdSettings = lazy(() => import("@/pages/PlatformThresholdSettings"));
const PlatformNotificationSettings = lazy(() => import("@/pages/PlatformNotificationSettings"));
const PlatformHerdManagement = lazy(() => import("@/pages/PlatformHerdManagement"));
const PlatformReports = lazy(() => import("@/pages/PlatformReports"));
const PlatformImportCsv = lazy(() => import("@/pages/PlatformImportCsv"));
const PlatformSyncDiagnostics = lazy(() => import("@/pages/PlatformSyncDiagnostics"));
const PlatformSubjectProfile = lazy(() => import("@/pages/PlatformSubjectProfile"));
const PlatformGeofences = lazy(() => import("@/pages/PlatformGeofences"));
const FarmSubjects = lazy(() => import("@/pages/FarmSubjects"));
const FarmDashboard = lazy(() => import("@/pages/FarmDashboard"));
const FarmHerdDashboard = lazy(() => import("@/pages/FarmHerdDashboard"));
const FarmMap = lazy(() => import("@/pages/FarmMap"));
const PetTechDashboard = lazy(() => import("@/pages/PetTechDashboard"));
const Adoptions = lazy(() => import("@/pages/Adoptions"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Settings = lazy(() => import("@/pages/Settings"));
const Diagnostics = import.meta.env.DEV ? lazy(() => import("@/pages/Diagnostics")) : null;
const Explore = lazy(() => import("@/pages/Explore"));
const Gallery = import.meta.env.DEV ? lazy(() => import("@/pages/Gallery")) : null;
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const SystemHealth = lazy(() => import("@/pages/SystemHealth"));
import { RequireAuth } from "@/components/RequireAuth";
import { AppShellLayout } from "@/components/AppShellLayout";
import { FarmShellLayout } from "@/components/FarmShellLayout";
import { useAuthStore } from "@/stores/authStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToastStore } from "@/stores/toastStore";
import { pushQa } from "@/stores/qaStore";
import { RequireActivePet } from "@/components/RequireActivePet";
import { useThemeStore } from "@/stores/themeStore";
import { isDemoModeEnabled } from "@/lib/runtimeMode";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/telemetryClient";
import { RequirePro } from "@/components/billing/RequirePro";

function OnboardingGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const pushToast = useToastStore((s) => s.push);
  const onboarded = (() => {
    try {
      return localStorage.getItem("lifepet:onboardingCompleted") === "1";
    } catch {
      return false;
    }
  })();

  const petCreated = (() => {
    try {
      const raw = localStorage.getItem("lifepet:onboardingSteps:v2");
      if (!raw) return false;
      const j = JSON.parse(raw) as { petCreated?: unknown };
      return Boolean(j.petCreated);
    } catch {
      return false;
    }
  })();

  const onboardingAllowed = (() => {
    const p = location.pathname;
    if (p === "/onboarding") return true;
    if (p.startsWith("/share/")) return true;
    if (!p.startsWith("/app/")) return false;
    const allowed = [
      "/app/dashboard",
      "/app/pets",
      "/app/documents",
      "/app/vaccines",
      "/app/planner",
      "/app/agenda",
        "/app/farm",
        "/app/platform",
        "/app/tech",
        "/app/system",
    ];
    return allowed.some((x) => p === x || p.startsWith(x + "/"));
  })();

  const shouldRedirect = Boolean(
    user &&
      !onboarded &&
      location.pathname !== "/onboarding" &&
      !location.pathname.startsWith("/share/") &&
      !(petCreated && location.pathname.startsWith("/app/")) &&
      !onboardingAllowed
  );

  useEffect(() => {
    if (!shouldRedirect) return;
    try {
      const now = Date.now();
      const k = "lifepet:lastOnboardingRedirect";
      const lastRaw = sessionStorage.getItem(k);
      const last = lastRaw ? (JSON.parse(lastRaw) as { at?: unknown; path?: unknown }) : null;
      const lastAt = typeof last?.at === "number" ? last.at : 0;
      const lastPath = typeof last?.path === "string" ? last.path : "";
      if (now - lastAt < 5000 && lastPath === location.pathname) return;
      sessionStorage.setItem(k, JSON.stringify({ at: now, path: location.pathname }));
      pushToast({
        type: "info",
        title: "Onboarding",
        message: "Completa i passaggi iniziali per usare tutte le funzioni senza interruzioni.",
      });
    } catch {
      return;
    }
  }, [location.pathname, pushToast, shouldRedirect]);

  if (!user) return <>{children}</>;
  if (!shouldRedirect) return <>{children}</>;
  return <Navigate to="/onboarding" replace state={{ from: location }} />;
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    pushQa("nav", `${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search]);
  return null;
}

function TelemetryTracker() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);

  useEffect(() => {
    void trackEvent({
      uid: user?.uid,
      profile,
      event: "page_view",
      route: `${location.pathname}${location.search}`,
      minIntervalMs: 800,
    });
  }, [location.pathname, location.search, profile, user?.uid]);

  return null;
}

export default function App() {
  useThemeStore((s) => s.palette);
  const [demoEpoch, setDemoEpoch] = useState(() => (isDemoModeEnabled() ? 1 : 0));
  const start = useAuthStore((s) => s.start);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    function onChange() {
      setDemoEpoch((x) => x + 1);
    }
    window.addEventListener("lifepet:demoMode", onChange);
    return () => window.removeEventListener("lifepet:demoMode", onChange);
  }, []);
  useEffect(() => {
    const unsub = start();
    return () => unsub();
  }, [start]);

  useEffect(() => {
    const shouldForceReload = (msg: string) => {
      const m = msg.toLowerCase();
      return (
        m.includes("failed to fetch dynamically imported module") ||
        m.includes("loading chunk") ||
        m.includes("chunkloaderror") ||
        m.includes("importing a module script failed")
      );
    };

    const clearServiceWorkersAndCaches = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        await Promise.resolve();
      }
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        await Promise.resolve();
      }
    };

    const tryReloadOnce = () => {
      const k = "lifepet:reloadedOnce";
      if (sessionStorage.getItem(k) === "1") return;
      sessionStorage.setItem(k, "1");
      pushToast({ type: "info", title: "Aggiornamento", message: "Sto aggiornando l’app…" });
      setTimeout(async () => {
        await clearServiceWorkersAndCaches();
        window.location.reload();
      }, 300);
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : "Errore imprevisto";
      pushQa("error", `unhandledrejection: ${msg}`);
      if (shouldForceReload(msg)) {
        tryReloadOnce();
        return;
      }
      pushToast({ type: "error", title: "Errore", message: msg });
    };
    const onError = (e: ErrorEvent) => {
      const msg = e.error instanceof Error ? e.error.message : (e.message || "Errore imprevisto");
      pushQa("error", `error: ${msg}`);
      if (shouldForceReload(msg)) {
        tryReloadOnce();
        return;
      }
      pushToast({ type: "error", title: "Errore", message: msg });
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [pushToast]);

  useEffect(() => {
    const record = () => {
      try {
        const raw = sessionStorage.getItem("lifepet:nav");
        const arr = raw ? (JSON.parse(raw) as unknown) : [];
        const list = Array.isArray(arr) ? (arr as unknown[]).filter((x) => typeof x === "string") : [];
        const next = [...list, window.location.pathname + window.location.search + window.location.hash].slice(-25);
        sessionStorage.setItem("lifepet:nav", JSON.stringify(next));
      } catch {
        return;
      }
    };
    record();
    window.addEventListener("popstate", record);
    return () => window.removeEventListener("popstate", record);
  }, []);

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-700">Caricamento…</div>
          </div>
        }
      >
        <Router key={demoEpoch}>
          <RouteTracker />
          <TelemetryTracker />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/p/:publicId" element={<PetPublic />} />
            <Route path="/share/:token" element={<SharedRecords />} />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <OnboardingGate>
                    <AppShellLayout />
                  </OnboardingGate>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="explore" element={<Explore />} />
              <Route path="gallery" element={Gallery ? <Gallery /> : <Navigate to="/app/explore" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="system" element={<SystemHealth />} />
              <Route path="pets" element={<Pets />} />
              <Route path="protection" element={<RequireActivePet><Protection /></RequireActivePet>} />
              <Route path="health" element={<RequireActivePet><Health /></RequireActivePet>} />
              <Route path="ai" element={<RequireActivePet><Ai /></RequireActivePet>} />
              <Route path="ai/chat" element={<RequireActivePet><AiChat /></RequireActivePet>} />
              <Route path="ai/symptoms" element={<RequireActivePet><AiSymptoms /></RequireActivePet>} />
              <Route path="ai/photo" element={<RequireActivePet><AiPhoto /></RequireActivePet>} />
              <Route path="ai/video" element={<RequireActivePet><AiVideo /></RequireActivePet>} />
              <Route path="ai/summary" element={<RequireActivePet><AiSummary /></RequireActivePet>} />
              <Route path="ai/saves" element={<RequireActivePet><AiSavesPage /></RequireActivePet>} />
              <Route path="ai-saves" element={<Navigate to="/app/ai/saves" replace />} />
              <Route path="symptoms" element={<Navigate to="/app/ai/symptoms" replace />} />
              <Route path="nutrition" element={<RequireActivePet><Nutrition /></RequireActivePet>} />
              <Route path="wellness" element={<RequireActivePet><Wellness /></RequireActivePet>} />
              <Route path="status" element={<RequireActivePet><Status /></RequireActivePet>} />
              <Route path="agenda" element={<RequireActivePet><Agenda /></RequireActivePet>} />
              <Route path="planner" element={<RequireActivePet><Planner /></RequireActivePet>} />
              <Route path="training" element={<RequireActivePet><Training /></RequireActivePet>} />
              <Route path="bookings" element={<RequireActivePet><Bookings /></RequireActivePet>} />
              <Route path="provider" element={ProviderConsole ? <ProviderConsole /> : <Navigate to="/app/settings" replace />} />
              <Route path="records" element={<RequireActivePet><Records /></RequireActivePet>} />
              <Route path="documents" element={<RequireActivePet><Documents /></RequireActivePet>} />
              <Route path="medications" element={<RequireActivePet><Medications /></RequireActivePet>} />
              <Route path="vaccines" element={<RequireActivePet><Vaccines /></RequireActivePet>} />
              <Route path="vision" element={<Navigate to="/app/ai/photo" replace />} />
              <Route path="video" element={<Navigate to="/app/ai/video" replace />} />
              <Route path="gps" element={<RequireActivePet><Gps /></RequireActivePet>} />
              <Route path="nearby" element={<Nearby />} />
              <Route path="expenses" element={<RequireActivePet><Expenses /></RequireActivePet>} />
              <Route path="community" element={<Community />} />
              <Route path="adoptions" element={<Adoptions />} />
              <Route path="moderation" element={Moderation ? <Moderation /> : <Navigate to="/app/settings" replace />} />
              <Route path="marketplace" element={<RequireActivePet><Marketplace /></RequireActivePet>} />
              <Route path="platform" element={<Navigate to="/app/tech" replace />} />
              <Route path="platform/devices" element={<Navigate to="/app/tech/devices" replace />} />
              <Route path="platform/alerts" element={<Navigate to="/app/tech/alerts" replace />} />
              <Route path="platform/integrations" element={<Navigate to="/app/tech/integrations" replace />} />
              <Route path="platform/import" element={<Navigate to="/app/tech/import" replace />} />
              <Route path="platform/diagnostics" element={<Navigate to="/app/tech/diagnostics" replace />} />
              <Route path="platform/subjects/:subjectId" element={<Navigate to="/app/tech/subjects/:subjectId" replace />} />
              <Route path="platform/marketplace" element={<Navigate to="/app/tech/marketplace" replace />} />

              <Route
                path="farm"
                element={
                  <RequirePro feature="Farm">
                    <FarmShellLayout />
                  </RequirePro>
                }
              >
                <Route index element={<FarmDashboard />} />
                <Route path="map" element={<FarmMap />} />
                <Route path="subjects" element={<FarmSubjects />} />
                <Route path="subjects/:subjectId" element={<PlatformSubjectProfile />} />
                <Route path="devices" element={<PlatformDevices />} />
                <Route path="alerts" element={<PlatformAlerts />} />
                <Route path="integrations" element={<PlatformIntegrations />} />
                <Route path="herds" element={<PlatformHerdManagement />} />
                <Route path="herds/:herdId" element={<FarmHerdDashboard />} />
                <Route path="geofences" element={<PlatformGeofences />} />
                <Route path="reports" element={<PlatformReports />} />
                <Route path="import" element={<PlatformImportCsv />} />
                <Route path="diagnostics" element={<PlatformSyncDiagnostics />} />
                <Route path="marketplace" element={<PlatformDeviceMarketplace />} />
                <Route path="settings" element={<Navigate to="/app/farm/settings/thresholds" replace />} />
                <Route path="settings/thresholds" element={<PlatformThresholdSettings />} />
                <Route path="settings/notifications" element={<PlatformNotificationSettings />} />
              </Route>

              <Route path="tech" element={<PetTechDashboard />} />
              <Route path="tech/devices" element={<PlatformDevices />} />
              <Route path="tech/alerts" element={<PlatformAlerts />} />
              <Route path="tech/integrations" element={<PlatformIntegrations />} />
              <Route path="tech/import" element={<PlatformImportCsv />} />
              <Route path="tech/diagnostics" element={<PlatformSyncDiagnostics />} />
              <Route path="tech/subjects/:subjectId" element={<PlatformSubjectProfile />} />
              <Route path="tech/marketplace" element={<PlatformDeviceMarketplace />} />
              <Route path="tech/settings" element={<Navigate to="/app/tech/settings/thresholds" replace />} />
              <Route path="tech/settings/thresholds" element={<PlatformThresholdSettings />} />
              <Route path="tech/settings/notifications" element={<PlatformNotificationSettings />} />
              <Route path="insights" element={<Navigate to="/app/ai/summary" replace />} />
              <Route path="notifications" element={<RequireActivePet><Notifications /></RequireActivePet>} />
              <Route path="settings" element={<Settings />} />
              <Route path="system" element={<SystemHealth />} />
              <Route
                path="diagnostics"
                element={Diagnostics ? <Diagnostics /> : <Navigate to="/app/settings" replace />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </Suspense>
    </ErrorBoundary>
  );
}

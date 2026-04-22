import { NavLink, Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  CalendarDays,
  HeartPulse,
  Activity,
  Bell,
  ClipboardList,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  Crown,
  FileText,
  FolderOpen,
  LayoutGrid,
  LayoutDashboard,
  LogOut,
  MapPinned,
  HeartHandshake,
  MapPin,
  PawPrint,
  Receipt,
  Settings,
  ShieldPlus,
  Pill,
  Syringe,
  ShoppingBag,
  Sparkles,
  Cpu,
  Users,
  GraduationCap,
  ListTodo,
  Menu,
  Plus,
  RefreshCw,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirebase } from "@/lib/firebase";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useTutorialStore } from "@/stores/tutorialStore";
import { findTutorialSection } from "@/lib/tutorialContent";
import { subscribeMyPets } from "@/data/pets";
import type { Pet } from "@/types";
import { PetSwitcher } from "@/components/PetSwitcher";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { Toasts } from "@/components/Toasts";
import { AiAssistFab } from "@/components/AiAssistFab";
import { CreatePetModal } from "@/components/pets/CreatePetModal";
import { usePetCreateStore } from "@/stores/petCreateStore";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import { tr, type AppLang } from "@/lib/i18n";
import { useI18nStore } from "@/stores/i18nStore";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { isDemoModeEnabled, setDemoModeEnabled } from "@/lib/runtimeMode";
import { Alert } from "@/components/ui/Alert";
import { getOnboardingProgressPercent, getOnboardingSteps, isOnboardingCompleted, setOnboardingCompleted } from "@/lib/onboardingV2";
import { Modal } from "@/components/ui/Modal";
import { useBillingStore } from "@/stores/billingStore";

type I18nText = string | { it: string; en: string };
type NavItem = { to: string; label: I18nText; icon: typeof LayoutGrid; modOnly?: boolean };

function resolveText(lang: AppLang, v: I18nText) {
  if (typeof v === "string") return v;
  return tr(lang, v.it, v.en);
}

const navGroups: Array<{ id: "core" | "secondary" | "farm"; title: I18nText; items: NavItem[] }> = [
  {
    id: "core",
    title: { it: "Core", en: "Core" },
    items: [
      { to: "/app/dashboard", label: { it: "Dashboard", en: "Dashboard" }, icon: LayoutDashboard },
      { to: "/app/pets", label: { it: "Pet", en: "Pet" }, icon: PawPrint },
      { to: "/app/protection", label: { it: "Protezione", en: "Protection" }, icon: ShieldPlus },
      { to: "/app/documents", label: { it: "Documenti", en: "Documents" }, icon: FolderOpen },
      { to: "/app/health", label: { it: "Salute", en: "Health" }, icon: HeartPulse },
      { to: "/app/planner", label: { it: "Routine", en: "Routine" }, icon: ListTodo },
    ],
  },
  {
    id: "secondary",
    title: { it: "Secondaria", en: "Secondary" },
    items: [
      { to: "/app/ai/chat", label: "AI", icon: Sparkles },
      { to: "/app/records", label: { it: "Cartella clinica", en: "Medical record" }, icon: FileText },
      { to: "/app/agenda", label: { it: "Agenda", en: "Agenda" }, icon: CalendarDays },
      { to: "/app/vaccines", label: { it: "Vaccini", en: "Vaccines" }, icon: Syringe },
      { to: "/app/medications", label: { it: "Terapie", en: "Medications" }, icon: Pill },
      { to: "/app/gps", label: "GPS", icon: MapPin },
      { to: "/app/nearby", label: { it: "Servizi vicini", en: "Nearby" }, icon: MapPinned },
      { to: "/app/explore", label: { it: "Esplora", en: "Explore" }, icon: LayoutGrid },
      { to: "/app/community", label: "Community", icon: Users },
      { to: "/app/adoptions", label: { it: "Adozioni", en: "Adoptions" }, icon: HeartHandshake },
      { to: "/app/marketplace", label: { it: "Marketplace", en: "Marketplace" }, icon: ShoppingBag },
      { to: "/app/expenses", label: { it: "Spese", en: "Expenses" }, icon: Receipt },
      { to: "/app/training", label: { it: "Training", en: "Training" }, icon: GraduationCap },
      { to: "/app/notifications", label: { it: "Notifiche", en: "Notifications" }, icon: Bell },
      { to: "/app/status", label: { it: "Status", en: "Status" }, icon: Activity },
      { to: "/app/tech", label: { it: "Tecnologia", en: "Tech" }, icon: Cpu },
      { to: "/app/settings", label: { it: "Impostazioni", en: "Settings" }, icon: Settings },
      { to: "/app/system", label: { it: "Stato sistema", en: "System status" }, icon: Wrench },
      ...(import.meta.env.DEV ? [{ to: "/app/diagnostics", label: { it: "Diagnostica", en: "Diagnostics" }, icon: Wrench } as const] : []),
      ...(import.meta.env.DEV
        ? [
            { to: "/app/provider", label: { it: "Console pro", en: "Pro console" }, icon: ClipboardList },
            { to: "/app/moderation", label: { it: "Moderazione", en: "Moderation" }, icon: ShieldPlus, modOnly: true },
          ]
        : []),
    ],
  },
  {
    id: "farm",
    title: { it: "Farm", en: "Farm" },
    items: [{ to: "/app/farm", label: { it: "Apri Farm", en: "Open Farm" }, icon: Users }],
  },
];

const mobileNav = [
  { to: "/app/dashboard", label: { it: "Home", en: "Home" }, icon: LayoutDashboard },
  { to: "/app/pets", label: { it: "Pet", en: "Pet" }, icon: PawPrint },
  { to: "/app/documents", label: { it: "Documenti", en: "Documents" }, icon: FolderOpen },
  { to: "/app/protection", label: { it: "Protezione", en: "Protection" }, icon: ShieldPlus },
  { to: "/app/planner", label: { it: "Routine", en: "Routine" }, icon: ListTodo },
];

export function AppShellLayout() {
  const lang = useI18nStore((s) => s.lang);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setPets = usePetStore((s) => s.setPets);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const navigate = useNavigate();
  const location = useLocation();
  const tutorialEnabled = useTutorialStore((s) => s.enabled);
  const tutorialOpen = useTutorialStore((s) => s.open);
  const tutorialAutoOpened = useTutorialStore((s) => s.autoOpened);
  const tutorialCompleted = useTutorialStore((s) => s.completedRouteKeys);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const openCreatePet = usePetCreateStore((s) => s.openDialog);
  const [navQuery, setNavQuery] = useState("");
  const [isModerator, setIsModerator] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [autoDemo, setAutoDemo] = useState(false);
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled());
  const [onboarding, setOnboarding] = useState(() => ({ completed: isOnboardingCompleted(), steps: getOnboardingSteps() }));
  const [signupPromptOpen, setSignupPromptOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const billingStatus = useBillingStore((s) => s.status);
  const billingLoading = useBillingStore((s) => s.loading);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const clearBilling = useBillingStore((s) => s.clear);

  const tutorialSection = useMemo(() => findTutorialSection(location.pathname), [location.pathname]);
  const onboardingPercent = useMemo(() => getOnboardingProgressPercent(onboarding.steps), [onboarding.steps]);
  const onboardingNext = useMemo(() => {
    const s = onboarding.steps;
    if (onboarding.completed) return null;
    if (!s.petCreated) return tr(lang, "Crea il tuo primo animale", "Create your first pet");
    if (!s.docOrVaccineAdded) return tr(lang, "Aggiungi un documento o un vaccino", "Add a document or a vaccine");
    if (!s.reminderCreated) return tr(lang, "Crea un promemoria", "Create a reminder");
    return tr(lang, "Completa onboarding", "Complete onboarding");
  }, [lang, onboarding.completed, onboarding.steps]);

  const pageKey = useMemo(() => {
    const p = location.pathname;
    if (p === "/" || p === "/login") return "public";
    if (p === "/onboarding") return "onboarding";
    if (p.startsWith("/share/")) return "share";

    const seg = p.startsWith("/app/") ? p.slice("/app/".length).split("/")[0] : "";
    if (!seg) return "app";
    if (seg === "ai") {
      const second = p.slice("/app/".length).split("/")[1] || "";
      if (second === "chat") return "ai-chat";
      if (second === "symptoms") return "ai-symptoms";
      if (second === "photo") return "ai-photo";
      if (second === "video") return "ai-video";
      if (second === "summary") return "ai-summary";
      if (second === "saves") return "ai-saves";
      return "ai";
    }
    return seg;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyPets(user.uid, (p) => setPets(p));
    return () => unsub();
  }, [setPets, user]);

  useEffect(() => {
    if (!user) {
      clearBilling();
      return;
    }
    void refreshBilling();
  }, [clearBilling, refreshBilling, user]);

  useEffect(() => {
    function onChange() {
      setOnboarding({ completed: isOnboardingCompleted(), steps: getOnboardingSteps() });
    }
    window.addEventListener("lifepet:onboarding", onChange);
    return () => window.removeEventListener("lifepet:onboarding", onChange);
  }, []);

  useEffect(() => {
    if (!user?.isDemo) return;
    try {
      if (typeof navigator !== "undefined" && (navigator as unknown as { webdriver?: boolean }).webdriver) return;
    } catch {
      return;
    }
    const dismissedKey = "lifepet:demo:signupPromptDismissed:v1";
    try {
      if (sessionStorage.getItem(dismissedKey) === "1") return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => {
      setSignupPromptOpen(true);
    }, 15_000);
    return () => window.clearTimeout(t);
  }, [user?.isDemo]);

  useEffect(() => {
    const petId = new URLSearchParams(location.search).get("petId");
    if (!petId) return;
    if (pets.some((p) => p.id === petId) && petId !== activePetId) {
      setActivePetId(petId);
    }
  }, [activePetId, location.search, pets, setActivePetId]);

  useEffect(() => {
    if (!user || user.isDemo) {
      setIsModerator(false);
      return;
    }
    const { db } = getFirebase();
    let cancelled = false;
    void getDoc(doc(db, "moderators", user.uid))
      .then((snap) => {
        if (cancelled) return;
        setIsModerator(snap.exists());
      })
      .catch((e) => {
        if (cancelled) return;
        setIsModerator(false);
        reportFirestoreError(e, "moderatori");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const navFiltered = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    return navGroups
      .map((g) => {
        const items = g.items
          .filter((i) => !i.modOnly || isModerator)
          .filter((i) => {
            const label = resolveText(lang, i.label);
            return !q ? true : label.toLowerCase().includes(q);
          });
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [isModerator, lang, navQuery]);

  const secondaryHasActiveRoute = useMemo(() => {
    const p = location.pathname;
    const sec = navGroups.find((g) => g.id === "secondary");
    if (!sec) return false;
    return sec.items.some((i) => p === i.to || p.startsWith(i.to + "/"));
  }, [location.pathname]);

  useEffect(() => {
    const hasSearch = navQuery.trim().length > 0;
    if (hasSearch || secondaryHasActiveRoute) {
      setSecondaryOpen(true);
    }
  }, [navQuery, secondaryHasActiveRoute]);

  const showNoPetBanner = useMemo(() => {
    if (!user) return false;
    if (!pets || pets.length === 0) {
      return location.pathname !== "/app/dashboard";
    }
    return false;
  }, [location.pathname, pets, user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    function read() {
      try {
        setAutoDemo(sessionStorage.getItem("lifepet:fsAutoDemo") === "1");
      } catch {
        setAutoDemo(false);
      }
      setDemoMode(isDemoModeEnabled());
    }
    read();
    window.addEventListener("lifepet:demoMode", read);
    return () => window.removeEventListener("lifepet:demoMode", read);
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (!tutorialEnabled) return;
    if (tutorialAutoOpened) return;
    if (location.pathname !== "/app/dashboard") return;
    if (!tutorialSection) return;
    if (tutorialOpen) return;
    const hasAnyCompleted = Object.keys(tutorialCompleted).length > 0;
    if (hasAnyCompleted) {
      useTutorialStore.getState().setAutoOpened(true);
      return;
    }
    useTutorialStore.getState().openForRoute(location.pathname);
    useTutorialStore.getState().setAutoOpened(true);
  }, [location.pathname, tutorialAutoOpened, tutorialCompleted, tutorialEnabled, tutorialOpen, tutorialSection]);

  const activePet = useMemo(() => {
    return pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;
  }, [activePetId, pets]);

  const isPro = billingStatus?.effectivePlan === "pro";

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen pb-[72px] lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside
          className="hidden lg:block backdrop-blur-sm"
          style={{ borderRight: "1px solid rgba(var(--lp-ink),0.10)", backgroundColor: "rgba(var(--lp-surface),0.55)" }}
        >
          <div className="h-screen sticky top-0 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 px-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.20)" }}
              >
                <PawPrint className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {APP_NAME}
                  {user?.isDemo ? (
                    <span className="inline-flex items-center rounded-full border border-indigo-600/20 bg-indigo-600/10 px-2 py-0.5 text-[10px] text-indigo-800">
                      DEMO
                    </span>
                  ) : null}
                  {billingLoading ? null : (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
                        isPro ? "border-amber-500/25 bg-amber-500/10 text-amber-900" : "border-slate-500/20 bg-slate-500/10 text-slate-700"
                      )}
                      title={isPro ? tr(lang, "Piano Pro attivo", "Pro plan active") : tr(lang, "Piano Free", "Free plan")}
                    >
                      {isPro ? "PRO" : "FREE"}
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  {tr(lang, APP_TAGLINE.it, APP_TAGLINE.en)}
                </div>
              </div>
            </div>

            {!isPro ? (
              <Link
                to="/app/settings#premium"
                className="mx-2 rounded-xl px-3 py-2 text-sm inline-flex items-center justify-center gap-2 motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-0.5"
                style={{ backgroundColor: "rgba(200,162,74,0.12)", border: "1px solid rgba(200,162,74,0.28)", color: "rgb(var(--lp-ink))" }}
              >
                <Crown className="w-4 h-4" style={{ color: "rgb(157, 110, 0)" }} />
                {tr(lang, "Passa a Premium", "Go Premium")}
              </Link>
            ) : null}

            <PetSwitcher pets={pets as Pet[]} activePet={activePet} />

            <button type="button" onClick={openCreatePet} className="lp-btn-primary inline-flex items-center justify-center gap-2 mx-2">
              <Plus className="w-4 h-4" />
              {tr(lang, "Crea pet", "Create pet")}
            </button>

            <nav className="flex flex-col gap-1 overflow-y-auto">
              <div className="px-2 pb-2">
                <input
                  className="lp-input"
                  placeholder={tr(lang, "Cerca… (es. Community)", "Search… (e.g. Community)")}
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                />
              </div>
              {navFiltered.map((group) => (
                <div key={group.id} className="px-2 pb-2">
                  <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2" style={{ color: "rgb(var(--lp-muted))" }}>
                    <div className="text-[11px] font-semibold tracking-wide uppercase">{resolveText(lang, group.title)}</div>
                    {group.id === "secondary" ? (
                      <button
                        type="button"
                        className="p-1 rounded-lg"
                        onClick={() => setSecondaryOpen((v) => !v)}
                        style={{ backgroundColor: "rgba(var(--lp-surface),0.55)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
                        aria-label={secondaryOpen ? tr(lang, "Comprimi", "Collapse") : tr(lang, "Espandi", "Expand")}
                      >
                        {secondaryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : null}
                  </div>
                  <div className={cn("flex flex-col gap-1", group.id === "secondary" && !secondaryOpen ? "hidden" : "")}
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm motion-safe:transition-[transform,box-shadow,background-color,color] motion-safe:duration-200 motion-safe:ease-out",
                              isActive ? "shadow-sm" : "hover:-translate-y-0.5"
                            )
                          }
                          style={({ isActive }) =>
                            isActive
                              ? {
                                  backgroundColor: "rgba(var(--lp-surface),0.70)",
                                  border: "1px solid rgba(var(--lp-ink),0.10)",
                                  color: "rgb(var(--lp-ink))",
                                }
                              : {
                                  color: "rgb(var(--lp-muted))",
                                }
                          }
                        >
                          <Icon className="w-4 h-4" />
                          {resolveText(lang, item.label)}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(var(--lp-ink),0.10)" }}>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-0.5"
                style={{ backgroundColor: "rgba(var(--lp-surface),0.55)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
              >
                <LogOut className="w-4 h-4" />
                {tr(lang, "Esci", "Sign out")}
              </button>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden flex flex-col pt-16 px-4 pb-24 overflow-y-auto"
            style={{
              background: "var(--lp-app-bg)",
            }}
          >
            <div className="mb-4">
              <PetSwitcher pets={pets as Pet[]} activePet={activePet} />
              <div className="mt-2">
                <button type="button" onClick={openCreatePet} className="lp-btn-primary w-full inline-flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  {tr(lang, "Crea pet", "Create pet")}
                </button>
              </div>
            </div>
            <nav className="flex flex-col gap-2">
              <div className="mb-2">
                <input
                  className="lp-input"
                  placeholder={tr(lang, "Cerca…", "Search…")}
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                />
              </div>
              {navFiltered.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="px-1 pt-2 flex items-center justify-between gap-2" style={{ color: "rgb(var(--lp-muted))" }}>
                    <div className="text-[11px] font-semibold tracking-wide uppercase">{resolveText(lang, group.title)}</div>
                    {group.id === "secondary" ? (
                      <button
                        type="button"
                        className="p-1 rounded-lg"
                        onClick={() => setSecondaryOpen((v) => !v)}
                        style={{ backgroundColor: "rgba(var(--lp-surface),0.55)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
                        aria-label={secondaryOpen ? tr(lang, "Comprimi", "Collapse") : tr(lang, "Espandi", "Expand")}
                      >
                        {secondaryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : null}
                  </div>
                  <div className={cn("flex flex-col gap-2", group.id === "secondary" && !secondaryOpen ? "hidden" : "")}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-base motion-safe:transition-[transform,box-shadow,background-color,color] motion-safe:duration-200 motion-safe:ease-out",
                              isActive ? "font-medium shadow-sm" : "hover:-translate-y-0.5"
                            )
                          }
                          style={({ isActive }) =>
                            isActive
                              ? {
                                  background: "linear-gradient(90deg, rgba(var(--lp-primary),0.12) 0%, rgba(var(--lp-accent-1),0.10) 100%)",
                                  border: "1px solid rgba(var(--lp-primary),0.22)",
                                  color: "rgb(var(--lp-ink))",
                                }
                              : {
                                  backgroundColor: "rgba(var(--lp-surface),0.55)",
                                  border: "1px solid rgba(var(--lp-ink),0.10)",
                                  color: "rgb(var(--lp-muted))",
                                }
                          }
                        >
                          <Icon className="w-5 h-5" />
                          {resolveText(lang, item.label)}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-8 pt-4" style={{ borderTop: "1px solid rgba(var(--lp-ink),0.10)" }}>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-0.5"
                style={{ backgroundColor: "rgba(var(--lp-surface),0.65)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
              >
                <LogOut className="w-5 h-5" />
                {tr(lang, "Esci", "Sign out")}
              </button>
            </div>
          </div>
        )}

        <main className="min-h-full relative lp-page" data-lp-page={pageKey} spellCheck={false}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="lp-blob lp-blob-1 motion-safe:block hidden md:block" />
            <div className="lp-blob lp-blob-2 motion-safe:block hidden md:block" />
            <div className="lp-blob lp-blob-3 motion-safe:block hidden md:block" />
          </div>
          <div
            className="lg:hidden sticky top-0 z-50 backdrop-blur-md p-4 flex items-center justify-between gap-3"
            style={{ backgroundColor: "rgba(var(--lp-surface),0.70)", borderBottom: "1px solid rgba(var(--lp-ink),0.10)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.20)" }}
              >
                <PawPrint className="w-4 h-4" style={{ color: "rgb(var(--lp-primary-700))" }} />
              </div>
              <div className="font-semibold flex items-center gap-2">
                {APP_NAME}
                {user?.isDemo ? (
                  <span className="inline-flex items-center rounded-full border border-indigo-600/20 bg-indigo-600/10 px-2 py-0.5 text-[10px] text-indigo-800">
                    DEMO
                  </span>
                ) : null}
                {billingLoading ? null : (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
                      isPro ? "border-amber-500/25 bg-amber-500/10 text-amber-900" : "border-slate-500/20 bg-slate-500/10 text-slate-700"
                    )}
                  >
                    {isPro ? "PRO" : "FREE"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isPro ? (
                <Link
                  to="/app/settings#premium"
                  className="p-2 rounded-xl"
                  title={tr(lang, "Passa a Premium", "Go Premium")}
                  style={{ backgroundColor: "rgba(200,162,74,0.12)", border: "1px solid rgba(200,162,74,0.28)" }}
                >
                  <Crown className="w-5 h-5" style={{ color: "rgb(157, 110, 0)" }} />
                </Link>
              ) : null}
              <button
                type="button"
                onClick={openCreatePet}
                className="p-2 rounded-xl"
                title={tr(lang, "Crea pet", "Create pet")}
                style={{ backgroundColor: "rgba(var(--lp-primary),0.12)", border: "1px solid rgba(var(--lp-primary),0.22)" }}
              >
                <Plus className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl"
                style={{ backgroundColor: "rgba(var(--lp-surface),0.60)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="p-4 lg:p-8 relative">
            <div className="max-w-6xl mx-auto w-full">
              {!isOnline ? (
                <div className="mb-4">
                  <Alert variant="warn" title={tr(lang, "Sei offline", "You are offline")}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>{tr(lang, "La rete non è disponibile: alcune funzioni potrebbero non aggiornarsi.", "Network unavailable: some features may not update.")}</div>
                      <div className="inline-flex items-center gap-2 text-xs" style={{ color: "rgba(var(--lp-ink), 0.70)" }}>
                        <WifiOff className="w-4 h-4" />
                        {tr(lang, "Offline", "Offline")}
                      </div>
                    </div>
                  </Alert>
                </div>
              ) : null}

              {demoMode && autoDemo && !user?.isDemo ? (
                <div className="mb-4">
                  <Alert variant="info" title={tr(lang, "Recovery attivo", "Recovery active")}>
                    <div className="space-y-2">
                      <div>
                        {tr(
                          lang,
                          "Ho attivato i dati locali perché la connessione a Firestore era instabile o mancavano permessi. I tuoi dati cloud non vengono cancellati.",
                          "Local data mode is active because Firestore was unstable or permissions were missing. Your cloud data is not deleted."
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="lp-btn-primary inline-flex items-center gap-2"
                          onClick={() => {
                            try {
                              sessionStorage.removeItem("lifepet:fsAutoDemo");
                              sessionStorage.removeItem("lifepet:fsFail");
                            } catch {
                              return;
                            }
                            setDemoModeEnabled(false);
                            window.location.reload();
                          }}
                          disabled={!isOnline}
                        >
                          <RefreshCw className="w-4 h-4" />
                          {tr(lang, "Riprova online", "Retry online")}
                        </button>
                        <Link to="/app/settings" className="lp-btn-secondary inline-flex items-center justify-center">
                          {tr(lang, "Impostazioni", "Settings")}
                        </Link>
                      </div>
                    </div>
                  </Alert>
                </div>
              ) : null}

              {showNoPetBanner ? (
                <div
                  className="mb-4 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ border: "1px solid rgba(var(--lp-primary),0.20)", backgroundColor: "rgba(var(--lp-primary),0.10)" }}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {tr(lang, "Crea un pet per sbloccare tutte le funzioni", "Create a pet to unlock all features")}
                    </div>
                    <div className="text-xs text-slate-700">
                      {tr(lang, "Una volta creato, potrai usare Salute, Planner, Agenda, AI e tutto il resto.", "Once created, you can use Health, Planner, Agenda, AI and more.")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={openCreatePet} className="lp-btn-primary inline-flex items-center justify-center" type="button">
                      {tr(lang, "Crea pet", "Create pet")}
                    </button>
                    <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center justify-center">
                      {tr(lang, "Apri profilo", "Open profile")}
                    </Link>
                  </div>
                </div>
              ) : null}

              {user && !onboarding.completed ? (
                <div
                  className="mb-4 rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  style={{ border: "1px solid rgba(var(--lp-accent-1),0.22)", backgroundColor: "rgba(var(--lp-accent-1),0.10)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{tr(lang, "Onboarding in corso", "Onboarding in progress")}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgb(var(--lp-muted))" }}>{onboardingNext}</div>
                    <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--lp-ink),0.10)" }}>
                      <div
                        className="h-full"
                        style={{ width: `${onboardingPercent}%`, background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)" }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="lp-btn-primary" onClick={() => navigate("/onboarding")}>{tr(lang, "Continua", "Continue")}</button>
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={() => {
                        setOnboardingCompleted();
                        navigate("/app/dashboard");
                      }}
                    >
                      {tr(lang, "Salta", "Skip")}
                    </button>
                  </div>
                </div>
              ) : null}

      <ConfirmProvider>
        <Modal
          open={signupPromptOpen}
          title="Salva i dati del tuo animale"
          description="Stai usando la demo: crea un account per salvare tutto nel cloud e continuare su ogni dispositivo."
          onClose={() => {
            setSignupPromptOpen(false);
            try {
              sessionStorage.setItem("lifepet:demo:signupPromptDismissed:v1", "1");
            } catch {
              return;
            }
          }}
        >
          <div className="space-y-3">
            <div className="lp-panel p-3 text-sm">
              <div className="font-semibold">Cosa ottieni con l’account</div>
              <div className="mt-1 text-xs lp-muted">Backup automatico, accesso sicuro, condivisione semplice.</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="lp-btn-primary"
                onClick={async () => {
                  setSignupPromptOpen(false);
                  try {
                    sessionStorage.setItem("lifepet:demo:signupPromptDismissed:v1", "1");
                  } catch {
                    // ignore
                  }
                  await logout();
                  navigate("/login?mode=signup", { replace: true });
                }}
              >
                Crea account
              </button>
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  setSignupPromptOpen(false);
                  try {
                    sessionStorage.setItem("lifepet:demo:signupPromptDismissed:v1", "1");
                  } catch {
                    return;
                  }
                }}
              >
                Continua in demo
              </button>
            </div>
          </div>
        </Modal>
                <Outlet />
              </ConfirmProvider>
            </div>
          </div>

          <TutorialOverlay />
          <Toasts />
          <AiAssistFab />
          <CreatePetModal />

          {tutorialSection ? (
            <button
              onClick={() => {
                if (!useTutorialStore.getState().enabled) useTutorialStore.getState().setEnabled(true);
                useTutorialStore.getState().openForRoute(location.pathname);
              }}
              className="fixed right-4 bottom-20 lg:bottom-6 z-[55] rounded-full backdrop-blur-md px-4 py-2 text-sm font-medium shadow-sm inline-flex items-center gap-2"
              style={{ backgroundColor: "rgba(var(--lp-surface),0.78)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
            >
              <CircleHelp className="w-4 h-4 lp-icon-primary" />
              {tr(lang, "Tutorial", "Tutorial")}
            </button>
          ) : null}
        </main>
      </div>

      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 backdrop-blur-md pb-safe"
        style={{ backgroundColor: "rgba(var(--lp-surface),0.72)", borderTop: "1px solid rgba(var(--lp-ink),0.10)" }}
      >
        <div className="flex items-center h-16 px-2">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={resolveText(lang, item.label)}
                className="flex-1 min-w-0 h-full flex items-center justify-center"
              >
                {({ isActive }) => (
                  <div
                    className={cn(
                      "w-full max-w-[92px] h-12 rounded-2xl flex flex-col items-center justify-center gap-1",
                      "motion-safe:transition-[background-color,transform,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out"
                    )}
                    style={
                      isActive
                        ? {
                            background: "linear-gradient(90deg, rgba(var(--lp-primary),0.12) 0%, rgba(var(--lp-accent-1),0.10) 100%)",
                            border: "1px solid rgba(var(--lp-primary),0.22)",
                            boxShadow: "0 10px 22px rgba(var(--lp-ink), 0.06)",
                            color: "rgb(var(--lp-primary-700))",
                          }
                        : { border: "1px solid transparent", color: "rgb(var(--lp-muted))" }
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium truncate max-w-[80px]">{resolveText(lang, item.label)}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

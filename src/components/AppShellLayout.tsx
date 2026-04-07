import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  HeartPulse,
  Activity,
  ClipboardList,
  Files,
  LayoutDashboard,
  LogOut,
  MapPin,
  PawPrint,
  Receipt,
  Settings,
  ShieldPlus,
  Stethoscope,
  Pill,
  Syringe,
  ShoppingBag,
  Sparkles,
  Users,
  Utensils,
  GraduationCap,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { subscribeMyPets } from "@/data/pets";
import type { Pet } from "@/types";
import { PetSwitcher } from "@/components/PetSwitcher";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/status", label: "Status", icon: Activity },
  { to: "/app/pets", label: "Profilo Pet", icon: PawPrint },
  { to: "/app/health", label: "Salute", icon: ShieldPlus },
  { to: "/app/symptoms", label: "Sintomi AI", icon: Stethoscope },
  { to: "/app/records", label: "Cartella clinica", icon: Files },
  { to: "/app/documents", label: "Documenti", icon: Files },
  { to: "/app/medications", label: "Terapie", icon: Pill },
  { to: "/app/vaccines", label: "Vaccini", icon: Syringe },
  { to: "/app/nutrition", label: "Alimentazione", icon: Utensils },
  { to: "/app/wellness", label: "Benessere", icon: HeartPulse },
  { to: "/app/agenda", label: "Agenda", icon: CalendarCheck },
  { to: "/app/planner", label: "Planner", icon: CalendarCheck },
  { to: "/app/training", label: "Training", icon: GraduationCap },
  { to: "/app/bookings", label: "Prenotazioni", icon: ClipboardList },
  { to: "/app/gps", label: "GPS", icon: MapPin },
  { to: "/app/expenses", label: "Spese", icon: Receipt },
  { to: "/app/community", label: "Community", icon: Users },
  { to: "/app/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/app/insights", label: "Insights", icon: Sparkles },
  { to: "/app/settings", label: "Impostazioni", icon: Settings },
];

const mobileNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/planner", label: "Task", icon: CalendarCheck },
  { to: "/app/pets", label: "Pet", icon: PawPrint },
  { to: "/app/insights", label: "AI", icon: Sparkles },
];

export function AppShellLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setPets = usePetStore((s) => s.setPets);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyPets(user.uid, (p) => setPets(p));
    return () => unsub();
  }, [setPets, user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const activePet = useMemo(() => {
    return pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;
  }, [activePetId, pets]);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-[72px] lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-slate-800 bg-slate-950">
          <div className="h-screen sticky top-0 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-300/15 border border-emerald-300/30 flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-emerald-200" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold flex items-center gap-2">
                  LifePet
                  {user?.isDemo ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-100">
                      DEMO
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">Care, planner, insights</div>
              </div>
            </div>

            <PetSwitcher pets={pets as Pet[]} activePet={activePet} />

            <nav className="flex flex-col gap-1 overflow-y-auto">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-slate-900 text-slate-100"
                          : "text-slate-300 hover:bg-slate-900/60 hover:text-slate-100"
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-slate-800">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm border border-slate-800 hover:bg-slate-900"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950 lg:hidden flex flex-col pt-16 px-4 pb-24 overflow-y-auto">
            <div className="mb-4">
              <PetSwitcher pets={pets as Pet[]} activePet={activePet} />
            </div>
            <nav className="flex flex-col gap-2">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-base transition-colors",
                        isActive
                          ? "bg-slate-900 text-slate-100 font-medium"
                          : "text-slate-300 hover:bg-slate-900/60 hover:text-slate-100"
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="mt-8 pt-4 border-t border-slate-800">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base border border-slate-800 hover:bg-slate-900"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        )}

        <main className="min-h-full relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-400/10 blur-3xl rounded-full" />
            <div className="absolute top-24 -right-28 w-96 h-96 bg-cyan-400/10 blur-3xl rounded-full" />
          </div>
          <div className="lg:hidden sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-300/15 border border-emerald-300/30 flex items-center justify-center">
                <PawPrint className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="font-semibold flex items-center gap-2">
                LifePet
                {user?.isDemo ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-100">
                    DEMO
                  </span>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl border border-slate-800 hover:bg-slate-900"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <div className="p-4 lg:p-8 relative">
            <div className="max-w-6xl mx-auto w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
                    isActive ? "text-emerald-300" : "text-slate-400 hover:text-slate-200"
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

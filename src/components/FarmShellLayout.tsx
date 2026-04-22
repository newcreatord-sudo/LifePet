import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cable,
  ClipboardList,
  Fence,
  Home,
  LogOut,
  Map,
  Settings,
  Siren,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Toasts } from "@/components/Toasts";
import { subscribeFarms } from "@/multispecies/data/msData";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import type { Farm } from "@/multispecies/types";

type NavItem = { to: string; label: string; icon: typeof Home };

const NAV: NavItem[] = [
  { to: "/app/farm", label: "Dashboard", icon: Home },
  { to: "/app/farm/map", label: "Mappa", icon: Map },
  { to: "/app/farm/subjects", label: "Animali", icon: Users },
  { to: "/app/farm/devices", label: "Dispositivi", icon: Cable },
  { to: "/app/farm/herds", label: "Mandrie", icon: Users },
  { to: "/app/farm/geofences", label: "Recinti", icon: Fence },
  { to: "/app/farm/alerts", label: "Alert", icon: Siren },
  { to: "/app/farm/integrations", label: "Integrazioni", icon: Sparkles },
  { to: "/app/farm/reports", label: "Report", icon: ClipboardList },
  { to: "/app/farm/import", label: "Import CSV", icon: Upload },
  { to: "/app/farm/diagnostics", label: "Diagnostica", icon: Activity },
  { to: "/app/farm/settings/thresholds", label: "Impostazioni", icon: Settings },
];

export function FarmShellLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const uid = user?.uid || "demo";

  const [farms, setFarms] = useState<Farm[]>([]);
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);
  const setActiveFarmId = useMsFarmStore((s) => s.setActiveFarmId);

  useEffect(() => subscribeFarms(uid, setFarms), [uid]);
  useEffect(() => {
    if (activeFarmId) return;
    if (farms[0]?.id) setActiveFarmId(farms[0].id);
  }, [activeFarmId, farms, setActiveFarmId]);

  const title = useMemo(() => {
    const p = location.pathname;
    const hit = NAV.find((n) => p === n.to || p.startsWith(n.to + "/"));
    return hit?.label || "Farm";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs lp-muted">Reparto</div>
            <div className="text-base font-semibold truncate" style={{ color: "rgb(var(--lp-ink))" }}>Farm · {title}</div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="text-xs lp-muted">Farm</div>
            <select
              className="lp-input"
              value={activeFarmId}
              onChange={(e) => setActiveFarmId(e.target.value)}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/app/dashboard" className="lp-btn-secondary">Pet</NavLink>
            <button type="button" className="lp-btn-secondary" onClick={() => logout()}>
              <span className="inline-flex items-center gap-2"><LogOut className="w-4 h-4" />Esci</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3">
          <div className="lp-panel p-2">
            <div className="px-2 py-2 text-xs lp-muted">Navigazione</div>

            <div className="px-2 pb-2 md:hidden">
              <div className="text-xs lp-muted">Farm</div>
              <select
                className="lp-input w-full mt-1"
                value={activeFarmId}
                onChange={(e) => setActiveFarmId(e.target.value)}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                      isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                    )
                  }
                  end={n.to === "/app/farm"}
                >
                  <n.icon className="w-4 h-4" />
                  <span className="truncate">{n.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="px-2 pt-3 pb-1 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>
              {user?.email ? `Account: ${user.email}` : ""}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}

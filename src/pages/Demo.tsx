import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function Demo() {
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const navigate = useNavigate();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      localStorage.setItem("lifepet:demoMode", "1");
      localStorage.setItem("lifepet:onboardingCompleted", "1");
      localStorage.setItem("lifepet:tutorial:v1", JSON.stringify({ enabled: false, completedRouteKeys: {} }));
    } catch {
      // ignore
    }

    enterDemo();
    queueMicrotask(() => navigate("/app/dashboard", { replace: true }));

    const t = window.setTimeout(() => {
      try {
        window.location.replace("/app/dashboard");
      } catch {
        return;
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [enterDemo, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <div className="lp-surface p-6 rounded-3xl border border-slate-200/70 shadow-sm w-full max-w-md">
        <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
          Avvio modalità demo…
        </div>
        <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>
          Stai per entrare nella Dashboard.
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-200/60 overflow-hidden">
          <div className="h-full w-1/2 bg-sky-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

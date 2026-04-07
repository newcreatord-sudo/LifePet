import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const start = useAuthStore((s) => s.start);
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const configError = useAuthStore((s) => s.configError);
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const location = useLocation();

  useEffect(() => {
    const unsub = start();
    return () => unsub();
  }, [start]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-40" />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-lg font-semibold">Firebase setup required</div>
          <div className="text-sm text-slate-300 mt-2">{configError}</div>
          <div className="text-sm text-slate-400 mt-3">
            Copy `.env.example` to `.env.local` and fill it with your Firebase Web App config.
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={enterDemo}
              className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300"
            >
              Enter demo mode
            </button>
            <a
              href="/login"
              className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

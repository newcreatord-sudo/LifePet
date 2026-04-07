import { Navigate, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { PawPrint, HeartPulse, ShieldPlus, Sparkles } from "lucide-react";

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  if (!ready) return <div className="min-h-screen bg-slate-950" />;
  if (user) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400/10 blur-3xl rounded-full" />
        <div className="absolute top-20 -right-28 w-[520px] h-[520px] bg-cyan-400/10 blur-3xl rounded-full" />
      </div>

      <header className="relative px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-300/15 border border-emerald-300/30 flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">LifePet</div>
              <div className="text-xs text-slate-400">Benessere, routine, salute</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900">
              Accedi
            </Link>
            <Link
              to="/login"
              className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300"
            >
              Inizia ora
            </Link>
          </div>
        </div>
      </header>

      <main className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section className="lg:col-span-7 pt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              <HeartPulse className="w-4 h-4 text-emerald-200" />
              Per chi mette il benessere al primo posto
            </div>
            <h1 className="mt-4 text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              La casa digitale del tuo animale, con cura quotidiana e serenità.
            </h1>
            <p className="mt-4 text-base text-slate-300 leading-relaxed max-w-2xl">
              Routine, cartella clinica, documenti, promemoria intelligenti e insight AI: tutto in un’unica app, pensata per chi
              ama davvero.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-300/90 text-slate-950 px-5 py-3 text-sm font-medium hover:bg-emerald-300"
              >
                Crea account
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-800 px-5 py-3 text-sm hover:bg-slate-900"
              >
                Esplora l’app
              </Link>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-5 overflow-hidden relative">
              <div className="absolute inset-0 opacity-60">
                <svg viewBox="0 0 600 600" className="w-full h-full">
                  <defs>
                    <radialGradient id="g1" cx="30%" cy="25%" r="60%">
                      <stop offset="0%" stopColor="rgba(52,211,153,0.25)" />
                      <stop offset="60%" stopColor="rgba(52,211,153,0.08)" />
                      <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                    </radialGradient>
                    <radialGradient id="g2" cx="70%" cy="70%" r="60%">
                      <stop offset="0%" stopColor="rgba(34,211,238,0.22)" />
                      <stop offset="60%" stopColor="rgba(34,211,238,0.06)" />
                      <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                    </radialGradient>
                  </defs>
                  <rect width="600" height="600" fill="url(#g1)" />
                  <rect width="600" height="600" fill="url(#g2)" />
                </svg>
              </div>
              <div className="relative space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Cosa puoi fare</div>
                    <div className="text-xs text-slate-400 mt-1">Inizia in 2 minuti</div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-300/10 border border-emerald-300/20 flex items-center justify-center">
                    <ShieldPlus className="w-5 h-5 text-emerald-200" />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldPlus className="w-4 h-4 text-emerald-200" />
                    Cartella clinica completa
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Eventi, documenti, visite, vaccini e storia in timeline.</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HeartPulse className="w-4 h-4 text-emerald-200" />
                    Routine e promemoria smart
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Idratazione, pasti, attività, terapie: sempre sotto controllo.</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    Insight AI responsabili
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Sintesi e supporto informativo, con disclaimer chiaro.</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

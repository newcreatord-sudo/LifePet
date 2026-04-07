import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { getFirebase, getFirebaseConfigError } from "@/lib/firebase";
import { HeartPulse, PawPrint, ShieldPlus, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { authUserMessage } from "@/lib/authErrors";

export default function Login() {
  const configError = getFirebaseConfigError();
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const navigate = useNavigate();

  const title = useMemo(() => (mode === "signin" ? "Accedi" : "Crea account"), [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (configError) {
      setError(configError);
      return;
    }
    setLoading(true);
    setError(null);
    setResetSent(false);
    try {
      const { auth } = getFirebase();
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(authUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onResetPassword() {
    if (configError) {
      setError(configError);
      return;
    }
    const addr = email.trim();
    if (!addr) {
      setError("Inserisci prima la tua email.");
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      const { auth } = getFirebase();
      await sendPasswordResetEmail(auth, addr);
      setResetSent(true);
    } catch (err) {
      setError(authUserMessage(err));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 text-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-fuchsia-400/25 blur-3xl rounded-full" />
        <div className="absolute top-20 -right-28 w-[520px] h-[520px] bg-sky-400/25 blur-3xl rounded-full" />
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative">
        <div className="lg:col-span-6 hidden lg:block">
          <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 overflow-hidden relative backdrop-blur-sm">
            <div className="absolute inset-0 opacity-60">
              <svg viewBox="0 0 600 600" className="w-full h-full">
                <defs>
                  <radialGradient id="lg1" cx="30%" cy="25%" r="60%">
                    <stop offset="0%" stopColor="rgba(52,211,153,0.25)" />
                    <stop offset="60%" stopColor="rgba(52,211,153,0.08)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                  </radialGradient>
                  <radialGradient id="lg2" cx="70%" cy="70%" r="60%">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.22)" />
                    <stop offset="60%" stopColor="rgba(34,211,238,0.06)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                  </radialGradient>
                </defs>
                <rect width="600" height="600" fill="url(#lg1)" />
                <rect width="600" height="600" fill="url(#lg2)" />
              </svg>
            </div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-2xl bg-fuchsia-600/10 border border-fuchsia-600/20 flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-fuchsia-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold">LifePet</div>
                  <div className="text-xs text-slate-600">Benessere, routine, salute</div>
                </div>
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight leading-tight">
                Ogni gesto conta. Teniamo insieme la storia del tuo animale.
              </div>
              <div className="mt-3 text-sm text-slate-700 leading-relaxed max-w-md">
                Pianifica routine, salva documenti, traccia sintomi e ottieni insight informativi con AI responsabile.
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldPlus className="w-4 h-4 text-fuchsia-700" />
                    Cartella clinica in ordine
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Timeline unica di eventi, log e documenti.</div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HeartPulse className="w-4 h-4 text-fuchsia-700" />
                    Routine e promemoria
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Terapie, vaccini, idratazione e attività.</div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-fuchsia-700" />
                    Insight AI
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Sintesi e supporto informativo, con disclaimer chiaro.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="flex items-center justify-center gap-2 mb-6 lg:hidden">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-600/10 border border-fuchsia-600/20 flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-fuchsia-700" />
            </div>
            <div className="text-lg font-semibold">LifePet</div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setMode("signin")}
                className={
                  mode === "signin"
                    ? "px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 text-sm"
                    : "px-3 py-1.5 rounded-xl text-sm text-slate-700 hover:bg-white/60"
                }
              >
                Accedi
              </button>
              <button
                onClick={() => setMode("signup")}
                className={
                  mode === "signup"
                    ? "px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 text-sm"
                    : "px-3 py-1.5 rounded-xl text-sm text-slate-700 hover:bg-white/60"
                }
              >
                Crea account
              </button>
            </div>

          <div className="text-xl font-semibold mb-1">{title}</div>
          <div className="text-sm text-slate-700 mb-4">Tieni traccia di routine, salute e insight AI.</div>

          {error ? (
            <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {resetSent ? (
            <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-900">
              Email inviata. Controlla la casella e lo spam.
            </div>
          ) : null}

          {configError ? (
            <div className="mb-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-800">
              <div className="font-medium">Firebase non configurato</div>
              <div className="text-xs text-slate-400 mt-1">{configError}</div>
              <button
                type="button"
                onClick={() => {
                  enterDemo();
                  navigate("/app/dashboard", { replace: true });
                }}
                className="mt-3 w-full rounded-xl bg-fuchsia-600 text-white font-medium py-2 text-sm hover:bg-fuchsia-500"
              >
                Entra in modalità demo
              </button>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </label>
            <button
              disabled={loading}
              className="w-full rounded-xl bg-fuchsia-600 text-white font-medium py-2 text-sm hover:bg-fuchsia-500 disabled:opacity-60"
              type="submit"
            >
              {loading ? "Attendi…" : title}
            </button>
          </form>

          {mode === "signin" && !configError ? (
            <div className="mt-3 text-sm">
              <button
                type="button"
                onClick={onResetPassword}
                disabled={resetBusy || loading}
                className="text-fuchsia-700 hover:text-fuchsia-800 disabled:opacity-60"
              >
                {resetBusy ? "Invio…" : "Password dimenticata?"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 text-xs text-slate-500">
            Le funzionalità AI sono solo informative e non sostituiscono il veterinario.
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

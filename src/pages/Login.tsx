import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { getFirebase, getFirebaseConfigError } from "@/lib/firebase";
import { HeartPulse, PawPrint, ShieldPlus, Shuffle, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { authUserMessage } from "@/lib/authErrors";
import { useToastStore } from "@/stores/toastStore";
import { Alert } from "@/components/ui/Alert";
import { APP_NAME } from "@/lib/brand";
import { getLocalFallbackImageFromSeed, getMarketingHeroImage } from "@/lib/marketingImages";
import { SmartImage } from "@/components/ui/SmartImage";

export default function Login() {
  const configError = getFirebaseConfigError();
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [touch, setTouch] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const pushToast = useToastStore((s) => s.push);
  const justSignedUpRef = useRef(false);

  const title = useMemo(() => (mode === "signin" ? "Accedi" : "Crea account"), [mode]);

  const fromPath = useMemo(() => {
    const anyState = location.state as
      | { from?: string | { pathname?: string; search?: string; hash?: string } }
      | null
      | undefined;
    const raw = anyState?.from;
    const p =
      typeof raw === "string"
        ? raw
        : typeof raw?.pathname === "string"
          ? `${raw.pathname}${raw.search || ""}${raw.hash || ""}`
          : undefined;
    return typeof p === "string" && p.startsWith("/app/") ? p : "/app/dashboard";
  }, [location.state]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (justSignedUpRef.current) return;
    navigate(fromPath, { replace: true });
  }, [fromPath, navigate, ready, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get("mode");
    if (m === "signup") setMode("signup");
    else if (m === "signin") setMode("signin");
  }, [location.search]);

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
        pushToast({ type: "success", title: "Login", message: "Accesso riuscito." });
        navigate(fromPath, { replace: true });
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        pushToast({ type: "success", title: "Account", message: "Creato." });
        justSignedUpRef.current = true;
        navigate("/onboarding", { replace: true, state: { from: fromPath } });
      }
    } catch (err) {
      setError(authUserMessage(err));
      pushToast({ type: "error", title: "Autenticazione", message: authUserMessage(err) });
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
      pushToast({ type: "success", title: "Reset password", message: "Email inviata (se l’account esiste)." });
    } catch (err) {
      setError(authUserMessage(err));
      pushToast({ type: "error", title: "Reset password", message: authUserMessage(err) });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "var(--lp-app-bg)",
        color: "rgb(var(--lp-ink))",
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-24 -left-24 w-96 h-96 blur-3xl rounded-full"
          style={{ backgroundColor: "rgba(var(--lp-accent-1),0.18)" }}
        />
        <div
          className="absolute top-20 -right-28 w-[520px] h-[520px] blur-3xl rounded-full"
          style={{ backgroundColor: "rgba(var(--lp-primary),0.20)" }}
        />
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative">
        <div className="lg:col-span-6 hidden lg:block">
          <div className="lp-card rounded-3xl p-6 overflow-hidden relative">
            <div className="relative">
              <div className="lp-surface overflow-hidden">
                <SmartImage
                  alt="Benessere animale"
                  className="h-44 w-full"
                  imgClassName="w-full h-full object-cover"
                  decoding="async"
                  loading="eager"
                  src={getMarketingHeroImage("login", touch)}
                  fallbackSrc={getLocalFallbackImageFromSeed("login")}
                  overlay={
                    <button
                      type="button"
                      className="absolute top-2 right-2 lp-btn-secondary px-2 py-1"
                      onClick={() => setTouch((x) => x + 1)}
                      aria-label="Cambia immagine"
                      title="Cambia immagine"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  }
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center lp-primary-soft">
                  <PawPrint className="w-6 h-6 lp-icon-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{APP_NAME}</div>
                  <div className="text-xs text-slate-600">Sicurezza, ritrovamento, documenti</div>
                </div>
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight leading-tight">
                Proteggi il tuo pet e tieni i documenti sempre disponibili.
              </div>
              <div className="mt-3 text-sm text-slate-700 leading-relaxed max-w-md">
                Attiva Pet Protetto (QR/ID), conserva documenti cloud e usa le funzioni esistenti per salute e routine.
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="lp-panel p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldPlus className="w-4 h-4 lp-icon-primary" />
                    Cartella clinica in ordine
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Timeline unica di eventi, log e documenti.</div>
                </div>
                <div className="lp-panel p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HeartPulse className="w-4 h-4 lp-icon-primary" />
                    Routine e promemoria
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Terapie, vaccini, idratazione e attività.</div>
                </div>
                <div className="lp-panel p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="w-4 h-4 lp-icon-primary" />
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
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
              <PawPrint className="w-5 h-5 lp-icon-primary" />
            </div>
            <div className="text-lg font-semibold">{APP_NAME}</div>
          </div>

          <div className="lp-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
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
                type="button"
                aria-label="Crea account"
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
            <div className="mb-3">
              <Alert variant="danger" title="Errore">{error}</Alert>
            </div>
          ) : null}

          {resetSent ? (
            <div className="mb-3">
              <Alert variant="success" title="Email inviata">Controlla la casella e lo spam.</Alert>
            </div>
          ) : null}

          <div className="mb-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-800">
            <div className="font-medium">Modalità demo</div>
            <div className="text-xs text-slate-600 mt-1">Prova l’app senza account e senza configurazione.</div>
            {configError ? <div className="text-xs text-slate-500 mt-1">Firebase non configurato: {configError}</div> : null}
            <button
              type="button"
              onClick={() => {
                enterDemo();
                navigate(fromPath, { replace: true });
              }}
              className="mt-3 w-full lp-btn-secondary"
            >
              Prova in demo
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="lp-input"
              />
            </label>
            <button
              disabled={loading}
              className="w-full lp-btn-primary"
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
                className="disabled:opacity-60"
                style={{ color: "rgb(var(--lp-primary-700))" }}
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

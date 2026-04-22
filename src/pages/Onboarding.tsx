import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FileText, FolderOpen, ListTodo, PawPrint, ShieldPlus, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { usePetCreateStore } from "@/stores/petCreateStore";
import {
  getOnboardingMeta,
  getOnboardingSteps,
  isOnboardingCompleted,
  markOnboardingStarted,
  markProtectionSeen,
  setOnboardingCompleted,
  setOnboardingGoal,
} from "@/lib/onboardingV2";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/telemetryClient";
import { usePetStore } from "@/stores/petStore";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
        <div>Progresso onboarding</div>
        <div>{percent}%</div>
      </div>
      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--lp-ink),0.10)" }}>
        <div
          className="h-full"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)",
          }}
        />
      </div>
    </div>
  );
}

function StepRow({
  done,
  icon: Icon,
  title,
  body,
}: {
  done: boolean;
  icon: typeof PawPrint;
  title: string;
  body: string;
}) {
  return (
    <div className={done ? "lp-panel p-4" : "lp-card p-4"}>
      <div className="flex items-start gap-3">
        <div className={done ? "w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft" : "w-10 h-10 rounded-2xl flex items-center justify-center lp-panel"}>
          <Icon className={done ? "w-5 h-5 lp-icon-primary" : "w-5 h-5"} style={!done ? { color: "rgb(var(--lp-muted))" } : undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{title}</div>
            {done ? (
              <div className="inline-flex items-center gap-1 text-xs lp-primary-soft px-2 py-1 rounded-full">
                <Check className="w-3.5 h-3.5 lp-icon-primary" />
                Fatto
              </div>
            ) : null}
          </div>
          <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>{body}</div>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);
  const pets = usePetStore((s) => s.pets);
  const openCreatePet = usePetCreateStore((s) => s.openDialog);
  const [screen, setScreen] = useState<0 | 1 | 2>(() => {
    try {
      const raw = localStorage.getItem("lifepet:onboardingScreen:v3");
      const n = raw ? Number(raw) : 0;
      return n === 1 || n === 2 ? n : 0;
    } catch {
      return 0;
    }
  });
  const [steps, setSteps] = useState(() => (typeof window === "undefined" ? getOnboardingSteps() : getOnboardingSteps()));
  const [meta, setMeta] = useState(() => (typeof window === "undefined" ? getOnboardingMeta() : getOnboardingMeta()));

  useEffect(() => {
    function onChange() {
      setSteps(getOnboardingSteps());
      setMeta(getOnboardingMeta());
    }
    window.addEventListener("lifepet:onboarding", onChange);
    return () => window.removeEventListener("lifepet:onboarding", onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lifepet:onboardingScreen:v3", String(screen));
    } catch {
      return;
    }
  }, [screen]);

  useEffect(() => {
    markOnboardingStarted();
    void trackEvent({ uid: user?.uid, profile, event: "onboarding_started", route: "/onboarding", minIntervalMs: 86_400_000 });
  }, [profile, user?.uid]);

  const from = (() => {
    const raw = (location.state as { from?: unknown } | null)?.from;
    if (typeof raw === "string" && raw.startsWith("/")) return raw;
    const loc = raw as { pathname?: unknown; search?: unknown; hash?: unknown } | null;
    const pathname = typeof loc?.pathname === "string" ? loc.pathname : "";
    const search = typeof loc?.search === "string" ? loc.search : "";
    const hash = typeof loc?.hash === "string" ? loc.hash : "";
    const path = `${pathname}${search}${hash}`;
    return path.startsWith("/") ? path : null;
  })();

  const protectionEnabled = useMemo(() => {
    return pets.some((p) => Boolean(p.petProtection?.enabled && p.petProtection.publicId));
  }, [pets]);
  const protectionSeen = Boolean(meta.protectionSeenAt || protectionEnabled);

  const progress = useMemo(() => {
    const done = [steps.petCreated, protectionSeen, steps.docOrVaccineAdded, steps.reminderCreated].filter(Boolean).length;
    return Math.round((done / 4) * 100);
  }, [protectionSeen, steps.docOrVaccineAdded, steps.petCreated, steps.reminderCreated]);

  const allDone = steps.petCreated && steps.docOrVaccineAdded && steps.reminderCreated && protectionSeen;

  function onSkip() {
    setOnboardingCompleted();
    void trackEvent({ uid: user?.uid, profile, event: "onboarding_skipped", route: "/onboarding" });
    navigate(from ?? "/app/dashboard", { replace: true });
  }

  function goNext() {
    setScreen((s) => {
      if (s === 1 && !meta.goal) setOnboardingGoal("protection");
      return s === 2 ? 2 : ((s + 1) as 0 | 1 | 2);
    });
  }

  function goBack() {
    setScreen((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1 | 2)));
  }

  const title =
    screen === 0
      ? "Benvenuto in PetLyon"
      : screen === 1
        ? "Da cosa vuoi partire?"
        : "Setup guidato (4 step)";

  if (typeof window !== "undefined" && isOnboardingCompleted()) return <Navigate to={from ?? "/app/dashboard"} replace />;

  return (
    <div className="min-h-screen" style={{ background: "var(--lp-app-bg)", color: "rgb(var(--lp-ink))" }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 blur-3xl rounded-full" style={{ backgroundColor: "rgba(var(--lp-primary),0.18)" }} />
        <div className="absolute top-24 -right-28 w-[560px] h-[560px] blur-3xl rounded-full" style={{ backgroundColor: "rgba(var(--lp-accent-1),0.16)" }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
              <Target className="w-5 h-5 lp-icon-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Onboarding</div>
              <div className="text-xs lp-muted">Schermata {screen + 1} di 3</div>
            </div>
          </div>
          <button type="button" onClick={onSkip} className="lp-btn-secondary">Salta</button>
        </div>

        <Card className="mt-6 overflow-hidden">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {screen === 0
                ? "Valore in meno di 30 secondi. Poi ti guidiamo: 1 pet, 1 documento, 1 promemoria, protezione pronta."
                : screen === 1
                  ? "Scegline uno: personalizziamo il percorso senza complicarti la vita."
                  : "Completa i 4 step per ottenere sicurezza, prontezza e routine in pochi minuti."
              }
            </CardDescription>
            {screen === 2 ? <ProgressBar percent={progress} /> : null}
          </CardHeader>
          <CardContent>
            {screen === 0 ? (
              <div className="space-y-3">
                <div className="lp-panel p-4">
                  <div className="text-sm font-semibold">Protezione e prontezza, in un’unica app</div>
                  <div className="text-xs lp-muted mt-1">Documenti, salute, routine e modalità smarrito: tutto pronto quando serve davvero.</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="lp-card p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold"><ShieldPlus className="w-4 h-4 lp-icon-primary" />Protezione smarrimento</div>
                    <div className="text-xs lp-muted mt-1">Link/QR pronti e segnalazioni in caso di ritrovamento.</div>
                  </div>
                  <div className="lp-card p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="w-4 h-4 lp-icon-primary" />Documenti essenziali</div>
                    <div className="text-xs lp-muted mt-1">Referti, ricette, microchip e vaccini sempre disponibili.</div>
                  </div>
                  <div className="lp-card p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold"><ListTodo className="w-4 h-4 lp-icon-primary" />Promemoria</div>
                    <div className="text-xs lp-muted mt-1">Routine semplice: visite, farmaci e scadenze senza stress.</div>
                  </div>
                </div>
              </div>
            ) : null}

            {screen === 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[{
                  id: "protection" as const,
                  title: "Protezione smarrimento (consigliato)",
                  body: "Prepari link/QR e pagina pubblica essenziale.",
                  icon: ShieldPlus,
                }, {
                  id: "documents" as const,
                  title: "Documenti & salute",
                  body: "Carichi un documento o aggiungi un vaccino/evento.",
                  icon: FileText,
                }, {
                  id: "routine" as const,
                  title: "Routine & promemoria",
                  body: "Imposti un promemoria semplice e utile.",
                  icon: ListTodo,
                }].map((x) => {
                  const Icon = x.icon;
                  const selected = meta.goal ? meta.goal === x.id : x.id === "protection";
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => {
                        setOnboardingGoal(x.id);
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_goal_selected", route: "/onboarding", props: { goal: x.id } });
                      }}
                      className={selected ? "lp-panel p-4 text-left" : "lp-card p-4 text-left"}
                      style={selected ? { border: "1px solid rgba(var(--lp-primary),0.35)" } : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <div className={selected ? "w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft" : "w-10 h-10 rounded-2xl flex items-center justify-center lp-panel"}>
                          <Icon className={selected ? "w-5 h-5 lp-icon-primary" : "w-5 h-5"} style={!selected ? { color: "rgb(var(--lp-muted))" } : undefined} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{x.title}</div>
                          <div className="text-xs lp-muted mt-1">{x.body}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="md:col-span-3 flex flex-col sm:flex-row gap-2 mt-2">
                  <button type="button" className="lp-btn-primary" onClick={() => {
                    if (!meta.goal) setOnboardingGoal("protection");
                    setScreen(2);
                  }}>Continua</button>
                  <button type="button" className="lp-btn-secondary" onClick={() => {
                    setOnboardingGoal("protection");
                    setScreen(2);
                  }}>Decido dopo</button>
                </div>
              </div>
            ) : null}

            {screen === 2 ? (
              <div className="space-y-3">
                <StepRow
                  done={steps.petCreated}
                  icon={PawPrint}
                  title="Step 1 · Crea il tuo pet"
                  body="Nome e specie. La foto è consigliata ma puoi aggiungerla dopo."
                />
                <StepRow
                  done={protectionSeen}
                  icon={ShieldPlus}
                  title="Step 2 · Protezione smarrimento"
                  body="Apri Protezione per vedere QR/link e attivare la scheda pubblica essenziale."
                />
                <StepRow
                  done={steps.docOrVaccineAdded}
                  icon={FolderOpen}
                  title="Step 3 · Carica 1 documento (o aggiungi vaccino)"
                  body="Basta un documento essenziale per essere pronti in visita o emergenza."
                />
                <StepRow
                  done={steps.reminderCreated}
                  icon={ListTodo}
                  title="Step 4 · Imposta 1 promemoria"
                  body="Un task o un evento in agenda: ti evita dimenticanze su routine e scadenze."
                />

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  {!steps.petCreated ? (
                    <button
                      type="button"
                      className="lp-btn-primary"
                      onClick={() => {
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_step_cta", route: "/onboarding", props: { step: "pet" } });
                        openCreatePet();
                        navigate("/app/pets");
                      }}
                    >
                      Crea pet
                    </button>
                  ) : null}

                  {steps.petCreated && !protectionSeen ? (
                    <button
                      type="button"
                      className="lp-btn-primary"
                      onClick={() => {
                        markProtectionSeen();
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_step_cta", route: "/onboarding", props: { step: "protection" } });
                        navigate("/app/protection");
                      }}
                    >
                      Apri protezione
                    </button>
                  ) : null}

                  {steps.petCreated && protectionSeen && !steps.docOrVaccineAdded ? (
                    <>
                      <button type="button" className="lp-btn-primary" onClick={() => {
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_step_cta", route: "/onboarding", props: { step: "documents" } });
                        navigate("/app/documents");
                      }}>Carica documento</button>
                      <button type="button" className="lp-btn-secondary" onClick={() => {
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_step_cta", route: "/onboarding", props: { step: "vaccines" } });
                        navigate("/app/vaccines");
                      }}>Aggiungi vaccino</button>
                    </>
                  ) : null}

                  {steps.petCreated && protectionSeen && steps.docOrVaccineAdded && !steps.reminderCreated ? (
                    <button type="button" className="lp-btn-primary" onClick={() => {
                      void trackEvent({ uid: user?.uid, profile, event: "onboarding_step_cta", route: "/onboarding", props: { step: "reminder" } });
                      navigate("/app/planner");
                    }}>Crea promemoria</button>
                  ) : null}

                  {allDone ? (
                    <button
                      type="button"
                      className="lp-btn-primary"
                      onClick={() => {
                        setOnboardingCompleted();
                        void trackEvent({ uid: user?.uid, profile, event: "onboarding_completed", route: "/onboarding" });
                        navigate(from ?? "/app/dashboard", { replace: true });
                      }}
                    >
                      Completa onboarding
                    </button>
                  ) : null}
                </div>

                {!allDone ? (
                  <div className="text-xs mt-2" style={{ color: "rgb(var(--lp-muted))" }}>
                    Puoi saltare in qualsiasi momento. Ti consiglio però questi step: sono quelli che ti danno valore immediato.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" className="lp-btn-secondary inline-flex items-center gap-2" onClick={goBack} disabled={screen === 0}>
                <ArrowLeft className="w-4 h-4" />Indietro
              </button>
              <button type="button" className="lp-btn-primary inline-flex items-center gap-2" onClick={goNext} disabled={screen === 2}>
                Avanti<ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

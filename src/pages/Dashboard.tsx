import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Cpu, FileText, PawPrint, ShieldPlus } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { usePetCreateStore } from "@/stores/petCreateStore";
import { subscribeUpcomingAgenda } from "@/data/agenda";
import { subscribeDocuments } from "@/data/documents";
import { subscribeTasks } from "@/data/tasks";
import { subscribeLogsRange } from "@/data/logs";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeVaccines } from "@/data/vaccines";
import { computePetStatus, statusClass, statusEmoji, statusLabel } from "@/lib/petStatus";
import { getOnboardingProgressPercent, getOnboardingSteps, isOnboardingCompleted } from "@/lib/onboardingV2";
import type { AgendaEvent, HealthEvent, PetDocument, PetLog, PetTask, PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LaunchChecklistCard } from "@/components/dashboard/LaunchChecklistCard";
import { uxCopy } from "@/lib/uxCopy";

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDay(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const openCreatePet = usePetCreateStore((s) => s.openDialog);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? pets[0] ?? null, [activePetId, pets]);

  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);

  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [vaccines, setVaccines] = useState<PetVaccine[]>([]);

  const [onboardingSteps, setOnboardingSteps] = useState(() => getOnboardingSteps());
  const onboardingPercent = useMemo(() => getOnboardingProgressPercent(onboardingSteps), [onboardingSteps]);
  const [onboardingDone, setOnboardingDone] = useState(() => (typeof window !== "undefined" ? isOnboardingCompleted() : false));

  useEffect(() => {
    function onChange() {
      setOnboardingSteps(getOnboardingSteps());
      setOnboardingDone(isOnboardingCompleted());
    }
    window.addEventListener("lifepet:onboarding", onChange);
    return () => window.removeEventListener("lifepet:onboarding", onChange);
  }, []);

  useEffect(() => {
    if (!activePet?.id) {
      setAgenda([]);
      return;
    }
    const unsub = subscribeUpcomingAgenda(activePet.id, Date.now(), 30, setAgenda);
    return () => unsub();
  }, [activePet?.id]);

  useEffect(() => {
    if (!activePet?.id) {
      setDocs([]);
      return;
    }
    const unsub = subscribeDocuments(activePet.id, setDocs);
    return () => unsub();
  }, [activePet?.id]);

  useEffect(() => {
    if (!activePet?.id || !user) {
      setTasks([]);
      return;
    }
    const unsub = subscribeTasks(activePet.id, user.uid, setTasks);
    return () => unsub();
  }, [activePet?.id, user]);

  useEffect(() => {
    if (!activePet?.id || !user) {
      setLogs30d([]);
      return;
    }
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    const unsub = subscribeLogsRange(activePet.id, user.uid, fromMs, toMs, setLogs30d);
    return () => unsub();
  }, [activePet?.id, user]);

  useEffect(() => {
    if (!activePet?.id || !user) {
      setHealthEvents([]);
      return;
    }
    const unsub = subscribeRecentHealthEvents(activePet.id, user.uid, 30, setHealthEvents);
    return () => unsub();
  }, [activePet?.id, user]);

  useEffect(() => {
    if (!activePet?.id) {
      setVaccines([]);
      return;
    }
    const unsub = subscribeVaccines(activePet.id, setVaccines);
    return () => unsub();
  }, [activePet?.id]);

  const petStatus = useMemo(() => {
    return computePetStatus({
      pet: activePet,
      logs30d,
      tasks,
      healthEvents,
      vaccines,
      nowMs: Date.now(),
    });
  }, [activePet, healthEvents, logs30d, tasks, vaccines]);

  const todayStart = useMemo(() => startOfDay(Date.now()), []);
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

  const upcomingWeek = useMemo(() => {
    const now = Date.now();
    const end = now + 7 * 24 * 60 * 60 * 1000;
    return agenda.filter((e) => e.dueAt >= now && e.dueAt <= end).slice(0, 8);
  }, [agenda]);

  const dueSoonTasks = useMemo(() => {
    const now = Date.now();
    const end = now + 7 * 24 * 60 * 60 * 1000;
    return tasks
      .filter((t) => t.status === "due")
      .filter((t) => (t.dueAt ?? end + 1) <= end)
      .slice()
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      .slice(0, 6);
  }, [tasks]);

  const nextDocs = useMemo(() => docs.slice(0, 3), [docs]);

  const healthSummary = useMemo(() => {
    const now = Date.now();
    const nextVax = vaccines.length ? vaccines[0] : null;
    const lastEvent = healthEvents.length ? healthEvents[0] : null;
    const hasMicrochipDoc = docs.some((d) => (d.tags || []).some((t) => t.toLowerCase().includes("microchip")) || (d.title || "").toLowerCase().includes("microchip"));
    const nextDueLabel =
      nextVax && nextVax.nextDueAt
        ? nextVax.nextDueAt < now
          ? `Scaduto: ${nextVax.name}`
          : `Prossimo: ${nextVax.name}`
        : "Nessuna scadenza impostata";
    const nextDueWhen = nextVax ? fmtDay(nextVax.nextDueAt) : "";
    const lastEventLabel = lastEvent ? `${lastEvent.title} · ${fmtDay(lastEvent.occurredAt)}` : "Nessun evento recente";
    const suggestion = !docs.length ? "Carica un documento essenziale (vaccino, microchip o referto)." : !hasMicrochipDoc ? "Suggerimento: carica/etichetta il microchip per emergenza." : "Tutto in ordine: continua con routine e scadenze.";
    return { nextDueLabel, nextDueWhen, lastEventLabel, suggestion };
  }, [docs, healthEvents, vaccines]);

  const headerActions = useMemo(() => {
    if (!activePet) return null;
    if (!onboardingSteps.docOrVaccineAdded) {
      return (
        <>
          <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/vaccines")}>Aggiungi vaccino</button>
          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
        </>
      );
    }
    if (!onboardingSteps.reminderCreated) {
      return (
        <>
          <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/planner")}>Crea promemoria</button>
          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/agenda")}>Apri agenda</button>
        </>
      );
    }
    if (petStatus.metrics.overdueVaccines > 0) {
      return (
        <>
          <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/vaccines")}>Aggiorna vaccini</button>
          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}>Crea promemoria</button>
        </>
      );
    }
    if (dueSoonTasks.length > 0) {
      return (
        <>
          <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/notifications")}>Vedi promemoria</button>
          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}>Apri planner</button>
        </>
      );
    }
    if (docs.length === 0) {
      return (
        <>
          <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
          <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/vaccines")}>Aggiorna vaccini</button>
        </>
      );
    }
    return (
      <>
        <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/status")}>Stato salute</button>
        <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/records")}>Cartella clinica</button>
      </>
    );
  }, [activePet, docs.length, dueSoonTasks.length, navigate, onboardingSteps.docOrVaccineAdded, onboardingSteps.reminderCreated, petStatus.metrics.overdueVaccines]);

  if (!activePet) {
    return (
      <div className="space-y-6">
        <PageHeader title={uxCopy.dashboard.headerTitle} description={uxCopy.dashboard.noPetHeaderDescription} imageAlt="Dashboard" />
        <EmptyState
          icon={PawPrint}
          title={uxCopy.dashboard.noPetTitle}
          description={uxCopy.dashboard.noPetDescription}
          action={<button type="button" className="lp-btn-primary" onClick={openCreatePet}>{uxCopy.common.cta.createPet}</button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Pet attivo: ${activePet.name}. Qui vedi cosa conta oggi e nei prossimi 7 giorni.`}
        imagePrompt="minimal clean illustration, pet dashboard cards, calendar and document thumbnails, premium, airy background, no text"
        imageAlt="Dashboard"
        actions={headerActions}
        actionsClassName="justify-start md:justify-end"
      />

      {!onboardingDone ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Setup iniziale</div>
                <div className="text-xs lp-muted mt-1">
                  {onboardingPercent < 100 ? "Completa i passaggi base per ottenere valore subito." : "Hai completato gli step: conferma e chiudi l’onboarding."}
                </div>
              </div>
              <button type="button" className="lp-btn-primary" onClick={() => navigate("/onboarding")}>
                {onboardingPercent < 100 ? "Continua" : "Concludi"}
              </button>
            </div>
            {onboardingPercent < 100 ? (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  <div>Progresso</div>
                  <div>{onboardingPercent}%</div>
                </div>
                <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--lp-ink),0.10)" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${onboardingPercent}%`,
                      background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)",
                    }}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <LaunchChecklistCard pet={activePet} docs={docs} vaccines={vaccines} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Stato salute</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(petStatus.overall)}`}>
              <span>{statusEmoji(petStatus.overall)}</span>
              {statusLabel(petStatus.overall)}
            </div>
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{petStatus.score}/100</div>
          </div>
          <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Basato su log, task, vaccini e salute.</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Prossimi 7 giorni</div>
          <div className="mt-2 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{upcomingWeek.length + dueSoonTasks.length}</div>
          <div className="mt-1 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Eventi agenda + promemoria.</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Documenti</div>
          <div className="mt-2 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{docs.length}</div>
          <div className="mt-1 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>{docs.length ? "Ultimo: " + fmtDay(docs[0].createdAt) : "Nessun file ancora"}</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Vaccini</div>
          <div className="mt-2 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{petStatus.metrics.overdueVaccines}</div>
          <div className="mt-1 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Scaduti o in ritardo.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PawPrint className="w-4 h-4" />Profilo pet</CardTitle>
            <CardDescription>Completa i dati essenziali per sicurezza e utilità.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link className="lp-btn-primary" to="/app/pets">Apri profilo</Link>
              <Link className="lp-btn-secondary" to="/app/documents">Documenti</Link>
              <Link className="lp-btn-secondary" to="/app/vaccines">Vaccini</Link>
            </div>
            <div className="mt-3 text-xs lp-muted">Suggerimento: microchip, note importanti e contatto veterinario.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" />Salute & documenti</CardTitle>
            <CardDescription>Scadenze e ultimi eventi a colpo d’occhio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Vaccini</div>
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{healthSummary.nextDueLabel}</div>
                {healthSummary.nextDueWhen ? <div className="text-xs lp-muted mt-1">{healthSummary.nextDueWhen}</div> : null}
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Ultimo evento</div>
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{healthSummary.lastEventLabel}</div>
              </div>
              <div className="text-xs lp-muted">{healthSummary.suggestion}</div>
              <div className="flex flex-wrap gap-2">
                <Link className="lp-btn-primary" to="/app/health">Apri salute</Link>
                <Link className="lp-btn-secondary" to="/app/documents">Carica documento</Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldPlus className="w-4 h-4" />Sicurezza</CardTitle>
            <CardDescription>QR + ID e scheda pubblica per ritrovamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link className="lp-btn-primary" to="/app/pets">Pet Protetto</Link>
              <Link className="lp-btn-secondary" to="/app/records">Cartella clinica</Link>
            </div>
            <div className="mt-3 text-xs lp-muted">In caso di smarrimento, chi ti trova può inviare una segnalazione.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="w-4 h-4" />Oggi</CardTitle>
            <CardDescription>Promemoria e agenda a colpo d’occhio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link className="lp-btn-primary" to="/app/notifications">Notifiche</Link>
              <Link className="lp-btn-secondary" to="/app/planner">Planner</Link>
              <Link className="lp-btn-secondary" to="/app/agenda">Agenda</Link>
            </div>
            <div className="mt-3 text-xs lp-muted">Se qualcosa è urgente, lo trovi qui prima di tutto.</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Reparto Farm
          </CardTitle>
          <CardDescription>Dispositivi, telemetria, alert, mandrie, recinti digitali, import CSV e diagnostica ingest.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
              <Link className="lp-btn-primary" to="/app/farm">Apri reparto Farm</Link>
              <Link className="lp-btn-secondary" to="/app/farm/subjects">Animali</Link>
              <Link className="lp-btn-secondary" to="/app/farm/devices">Dispositivi</Link>
              <Link className="lp-btn-secondary" to="/app/farm/alerts">Alert</Link>
              <Link className="lp-btn-secondary" to="/app/farm/herds">Mandrie</Link>
              <Link className="lp-btn-secondary" to="/app/farm/geofences">Recinti</Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Tecnologia (Pet)
          </CardTitle>
          <CardDescription>Dispositivi e alert per animali domestici.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link className="lp-btn-primary" to="/app/tech">Apri tecnologia</Link>
            <Link className="lp-btn-secondary" to="/app/tech/devices">Dispositivi</Link>
            <Link className="lp-btn-secondary" to="/app/tech/alerts">Alert</Link>
            <Link className="lp-btn-secondary" to="/app/tech/integrations">Integrazioni</Link>
            <Link className="lp-btn-secondary" to="/app/tech/diagnostics">Diagnostica</Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prossimi eventi</CardTitle>
              <CardDescription>Oggi e questa settimana.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingWeek.length === 0 && dueSoonTasks.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title={uxCopy.dashboard.emptyEventsTitle}
                  description={uxCopy.dashboard.emptyEventsDescription}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Link className="lp-btn-primary" to="/app/agenda">Apri agenda</Link>
                      <Link className="lp-btn-secondary" to="/app/planner">Apri planner</Link>
                    </div>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {upcomingWeek.map((e) => {
                    const isToday = e.dueAt >= todayStart && e.dueAt <= todayEnd;
                    return (
                      <div key={e.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{e.title}</div>
                          <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>{isToday ? "Oggi" : fmtDay(e.dueAt)}</div>
                        </div>
                        <Link to="/app/agenda" className="lp-btn-secondary">Apri</Link>
                      </div>
                    );
                  })}
                  {dueSoonTasks.map((t) => {
                    const when = typeof t.dueAt === "number" ? t.dueAt : null;
                    const isToday = when ? when >= todayStart && when <= todayEnd : false;
                    return (
                      <div key={t.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{t.title}</div>
                          <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>{when ? (isToday ? "Oggi" : fmtDay(when)) : "Senza data"}</div>
                        </div>
                        <Link to="/app/planner" className="lp-btn-secondary">Apri</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultimi documenti</CardTitle>
              <CardDescription>Accesso rapido ai file recenti.</CardDescription>
            </CardHeader>
            <CardContent>
              {nextDocs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={uxCopy.dashboard.emptyDocsTitle}
                  description={uxCopy.dashboard.emptyDocsDescription}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/vaccines")}>Aggiungi vaccino</button>
                      <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}>Crea promemoria</button>
                      <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
                    </div>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {nextDocs.map((d) => (
                    <div key={d.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{d.title || d.name}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>{fmtDay(d.createdAt)}</div>
                      </div>
                      <Link to="/app/documents" className="lp-btn-secondary">Apri</Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consiglio del giorno</CardTitle>
              <CardDescription>Un passo piccolo che migliora prevenzione e routine.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="lp-panel p-3">
                <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>{petStatus.suggestions[0] ?? ""}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/status")}>Apri dettagli</button>
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/records")}>Cartella clinica</button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stato animale</CardTitle>
              <CardDescription>Ok oppure da aggiornare.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(petStatus.overall)}`}>
                    <span>{statusEmoji(petStatus.overall)}</span>
                    {statusLabel(petStatus.overall)}
                  </div>
                  <div className="mt-2 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Basato su log, task, salute e vaccini recenti.</div>
                </div>
                <Link to="/app/status" className="lp-btn-secondary">Dettagli</Link>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <button type="button" className="lp-btn-secondary w-full" onClick={() => navigate("/app/vaccines")}>Aggiorna vaccini</button>
                <button type="button" className="lp-btn-secondary w-full" onClick={() => navigate("/app/planner")}>Crea promemoria</button>
                {docs.length === 0 ? (
                  <button type="button" className="lp-btn-secondary w-full" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
                ) : (
                  <button type="button" className="lp-btn-secondary w-full" onClick={() => navigate("/app/records?share=1")}>Condividi cartella</button>
                )}
              </div>

              <div className="mt-4 lp-panel p-3">
                <div className="text-xs lp-muted">Fiducia & sicurezza</div>
                <div className="mt-1 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>Dati protetti e salvati in cloud.</div>
                <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Backup automatico e accesso sicuro con account.</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Azioni rapide</CardTitle>
              <CardDescription>Solo scorciatoie utili.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center justify-center gap-2"><PawPrint className="w-4 h-4" />Profilo</Link>
                <Link to="/app/records" className="lp-btn-secondary inline-flex items-center justify-center gap-2"><ShieldPlus className="w-4 h-4" />Timeline</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

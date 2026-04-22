import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Droplets, Footprints, HeartPulse, ShieldAlert, Sparkles, Weight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { subscribeLogsRange } from "@/data/logs";
import { createTask, subscribeTasks } from "@/data/tasks";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeLatestGpsPoint } from "@/data/gps";
import { subscribeMedications } from "@/data/medications";
import { subscribeVaccines } from "@/data/vaccines";
import { subscribeHealthScoresRange } from "@/data/healthScores";
import { subscribeUserProfile } from "@/data/users";
import type { GpsPoint, HealthEvent, PetLog, PetMedication, PetTask, PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeLongevitySnapshot } from "@/lib/longevity";
import { computePetStatus, statusClass, statusEmoji, statusLabel } from "@/lib/petStatus";
import { useAiPanelStore } from "@/stores/aiPanelStore";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function simpleSpark(values: number[]) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 140;
  const h = 36;
  const step = w / (values.length - 1);
  const d = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return { d, w, h };
}

export default function Status() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const pushToast = useToastStore((s) => s.push);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);

  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [gpsLatest, setGpsLatest] = useState<GpsPoint | null>(null);
  const [meds, setMeds] = useState<PetMedication[]>([]);
  const [vaccines, setVaccines] = useState<PetVaccine[]>([]);
  const [scores, setScores] = useState<number[]>([]);

  const [aiAllowed, setAiAllowed] = useState(true);
  const [creatingFromSuggestion, setCreatingFromSuggestion] = useState<string | null>(null);

  const range = useMemo(() => {
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    const from7d = toMs - 7 * 24 * 60 * 60 * 1000;
    const from24h = toMs - 24 * 60 * 60 * 1000;
    const from72h = toMs - 72 * 60 * 60 * 1000;
    return { fromMs, toMs, from7d, from24h, from72h };
  }, []);

  useEffect(() => {
    if (!activePetId || !user) return;
    const unsub = subscribeLogsRange(activePetId, user.uid, range.fromMs, range.toMs, setLogs30d);
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs, user]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const unsub = subscribeTasks(activePetId, user.uid, setTasks);
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!user || user.isDemo) {
      setAiAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setAiAllowed(p?.preferences?.aiEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!activePetId) return;
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    const unsub = subscribeHealthScoresRange(activePetId, fromMs, toMs, 40, (items) => {
      setScores(items.map((i) => i.score));
    });
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const unsub = subscribeRecentHealthEvents(activePetId, user.uid, 30, setHealthEvents);
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeLatestGpsPoint(activePetId, setGpsLatest);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeMedications(activePetId, setMeds);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeVaccines(activePetId, setVaccines);
    return () => unsub();
  }, [activePetId]);

  const computed = useMemo(() => {
    const now = Date.now();
    const status = computePetStatus({
      pet: activePet,
      logs30d,
      tasks,
      healthEvents,
      vaccines,
      nowMs: now,
    });

    const weights = logs30d
      .filter((l) => l.type === "weight")
      .map((l) => (typeof l.value?.amount === "number" ? l.value.amount : null))
      .filter((x): x is number => x !== null && Number.isFinite(x) && x > 0)
      .slice(-14);

    const activityByDay = new Map<string, number>();
    const waterByDay = new Map<string, number>();
    for (const l of logs30d) {
      const k = ymd(new Date(l.occurredAt));
      if (l.type === "activity") activityByDay.set(k, (activityByDay.get(k) ?? 0) + 1);
      if (l.type === "water") waterByDay.set(k, (waterByDay.get(k) ?? 0) + 1);
    }
    const last7Keys = Array.from({ length: 7 }).map((_, i) => ymd(new Date(now - (6 - i) * 24 * 60 * 60 * 1000)));
    const activitySeries = last7Keys.map((k) => activityByDay.get(k) ?? 0);
    const waterSeries = last7Keys.map((k) => waterByDay.get(k) ?? 0);

    return {
      ...status,
      charts: {
        scoreSpark: simpleSpark(scores.slice(-14)),
        weightSpark: simpleSpark(weights),
        activitySpark: simpleSpark(activitySeries),
        waterSpark: simpleSpark(waterSeries),
      },
    };
  }, [activePet, healthEvents, logs30d, scores, tasks, vaccines]);

  const longevity = useMemo(() => {
    if (!activePet) return null;
    return computeLongevitySnapshot({ pet: activePet, logs30d, tasks, nowMs: Date.now() });
  }, [activePet, logs30d, tasks]);

  const nextVaccine = useMemo(() => vaccines[0] ?? null, [vaccines]);
  const activeMeds = useMemo(() => meds.filter((m) => m.enabled).length, [meds]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stato animale"
        description="Sintesi salute, trend e suggerimenti smart."
        imagePrompt="minimal clean illustration, health score gauge with paw icon and trend line, airy background, accent color, premium, no text, no watermark"
        imageAlt="Stato animale"
        actions={
          <>
            <button
              type="button"
              className="lp-btn-secondary inline-flex items-center gap-2"
              onClick={() => {
                if (!activePetId || !activePet) return;
                if (!aiAllowed) {
                  pushToast({ type: "info", title: "AI", message: "AI disattivata: riattivala in Impostazioni → Preferenze." });
                  return;
                }
                openWithDraft(
                  `Pet: ${activePet.name}. Interpreta lo stato e proponi prossimi passi: 1) cosa monitorare 24-48h 2) 3 task pratici nel planner 3) segnali di allarme. Dati: score ${computed.score}/100, sintomi30g=${computed.metrics.symptom30d}, acqua24h=${computed.metrics.water24h}, attività7g=${computed.metrics.activity7d}. Suggerimenti: ${computed.suggestions.join(" | ")}.`
                );
              }}
              disabled={!activePetId || !activePet}
            >
              <Sparkles className="w-4 h-4" />
              AI riepilogo
            </button>
            <Link to="/app/health" className="lp-btn-secondary inline-flex items-center gap-2">
              Apri Salute
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        }
      />

      {!activePetId ? (
        <EmptyState
          title="Seleziona un pet"
          description="Scegli un profilo per vedere indicatori, trend e suggerimenti."
          action={
            <Link
              to="/app/pets"
              className="lp-btn-secondary"
            >
              Vai al profilo pet
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm lp-muted">Pet</div>
                <div className="text-lg font-semibold">{activePet?.name ?? "—"}</div>
                <div className="text-xs lp-muted">{activePet?.species ?? "—"}{activePet?.breed ? ` · ${activePet.breed}` : ""}</div>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${statusClass(computed.overall)}`}>
                <span className="text-sm">{statusEmoji(computed.overall)}</span>
                {statusLabel(computed.overall)}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="lp-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs lp-muted">Alimentazione</div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(computed.food)}`}>
                    <span>{statusEmoji(computed.food)}</span>
                    {statusLabel(computed.food)}
                  </div>
                </div>
                <div className="mt-1 text-sm">Log 24h: {computed.metrics.food24h} · 7g: {computed.metrics.food7d}</div>
              </div>

              <div className="lp-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs lp-muted">Attività</div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(computed.activity)}`}>
                    <span>{statusEmoji(computed.activity)}</span>
                    {statusLabel(computed.activity)}
                  </div>
                </div>
                <div className="mt-1 text-sm">Log 7g: {computed.metrics.activity7d}</div>
              </div>

              <div className="lp-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs lp-muted">Storico salute</div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(computed.health)}`}>
                    <span>{statusEmoji(computed.health)}</span>
                    {statusLabel(computed.health)}
                  </div>
                </div>
                <div className="mt-1 text-sm">
                  Sintomi 30g: {computed.metrics.symptom30d}
                  {computed.metrics.overdueVaccines ? ` · Vaccini in ritardo: ${computed.metrics.overdueVaccines}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 lp-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">Indice salute (0–100)</div>
                  <HeartPulse className="w-4 h-4 text-slate-600" />
                </div>
                <div className="mt-2 text-3xl font-semibold">{computed.score}</div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full"
                    style={{ backgroundColor: "rgb(var(--lp-primary))", width: `${computed.score}%` }}
                  />
                </div>
              </div>

              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Trend indice (14d)</div>
                    <Activity className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{scores.length ? "Disponibile" : "Nessun dato"}</div>
                  {computed.charts.scoreSpark ? (
                    <svg width={computed.charts.scoreSpark.w} height={computed.charts.scoreSpark.h} className="mt-2">
                      <path d={computed.charts.scoreSpark.d} fill="none" stroke="rgb(var(--lp-primary))" strokeWidth="2" />
                    </svg>
                  ) : null}
                </div>

                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Idratazione (24h)</div>
                    <Droplets className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.water24h > 0 ? "OK" : "Mancante"}</div>
                  {computed.charts.waterSpark ? (
                    <svg width={computed.charts.waterSpark.w} height={computed.charts.waterSpark.h} className="mt-2">
                      <path d={computed.charts.waterSpark.d} fill="none" stroke="rgb(var(--lp-primary))" strokeWidth="2" />
                    </svg>
                  ) : null}
                </div>

                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Attività (7d)</div>
                    <Footprints className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.activity7d} log</div>
                  {computed.charts.activitySpark ? (
                    <svg width={computed.charts.activitySpark.w} height={computed.charts.activitySpark.h} className="mt-2">
                      <path d={computed.charts.activitySpark.d} fill="none" stroke="rgb(var(--lp-primary))" strokeWidth="2" />
                    </svg>
                  ) : null}
                </div>

                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Peso (30d)</div>
                    <Weight className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.weight30d} log</div>
                  {computed.charts.weightSpark ? (
                    <svg width={computed.charts.weightSpark.w} height={computed.charts.weightSpark.h} className="mt-2">
                      <path d={computed.charts.weightSpark.d} fill="none" stroke="rgb(var(--lp-primary))" strokeWidth="2" />
                    </svg>
                  ) : null}
                </div>

                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Longevità</div>
                    <Sparkles className="w-4 h-4 text-slate-600" />
                  </div>
                  {longevity ? (
                    <>
                      <div className="mt-1 text-sm font-semibold">{longevity.longevityScore}/100</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {longevity.remainingScore === null
                          ? `Aspettativa ~${longevity.expectancyScore}/100`
                          : `Residuo ~${longevity.remainingScore}/100`}
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-2" style={{ width: `${longevity.longevityScore}%`, backgroundColor: "rgb(var(--lp-primary))" }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 text-sm font-medium">Aggiungi data nascita</div>
                      <div className="mt-1 text-xs text-slate-600">Per stimare età e aspettativa.</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 lp-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Suggerimenti</div>
                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <Activity className="w-4 h-4" />
                  Ultimi 30 giorni
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {computed.suggestions.length ? (
                  computed.suggestions.map((s) => (
                    <div key={s} className="flex items-start justify-between gap-3">
                      <div className="text-sm text-slate-800">• {s}</div>
                      <button
                        type="button"
                        className="lp-btn-icon shrink-0"
                        disabled={!user || !activePetId || creatingFromSuggestion === s}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          setCreatingFromSuggestion(s);
                          try {
                            await createTask(activePetId, {
                              petId: activePetId,
                              title: s,
                              status: "due",
                              createdAt: Date.now(),
                              createdBy: user.uid,
                            });
                            pushToast({ type: "success", title: "Task creato", message: "Aggiunto al planner." });
                          } catch (err) {
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione task fallita" });
                          } finally {
                            setCreatingFromSuggestion(null);
                          }
                        }}
                      >
                        Task
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">Nessun suggerimento: aggiungi log (cibo, acqua, attività) per rendere lo stato più preciso.</div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="lp-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Rischi recenti</div>
                  <ShieldAlert className="w-4 h-4 text-slate-600" />
                </div>
                <div className="mt-2 text-sm text-slate-700">Sintomi (30d): {computed.metrics.symptom30d}</div>
                <div className="text-sm text-slate-700">Task dovuti (7d): {computed.metrics.due7d}</div>
                <div className="text-sm text-slate-700">Task completati (7d): {computed.metrics.done7d}</div>
                <div className="text-sm text-slate-700">Terapie attive: {activeMeds}</div>
                <div className="text-sm text-slate-700">Prossimo vaccino: {nextVaccine ? new Date(nextVaccine.nextDueAt).toLocaleDateString() : "—"}</div>
              </div>
              <div className="lp-surface p-4">
                <div className="font-semibold">GPS ultimo punto</div>
                {gpsLatest ? (
                  <div className="mt-2 text-sm text-slate-700">
                    {gpsLatest.lat.toFixed(5)}, {gpsLatest.lng.toFixed(5)} · ±{gpsLatest.accuracyM}m
                    <div className="text-xs text-slate-600 mt-1">{new Date(gpsLatest.recordedAt).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">Nessun punto GPS.</div>
                )}
              </div>
            </div>

            <div className="mt-4 lp-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">AI (triage informativo)</div>
                <div className="inline-flex items-center gap-2 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  <Sparkles className="w-4 h-4" />
                  Non è diagnosi
                </div>
              </div>
              {!aiAllowed ? (
                <div className="mt-2 text-sm" style={{ color: "rgb(var(--lp-muted))" }}>
                  AI disattivata: riattivala in Impostazioni → Preferenze.
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="lp-btn-primary"
                    onClick={() => {
                      if (!activePetId || !activePet) return;
                      openWithDraft(
                        `Pet: ${activePet.name}. Ho sintomi e voglio un triage: fammi domande mirate, poi proponi cosa monitorare 24-48h e segnali di urgenza. Contesto: score ${computed.score}/100, sintomi30g=${computed.metrics.symptom30d}, acqua24h=${computed.metrics.water24h}, attività7g=${computed.metrics.activity7d}.`
                      );
                    }}
                    disabled={!activePetId || !activePet}
                  >
                    Apri triage
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => {
                      if (!activePetId || !activePet) return;
                      openWithDraft(
                        `Pet: ${activePet.name}. Voglio un piano di monitoraggio giornaliero: checklist + quando contattare il veterinario + 3 task nel planner.`
                      );
                    }}
                    disabled={!activePetId || !activePet}
                  >
                    Checklist
                  </button>
                </div>
              )}
            </div>
            </CardContent>
          </Card>

          <div className="text-xs text-slate-500">Questo indice non sostituisce il veterinario. Per segnali gravi, contatta un professionista.</div>
        </>
      )}
    </div>
  );
}

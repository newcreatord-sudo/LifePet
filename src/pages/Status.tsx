import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Droplets, Footprints, HeartPulse, ShieldAlert, Sparkles, Weight } from "lucide-react";
import { Link } from "react-router-dom";
import { usePetStore } from "@/stores/petStore";
import { subscribeLogsRange } from "@/data/logs";
import { subscribeTasks } from "@/data/tasks";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeLatestGpsPoint } from "@/data/gps";
import { subscribeMedications } from "@/data/medications";
import { subscribeVaccines } from "@/data/vaccines";
import type { GpsPoint, HealthEvent, PetLog, PetMedication, PetTask, PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeLongevitySnapshot } from "@/lib/longevity";

type PetTraffic = "green" | "yellow" | "red";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function trafficLabel(t: PetTraffic) {
  if (t === "green") return "Sano";
  if (t === "yellow") return "Attenzione";
  return "Rischio";
}

function trafficClass(t: PetTraffic) {
  if (t === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-800";
  if (t === "yellow") return "border-amber-400/30 bg-amber-400/10 text-amber-900";
  return "border-rose-400/30 bg-rose-500/10 text-rose-900";
}

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
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [gpsLatest, setGpsLatest] = useState<GpsPoint | null>(null);
  const [meds, setMeds] = useState<PetMedication[]>([]);
  const [vaccines, setVaccines] = useState<PetVaccine[]>([]);

  const range = useMemo(() => {
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    const from7d = toMs - 7 * 24 * 60 * 60 * 1000;
    const from24h = toMs - 24 * 60 * 60 * 1000;
    const from72h = toMs - 72 * 60 * 60 * 1000;
    return { fromMs, toMs, from7d, from24h, from72h };
  }, []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeLogsRange(activePetId, range.fromMs, range.toMs, setLogs30d);
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeTasks(activePetId, setTasks);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentHealthEvents(activePetId, 30, setHealthEvents);
    return () => unsub();
  }, [activePetId]);

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
    const symptom30d = logs30d.filter((l) => l.type === "symptom").length;
    const weight30d = logs30d.filter((l) => l.type === "weight").length;
    const activity7d = logs30d.filter((l) => l.type === "activity" && l.occurredAt >= range.from7d).length;
    const water24h = logs30d.filter((l) => l.type === "water" && l.occurredAt >= range.from24h).length;

    const due7d = tasks.filter((t) => (t.dueAt ?? 0) >= range.from7d && (t.dueAt ?? 0) <= now && t.status === "due").length;
    const done7d = tasks.filter((t) => (t.completedAt ?? 0) >= range.from7d && (t.completedAt ?? 0) <= now && t.status === "done").length;
    const adherence = due7d === 0 ? 0.7 : clamp(done7d / (done7d + due7d), 0, 1);

    const highHealth72h = healthEvents.some((e) => e.type === "symptom" && e.severity === "high" && e.occurredAt >= range.from72h);

    const base = 55;
    const symptomPenalty = clamp(symptom30d * 7, 0, 50);
    const weightBonus = clamp(weight30d * 4, 0, 25);
    const activityBonus = clamp(activity7d * 2, 0, 12);
    const hydrationBonus = clamp(water24h > 0 ? 6 : 0, 0, 10);
    const adherenceScore = Math.round(adherence * 35);
    const score = clamp(base + weightBonus + activityBonus + hydrationBonus + adherenceScore - symptomPenalty, 0, 100);

    let traffic: PetTraffic = score >= 75 ? "green" : score >= 45 ? "yellow" : "red";
    if (highHealth72h) traffic = "red";

    const suggestions: string[] = [];
    if (highHealth72h) suggestions.push("Sintomo severità alta negli ultimi 3 giorni: valuta contatto veterinario.");
    if (water24h === 0) suggestions.push("Nessun log acqua nelle ultime 24h: controlla idratazione e ciotola.");
    if (activity7d === 0) suggestions.push("Nessun log attività negli ultimi 7 giorni: aggiungi gioco/passeggiata breve.");
    if (symptom30d >= 3) suggestions.push("Sintomi ricorrenti: registra dettagli e monitora trend.");
    if (due7d > 0 && adherence < 0.6) suggestions.push("Aderenza task bassa: semplifica routine o cambia orari.");
    if (suggestions.length === 0) suggestions.push("Continua così: routine e log regolari migliorano la prevenzione.");

    const weights = logs30d
      .filter((l) => l.type === "weight")
      .map((l) => {
        const n = Number(String(l.note ?? "").replace(/[^0-9.,]/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : null;
      })
      .filter((x): x is number => x !== null)
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
      score,
      traffic,
      metrics: { symptom30d, weight30d, activity7d, water24h, due7d, done7d },
      suggestions,
      charts: {
        weightSpark: simpleSpark(weights),
        activitySpark: simpleSpark(activitySeries),
        waterSpark: simpleSpark(waterSeries),
      },
    };
  }, [healthEvents, logs30d, range.from24h, range.from72h, range.from7d, tasks]);

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
        actions={
          <Link
            to="/app/health"
            className="lp-btn-secondary"
          >
            Apri Salute
            <ArrowRight className="w-4 h-4" />
          </Link>
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
                <div className="text-sm text-slate-600">Pet</div>
                <div className="text-lg font-semibold">{activePet?.name ?? "—"}</div>
                <div className="text-xs text-slate-600">{activePet?.species ?? "—"}{activePet?.breed ? ` · ${activePet.breed}` : ""}</div>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${trafficClass(computed.traffic)}`}>
                <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
                {trafficLabel(computed.traffic)}
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
                    className="h-2 rounded-full bg-fuchsia-600"
                    style={{ width: `${computed.score}%` }}
                  />
                </div>
              </div>

              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Idratazione (24h)</div>
                    <Droplets className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.water24h > 0 ? "OK" : "Mancante"}</div>
                  {computed.charts.waterSpark ? (
                    <svg width={computed.charts.waterSpark.w} height={computed.charts.waterSpark.h} className="mt-2">
                      <path d={computed.charts.waterSpark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-fuchsia-600" />
                    </svg>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Attività (7d)</div>
                    <Footprints className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.activity7d} log</div>
                  {computed.charts.activitySpark ? (
                    <svg width={computed.charts.activitySpark.w} height={computed.charts.activitySpark.h} className="mt-2">
                      <path d={computed.charts.activitySpark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-fuchsia-600" />
                    </svg>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Peso (30d)</div>
                    <Weight className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{computed.metrics.weight30d} log</div>
                  {computed.charts.weightSpark ? (
                    <svg width={computed.charts.weightSpark.w} height={computed.charts.weightSpark.h} className="mt-2">
                      <path d={computed.charts.weightSpark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-fuchsia-600" />
                    </svg>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Longevità</div>
                    <Sparkles className="w-4 h-4 text-slate-600" />
                  </div>
                  {longevity ? (
                    <>
                      <div className="mt-1 text-sm font-semibold">{longevity.longevityScore}/100</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {longevity.remainingYears === null
                          ? `Aspettativa ~${longevity.expectancyYears.toFixed(1)} anni`
                          : `Residuo ~${longevity.remainingYears.toFixed(1)} anni`}
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-2 bg-fuchsia-600" style={{ width: `${longevity.longevityScore}%` }} />
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
                {computed.suggestions.map((s) => (
                  <div key={s} className="text-sm text-slate-800">• {s}</div>
                ))}
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
            </CardContent>
          </Card>

          <div className="text-xs text-slate-500">Questo indice non sostituisce il veterinario. Per segnali gravi, contatta un professionista.</div>
        </>
      )}
    </div>
  );
}

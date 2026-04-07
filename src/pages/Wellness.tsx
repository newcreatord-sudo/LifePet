import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { subscribeLogsRange } from "@/data/logs";
import { subscribeTasks } from "@/data/tasks";
import { createTask } from "@/data/tasks";
import { getFirebase } from "@/lib/firebase";
import { demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { HealthScore, PetLog, PetTask } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";
import { computeLongevitySnapshot } from "@/lib/longevity";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreToStatus(score: number): HealthScore["status"] {
  if (score >= 75) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function simpleSpark(values: number[]) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 220;
  const h = 44;
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

export default function Wellness() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [saving, setSaving] = useState(false);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const now = useMemo(() => Date.now(), []);
  const from30d = useMemo(() => now - 30 * 24 * 60 * 60 * 1000, [now]);
  const from7d = useMemo(() => now - 7 * 24 * 60 * 60 * 1000, [now]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeLogsRange(activePetId, from30d, now, setLogs30d);
    return () => unsub();
  }, [activePetId, from30d, now]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeTasks(activePetId, setTasks);
    return () => unsub();
  }, [activePetId]);

  const computed = useMemo(() => {
    const symptomCount30d = logs30d.filter((l) => l.type === "symptom").length;
    const weightLogs30d = logs30d.filter((l) => l.type === "weight").length;
    const activityLogs7d = logs30d.filter((l) => l.type === "activity" && l.occurredAt >= from7d).length;
    const waterLogs7d = logs30d.filter((l) => l.type === "water" && l.occurredAt >= from7d).length;

    const dueTasks7d = tasks.filter((t) => (t.dueAt ?? 0) >= from7d && (t.dueAt ?? 0) <= now).length;
    const completedTasks7d = tasks.filter((t) => (t.completedAt ?? 0) >= from7d && (t.completedAt ?? 0) <= now).length;

    const symptomPenalty = clamp(symptomCount30d * 7, 0, 50);
    const weightBonus = clamp(weightLogs30d * 4, 0, 25);
    const activityBonus = clamp(activityLogs7d * 2, 0, 12);
    const hydrationBonus = clamp(waterLogs7d * 1, 0, 10);
    const adherence = dueTasks7d === 0 ? 0.7 : clamp(completedTasks7d / dueTasks7d, 0, 1);
    const adherenceScore = Math.round(adherence * 35);

    const base = 55;
    const score = clamp(base + weightBonus + adherenceScore + activityBonus + hydrationBonus - symptomPenalty, 0, 100);

    const status = scoreToStatus(score);
    const suggestions: string[] = [];
    if (symptomCount30d >= 3) suggestions.push("Sintomi registrati spesso: se persistono, valuta un controllo dal veterinario.");
    if (weightLogs30d === 0) suggestions.push("Nessun log peso negli ultimi 30 giorni: aggiungi 1–2 pesate al mese.");
    if (dueTasks7d > 0 && adherence < 0.6) suggestions.push("Aderenza ai task bassa: semplifica le routine o cambia orari promemoria.");
    if (activityLogs7d === 0) suggestions.push("Nessun log attività negli ultimi 7 giorni: aggiungi gioco/passeggiata breve ogni giorno.");
    if (waterLogs7d === 0) suggestions.push("Nessun log idratazione negli ultimi 7 giorni: aggiungi un check quotidiano dell’acqua.");
    if (suggestions.length === 0) suggestions.push("Ottimo: mantieni routine e continua a registrare eventi chiave.");

    return {
      score,
      status,
      inputs: { symptomCount30d, weightLogs30d, completedTasks7d, dueTasks7d, activityLogs7d, waterLogs7d },
      suggestions,
    };
  }, [from7d, logs30d, now, tasks]);

  const longevityNow = useMemo(() => {
    if (!activePet) return null;
    return computeLongevitySnapshot({ pet: activePet, logs30d, tasks, nowMs: Date.now() });
  }, [activePet, logs30d, tasks]);

  const longevityTrend = useMemo(() => {
    if (!activePet) return null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const points: number[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const end = now - i * weekMs;
      const start = end - weekMs;
      const l = logs30d.filter((x) => x.occurredAt >= start && x.occurredAt < end);
      const t = tasks.filter((x) => (x.dueAt ?? 0) >= start && (x.dueAt ?? 0) < end);
      points.push(computeLongevitySnapshot({ pet: activePet, logs30d: l, tasks: t, nowMs: end }).longevityScore);
    }
    return { points, spark: simpleSpark(points) };
  }, [activePet, logs30d, now, tasks]);

  async function addPlanTasks() {
    if (!user || !activePetId) return;
    const base = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const items: Array<{ title: string; dueAt: number }> = [];

    if (computed.inputs.waterLogs7d === 0) {
      items.push({ title: "Controlla acqua (oggi)", dueAt: base + 30 * 60 * 1000 });
      items.push({ title: "Controlla acqua (domani)", dueAt: base + dayMs + 30 * 60 * 1000 });
    }
    if (computed.inputs.activityLogs7d === 0) {
      items.push({ title: "Gioco/passeggiata 15 min", dueAt: base + 2 * 60 * 60 * 1000 });
      items.push({ title: "Gioco/passeggiata 15 min (domani)", dueAt: base + dayMs + 2 * 60 * 60 * 1000 });
    }
    if (computed.inputs.weightLogs30d === 0) {
      items.push({ title: "Registra peso", dueAt: base + 3 * dayMs });
    }
    if (computed.inputs.symptomCount30d >= 2) {
      items.push({ title: "Check sintomi + note", dueAt: base + dayMs });
    }

    if (items.length === 0) {
      items.push({ title: "Routine benessere (check rapido)", dueAt: base + dayMs });
    }

    for (const it of items.slice(0, 6)) {
      await createTask(activePetId, {
        petId: activePetId,
        title: it.title,
        dueAt: it.dueAt,
        status: "due",
        createdAt: Date.now(),
        createdBy: user.uid,
        source: { kind: "manual" },
      });
    }
  }

  async function saveSnapshot() {
    if (!activePetId || !user) return;
    setSaving(true);
    try {
      const id = ymd(new Date());
      const payload = {
        petId: activePetId,
        score: computed.score,
        status: computed.status,
        computedAt: Date.now(),
        inputs: computed.inputs,
      };
      if (shouldUseDemoData()) {
        const key = `lifepet:demo:pet:${activePetId}:healthScores`;
        demoUpdate<Record<string, unknown>>(key, {}, (prev) => ({ ...(prev as Record<string, unknown>), [id]: payload }));
      } else {
        const { db } = getFirebase();
        await setDoc(doc(db, "pets", activePetId, "healthScores", id), payload);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Benessere" description="Indice orientativo costruito da log e routine (non medico)." />

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere i trend di benessere." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Indice benessere</CardTitle>
                  <CardDescription>Ultimi 30 giorni</CardDescription>
                </div>
              <button
                onClick={saveSnapshot}
                disabled={saving}
                className="lp-btn-secondary"
              >
                {saving ? "Salvataggio…" : "Salva snapshot"}
              </button>
            </div>
            </CardHeader>
            <CardContent>

            <div className="mt-4 lp-surface p-4">
              <div className="text-4xl font-semibold">{computed.score}</div>
              <div className="text-sm text-slate-700 mt-1">
                Stato: {computed.status === "green" ? "Sano" : computed.status === "yellow" ? "Attenzione" : "Rischio"}
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={
                    computed.status === "green"
                      ? "h-full bg-fuchsia-600"
                      : computed.status === "yellow"
                        ? "h-full bg-amber-400"
                        : "h-full bg-rose-500"
                  }
                  style={{ width: `${computed.score}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-slate-600">Non è un parere medico. Usalo come segnale orientativo.</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="lp-panel p-3">
                <div className="text-xs text-slate-600">Sintomi (30g)</div>
                <div className="text-sm font-medium">{computed.inputs.symptomCount30d}</div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs text-slate-600">Log peso (30g)</div>
                <div className="text-sm font-medium">{computed.inputs.weightLogs30d}</div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs text-slate-600">Task dovuti (7g)</div>
                <div className="text-sm font-medium">{computed.inputs.dueTasks7d}</div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs text-slate-600">Completati (7g)</div>
                <div className="text-sm font-medium">{computed.inputs.completedTasks7d}</div>
              </div>
            </div>

            {longevityNow ? (
              <div className="mt-4 lp-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Longevità</div>
                    <div className="text-xs text-slate-600 mt-1">Stima orientativa, non diagnostica.</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">Indice</div>
                    <div className="text-lg font-semibold">{longevityNow.longevityScore}/100</div>
                    <div className="text-xs text-slate-600">
                      {longevityNow.status === "green" ? "🟢 sano" : longevityNow.status === "yellow" ? "🟡 attenzione" : "🔴 rischio"}
                    </div>
                  </div>
                </div>

                {longevityTrend?.spark ? (
                  <div className="mt-3">
                    <div className="text-xs text-slate-600">Trend (8 settimane)</div>
                    <svg width={longevityTrend.spark.w} height={longevityTrend.spark.h} className="mt-2">
                      <path d={longevityTrend.spark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-fuchsia-600" />
                    </svg>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button onClick={addPlanTasks} className="lp-btn-primary">
                    Crea piano 7 giorni
                  </button>
                  <Link to="/app/status" className="lp-btn-secondary inline-flex items-center justify-center">
                    Apri Stato animale
                  </Link>
                </div>
              </div>
            ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Cosa migliorare</CardTitle>
                  <CardDescription>Azioni pratiche per la prossima settimana.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/app/insights" className="lp-btn-icon">
                    Insights
                  </Link>
                  <Link to="/app/status" className="lp-btn-icon">
                    Status
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
              {computed.suggestions.map((s, idx) => (
                <div key={idx} className="lp-panel px-3 py-2 text-sm text-slate-800">
                  {s}
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-700">
              Per un piano più dettagliato, apri Insights e chiedi una routine settimana per settimana.
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

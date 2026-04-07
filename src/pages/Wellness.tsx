import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { subscribeLogsRange } from "@/data/logs";
import { subscribeTasks } from "@/data/tasks";
import { getFirebase } from "@/lib/firebase";
import { demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { HealthScore, PetLog, PetTask } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";

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

export default function Wellness() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [saving, setSaving] = useState(false);

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
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs hover:bg-slate-900 disabled:opacity-60"
              >
                {saving ? "Salvataggio…" : "Salva snapshot"}
              </button>
            </div>
            </CardHeader>
            <CardContent>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-4xl font-semibold">{computed.score}</div>
              <div className="text-sm text-slate-300 mt-1">
                Stato: {computed.status === "green" ? "Sano" : computed.status === "yellow" ? "Attenzione" : "Rischio"}
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={
                    computed.status === "green"
                      ? "h-full bg-emerald-300"
                      : computed.status === "yellow"
                        ? "h-full bg-amber-300"
                        : "h-full bg-rose-400"
                  }
                  style={{ width: `${computed.score}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-slate-500">Non è un parere medico. Usalo come segnale orientativo.</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Sintomi (30g)</div>
                <div className="text-sm font-medium">{computed.inputs.symptomCount30d}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Log peso (30g)</div>
                <div className="text-sm font-medium">{computed.inputs.weightLogs30d}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Task dovuti (7g)</div>
                <div className="text-sm font-medium">{computed.inputs.dueTasks7d}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Completati (7g)</div>
                <div className="text-sm font-medium">{computed.inputs.completedTasks7d}</div>
              </div>
            </div>
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
                  <Link to="/app/insights" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                    Insights
                  </Link>
                  <Link to="/app/status" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                    Status
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
              {computed.suggestions.map((s, idx) => (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                  {s}
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-400">
              Per un piano più dettagliato, apri Insights e chiedi una routine settimana per settimana.
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

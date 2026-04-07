import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { usePetStore } from "@/stores/petStore";
import { useAuthStore } from "@/stores/authStore";
import { aiChat } from "@/data/ai";
import { updatePet } from "@/data/pets";
import { createRoutine, subscribeRoutines } from "@/data/routines";
import type { Pet } from "@/types";
import { aiUserMessage } from "@/lib/aiErrors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";
import { useEffect } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function yearsFromDob(dob?: string) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const ageMs = Date.now() - d.getTime();
  return ageMs / (365.25 * 24 * 60 * 60 * 1000);
}

function estimateDailyCalories(pet: Pet | null, weightKg: number, activity: "low" | "normal" | "high") {
  const species = (pet?.species || "other").toLowerCase();
  const rer = 70 * Math.pow(weightKg, 0.75);
  let factor = 1.6;
  if (species.includes("cat")) factor = activity === "low" ? 1.2 : activity === "high" ? 1.6 : 1.4;
  if (species.includes("dog")) factor = activity === "low" ? 1.3 : activity === "high" ? 2.0 : 1.6;
  return Math.round(rer * factor);
}

export default function Nutrition() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);

  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [weightKg, setWeightKg] = useState(pet?.weightKg?.toString() ?? "");
  const [activity, setActivity] = useState<"low" | "normal" | "high">("normal");
  const [kcalPerG, setKcalPerG] = useState(pet?.currentFood?.kcalPerG?.toString() ?? "3.5");
  const [foodLabel, setFoodLabel] = useState(pet?.currentFood?.label ?? "");
  const [notes, setNotes] = useState(pet?.currentFood?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  const [routines, setRoutines] = useState<Array<{ id: string; title: string; kind: string }>>([]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRoutines(activePetId, (items) => setRoutines(items.map((r) => ({ id: r.id, title: r.title, kind: r.kind }))));
    return () => unsub();
  }, [activePetId]);

  const hasMealRoutine = useMemo(() => routines.some((r) => r.kind === "food" && r.title.toLowerCase().includes("pasto")), [routines]);

  const derived = useMemo(() => {
    const w = Number(weightKg);
    const kcalg = Number(kcalPerG);
    if (!Number.isFinite(w) || w <= 0) return null;
    const dailyKcal = estimateDailyCalories(pet, w, activity);
    const gramsPerDay = Number.isFinite(kcalg) && kcalg > 0 ? Math.round(dailyKcal / kcalg) : null;
    const meals = clamp(pet?.species?.toLowerCase().includes("cat") ? 3 : 2, 2, 4);
    const gramsPerMeal = gramsPerDay ? Math.round(gramsPerDay / meals) : null;
    return { dailyKcal, gramsPerDay, gramsPerMeal, meals };
  }, [activity, kcalPerG, pet, weightKg]);

  const ageYears = useMemo(() => yearsFromDob(pet?.dob), [pet?.dob]);

  async function onSaveProfile() {
    if (!activePetId) return;
    const w = Number(weightKg);
    const kcalg = Number(kcalPerG);
    setSaving(true);
    try {
      await updatePet(activePetId, {
        weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
        currentFood: {
          label: foodLabel.trim() || undefined,
          kcalPerG: Number.isFinite(kcalg) && kcalg > 0 ? kcalg : undefined,
          notes: notes.trim() || undefined,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  async function onAskAi() {
    if (!activePetId) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const prompt = [
        "Crea un piano alimentare pratico per questo pet.",
        "Restituisci testo semplice con: 1) Grammi giornalieri, 2) Orari pasti, 3) Lista da evitare, 4) Cosa monitorare, 5) Disclaimer.",
        "Non fare diagnosi e non sostituire il veterinario.",
        "Profilo pet:",
        JSON.stringify({
          name: pet?.name,
          species: pet?.species,
          breed: pet?.breed,
          ageYears: ageYears ? Math.round(ageYears * 10) / 10 : undefined,
          weightKg: Number(weightKg) || undefined,
          allergies: pet?.healthProfile?.allergies,
          conditions: pet?.healthProfile?.conditions,
          currentFood: { label: foodLabel || pet?.currentFood?.label, kcalPerG: Number(kcalPerG) || pet?.currentFood?.kcalPerG },
          activity,
        }),
        "Se mancano dati, fai poche domande mirate.",
      ].join("\n");

      const res = await aiChat(activePetId, null, prompt);
      setAiText(res.answer);
    } catch (e) {
      setAiText(aiUserMessage(e));
    } finally {
      setAiLoading(false);
    }
  }

  async function onCreateMealRoutine() {
    if (!user || !activePetId) return;
    setCreatingRoutine(true);
    try {
      const times = pet?.species?.toLowerCase().includes("cat") ? ["08:00", "13:00", "19:00"] : ["08:00", "19:00"];
      await createRoutine(activePetId, {
        petId: activePetId,
        title: "Pasto",
        kind: "food",
        enabled: true,
        times,
        recurrence: { type: "daily" },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
    } finally {
      setCreatingRoutine(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Alimentazione" description="Stime, promemoria pasti e supporto AI per una dieta più consapevole." />

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per gestire alimentazione e promemoria." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Dati</CardTitle>
              <CardDescription>Inserisci peso e info cibo per avere stime utili.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Peso (kg)</div>
                <input
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Attività</div>
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as "low" | "normal" | "high")}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="low">Bassa</option>
                  <option value="normal">Normale</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Cibo (marca/ricetta)</div>
                <input
                  value={foodLabel}
                  onChange={(e) => setFoodLabel(e.target.value)}
                  placeholder="Marca / ricetta"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">kcal per grammo (circa)</div>
                <input
                  value={kcalPerG}
                  onChange={(e) => setKcalPerG(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onSaveProfile}
                disabled={saving}
                className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? "Salvataggio…" : "Salva nel profilo"}
              </button>
              <button
                onClick={onCreateMealRoutine}
                disabled={creatingRoutine || hasMealRoutine}
                className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900 disabled:opacity-60"
              >
                {hasMealRoutine ? "Promemoria già presenti" : creatingRoutine ? "Creazione…" : "Crea promemoria pasti"}
              </button>
              <Link to="/app/planner" className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900 text-center">
                Planner
              </Link>
            </div>
            <div className="text-xs text-slate-500">
              Stime generiche. Conferma cambi alimentari con il veterinario, soprattutto in presenza di allergie/condizioni.
            </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Stima rapida</CardTitle>
              <CardDescription>Basata su peso e livello attività.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {derived ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">Calorie giornaliere</div>
                  <div className="text-sm font-medium">{derived.dailyKcal} kcal</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">Pasti al giorno</div>
                  <div className="text-sm font-medium">{derived.meals}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">Grammi al giorno</div>
                  <div className="text-sm font-medium">{derived.gramsPerDay ? `${derived.gramsPerDay} g` : "Imposta kcal/g"}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">Grammi per pasto</div>
                  <div className="text-sm font-medium">{derived.gramsPerMeal ? `${derived.gramsPerMeal} g` : "—"}</div>
                </div>
              </div>
            ) : (
              <EmptyState title="Inserisci un peso valido" description="Per vedere le stime serve almeno il peso." />
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Supporto AI</div>
                  <div className="text-xs text-slate-500">Suggerimenti personalizzati da profilo e attività</div>
                </div>
                <button
                  onClick={onAskAi}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? "…" : "Chiedi all’AI"}
                </button>
              </div>
              <div className="mt-3 text-sm whitespace-pre-wrap text-slate-200 min-h-20">
                {aiText ?? "Chiedi un piano, una lista da evitare e cosa monitorare."}
              </div>
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

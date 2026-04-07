import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { usePetStore } from "@/stores/petStore";
import { useAuthStore } from "@/stores/authStore";
import { aiChat } from "@/data/ai";
import { createTask } from "@/data/tasks";
import { aiUserMessage } from "@/lib/aiErrors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";

const guides: Record<string, Array<{ title: string; bullets: string[] }>> = {
  dog: [
    {
      title: "Guinzaglio: basi",
      bullets: ["Premia la calma", "Fermati se tira", "Sessioni brevi quotidiane"],
    },
    {
      title: "Gestione dell’abbaio",
      bullets: ["Identifica il trigger", "Insegna il segnale “silenzio”", "Aumenta arricchimento"],
    },
  ],
  cat: [
    {
      title: "Lettiera: buone pratiche",
      bullets: ["Una lettiera per gatto + 1", "Pulisci ogni giorno", "Posizione tranquilla"],
    },
    {
      title: "Graffi: reindirizzamento",
      bullets: ["Offri tiragraffi", "Mettili vicino ai punti critici", "Premia l’uso"],
    },
  ],
  other: [
    {
      title: "Routine di arricchimento",
      bullets: ["Sessioni brevi quotidiane", "Cues coerenti", "Traccia cosa funziona"],
    },
  ],
};

export default function Training() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [issue, setIssue] = useState("");
  const [context, setContext] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  const bucket = useMemo(() => {
    const s = (pet?.species || "other").toLowerCase();
    if (s.includes("dog")) return "dog";
    if (s.includes("cat")) return "cat";
    return "other";
  }, [pet?.species]);

  async function onAskAi() {
    if (!activePetId) return;
    const i = issue.trim();
    if (!i) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const prompt = [
        "Sei un coach comportamentale per LifePet.",
        "Restituisci testo semplice con: 1) Possibili cause, 2) Piano step-by-step, 3) Routine giornaliera, 4) Note di sicurezza.",
        "Evita affermazioni mediche e consiglia il veterinario quando la salute potrebbe essere coinvolta.",
        `Specie: ${pet?.species ?? "sconosciuta"}`,
        `Problema: ${i}`,
        context.trim() ? `Contesto: ${context.trim()}` : "",
      ].filter(Boolean).join("\n");
      const res = await aiChat(activePetId, null, prompt);
      setAiText(res.answer);
    } catch (e) {
      setAiText(aiUserMessage(e));
    } finally {
      setAiLoading(false);
    }
  }

  async function addTrainingTask() {
    if (!user || !activePetId) return;
    setCreatingTask(true);
    try {
      await createTask(activePetId, {
        petId: activePetId,
        title: `Training: ${issue.trim() || "sessione"}`,
        dueAt: Date.now() + 60 * 60 * 1000,
        status: "due",
        createdAt: Date.now(),
        createdBy: user.uid,
      });
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Training" description="Guide, strumenti e suggerimenti AI per comportamento e apprendimento." />

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per iniziare un percorso di training." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Guide rapide</CardTitle>
              <CardDescription>Piccoli passi quotidiani, risultati grandi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            <div className="space-y-2">
              {guides[bucket].map((g) => (
                <div key={g.title} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="text-sm font-medium">{g.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{g.bullets.join(" · ")}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500">Per aggressività o casi complessi, consulta un educatore o un veterinario comportamentalista.</div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>AI comportamento</CardTitle>
                  <CardDescription>Piano step-by-step e routine giornaliera.</CardDescription>
                </div>
                <Link to="/app/planner" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                  Planner
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Problema</div>
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="es. abbaia alla porta, tira al guinzaglio, graffia il divano"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Contesto (opzionale)</div>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="Trigger, frequenza, ambiente, cambi recenti…"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onAskAi}
                disabled={aiLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? "…" : "Chiedi all’AI"}
              </button>
              <button
                onClick={addTrainingTask}
                disabled={creatingTask}
                className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900 disabled:opacity-60"
              >
                {creatingTask ? "Aggiunta…" : "Aggiungi come task"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm whitespace-pre-wrap min-h-28">
              {aiText ?? "Descrivi un problema e chiedi un piano step-by-step."}
            </div>
            <div className="text-xs text-slate-500">Suggerimenti informativi: non sostituiscono un professionista.</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

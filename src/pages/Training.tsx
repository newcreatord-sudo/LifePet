import { useEffect, useMemo, useState } from "react";
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
import { subscribeUserProfile } from "@/data/users";
import type { AiCitation } from "@/types";

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
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planTime, setPlanTime] = useState("18:00");
  const [aiAllowed, setAiAllowed] = useState(true);

  const bucket = useMemo(() => {
    const s = (pet?.species || "other").toLowerCase();
    if (s.includes("dog")) return "dog";
    if (s.includes("cat")) return "cat";
    return "other";
  }, [pet?.species]);

  const issues = useMemo(() => {
    if (bucket === "dog") return ["Tira al guinzaglio", "Abbaia alla porta", "Salta addosso", "Ansia da separazione"];
    if (bucket === "cat") return ["Graffia divano", "Aggressività nel gioco", "Lettiera: problemi", "Miagola di notte"];
    return ["Paura/stress", "Routine e arricchimento", "Manipolazione e cura", "Aggressività"];
  }, [bucket]);

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

  async function onAskAi() {
    if (!activePetId) return;
    const i = issue.trim();
    if (!i) return;
    setAiLoading(true);
    setAiText(null);
    setCitations([]);
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
      setCitations(res.citations ?? []);
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

  async function addTrainingPlan() {
    if (!user || !activePetId) return;
    const base = Date.now();
    const t = issue.trim() || "sessione";
    const [hh, mm] = planTime.split(":").map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
    setCreatingPlan(true);
    try {
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(base + i * 24 * 60 * 60 * 1000);
        d.setHours(hh, mm, 0, 0);
        await createTask(activePetId, {
          petId: activePetId,
          title: `Training: ${t} (giorno ${i + 1}/7)`,
          dueAt: d.getTime(),
          status: "due",
          createdAt: Date.now(),
          createdBy: user.uid,
        });
      }
    } finally {
      setCreatingPlan(false);
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
                <div key={g.title} className="lp-panel px-3 py-2">
                  <div className="text-sm font-medium">{g.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{g.bullets.join(" · ")}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-600">Per aggressività o casi complessi, consulta un educatore o un veterinario comportamentalista.</div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>AI comportamento</CardTitle>
                  <CardDescription>Piano step-by-step e routine giornaliera.</CardDescription>
                </div>
                <Link to="/app/planner" className="lp-btn-secondary">
                  Planner
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
            {!aiAllowed ? <EmptyState title="AI disattivata" description="Riattivala in Impostazioni → Preferenze per usare Training AI." /> : null}

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Problema</div>
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="es. abbaia alla porta, tira al guinzaglio, graffia il divano"
                className="lp-input"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {issues.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setIssue(x)}
                  className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
                >
                  {x}
                </button>
              ))}
            </div>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Contesto (opzionale)</div>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="Trigger, frequenza, ambiente, cambi recenti…"
                className="lp-textarea"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onAskAi}
                disabled={aiLoading || !aiAllowed}
                className="inline-flex items-center justify-center gap-2 lp-btn-primary disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? "…" : "Chiedi all’AI"}
              </button>
              <button
                onClick={addTrainingTask}
                disabled={creatingTask}
                className="lp-btn-secondary disabled:opacity-60"
              >
                {creatingTask ? "Aggiunta…" : "Aggiungi come task"}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Orario piano 7 giorni</div>
                <input value={planTime} onChange={(e) => setPlanTime(e.target.value)} type="time" className="lp-input" />
              </label>
              <button onClick={addTrainingPlan} disabled={creatingPlan || !user} className="lp-btn-secondary disabled:opacity-60" type="button">
                {creatingPlan ? "Creazione…" : "Crea piano 7 giorni"}
              </button>
            </div>

            <div className="lp-panel p-3 text-sm whitespace-pre-wrap min-h-28">
              {aiText ?? "Descrivi un problema e chiedi un piano step-by-step."}
            </div>

            {citations.length ? (
              <div className="text-xs text-slate-600">Citazioni: {citations.map((c) => `${c.kind}:${c.type ?? c.id}`).join(" · ")}</div>
            ) : null}

            <div className="text-xs text-slate-600">Suggerimenti informativi: non sostituiscono un professionista.</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { aiChat } from "@/data/ai";
import { createHealthEvent } from "@/data/health";
import { aiUserMessage } from "@/lib/aiErrors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { subscribeUserProfile } from "@/data/users";

type Severity = "low" | "medium" | "high";
type Intake = "normal" | "reduced" | "none";

export default function Symptoms() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [aiAllowed, setAiAllowed] = useState(true);

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

  const [symptoms, setSymptoms] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [appetite, setAppetite] = useState<Intake>("reduced");
  const [waterIntake, setWaterIntake] = useState<Intake>("normal");
  const [vomiting, setVomiting] = useState(false);
  const [diarrhea, setDiarrhea] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [bleeding, setBleeding] = useState(false);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const redFlag = useMemo(() => {
    if (bleeding || breathing) return true;
    if (severity === "high") return true;
    if (appetite === "none" && waterIntake === "none") return true;
    return false;
  }, [appetite, bleeding, breathing, severity, waterIntake]);

  async function onAskAi() {
    if (!activePetId) return;
    const s = symptoms.trim();
    if (!s) return;
    setLoading(true);
    setAnswer(null);
    setSaved(false);
    try {
      const payload = {
        pet: { name: pet?.name, species: pet?.species, breed: pet?.breed, weightKg: pet?.weightKg, allergies: pet?.healthProfile?.allergies, conditions: pet?.healthProfile?.conditions },
        symptoms: s,
        durationHours: Number(durationHours) || undefined,
        severity,
        appetite,
        waterIntake,
        flags: { vomiting, diarrhea, breathing, bleeding },
        notes: notes.trim() || undefined,
      };

      const prompt = [
        "Sei LifePet AI. Risposta informativa, non sostituisce il veterinario.",
        "Dato il report dei sintomi, fornisci una risposta prudente in stile triage.",
        "Restituisci testo semplice con:",
        "1) Segnali di allarme (quando andare in pronto soccorso veterinario)",
        "2) Possibili categorie (NON diagnosi)",
        "3) Cosa monitorare nelle prossime 24 ore",
        "4) Cura a casa (solo consigli sicuri e non farmacologici)",
        "5) Domande utili da fare al proprietario",
        "6) Disclaimer",
        "Non prescrivere farmaci. Se difficoltà respiratoria, collasso, convulsioni, sanguinamento importante o disidratazione severa: dire di andare subito dal veterinario d'emergenza.",
        "Dati:",
        JSON.stringify(payload),
      ].join("\n");

      const res = await aiChat(activePetId, null, prompt);
      setAnswer(res.answer);
    } catch (e) {
      setAnswer(aiUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSaveHealthEvent() {
    if (!user || !activePetId) return;
    const s = symptoms.trim();
    if (!s) return;
    await createHealthEvent(activePetId, {
      petId: activePetId,
      type: "symptom",
      title: "Segnalazione sintomi",
      note: [
        `Sintomi: ${s}`,
        `Durata: ${durationHours}h`,
        `Gravità: ${severity}`,
        `Appetito: ${appetite}`,
        `Acqua: ${waterIntake}`,
        vomiting ? "Vomito: sì" : "Vomito: no",
        diarrhea ? "Diarrea: sì" : "Diarrea: no",
        breathing ? "Problemi respiratori: sì" : "Problemi respiratori: no",
        bleeding ? "Sanguinamento: sì" : "Sanguinamento: no",
        notes.trim() ? `Note: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      severity,
      occurredAt: Date.now(),
      createdAt: Date.now(),
      createdBy: user.uid,
    });
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checker sintomi AI"
        description="Triage informativo: non sostituisce il veterinario."
        actions={
          <Link to="/app/health" className="lp-btn-secondary">
            Torna a Salute
          </Link>
        }
      />

      {!aiAllowed ? (
        <EmptyState
          title="AI disattivata"
          description="Riattivala in Impostazioni → Preferenze per usare il checker sintomi."
          action={
            <Link to="/app/settings" className="lp-btn-secondary inline-flex items-center justify-center">
              Vai a Impostazioni
            </Link>
          }
        />
      ) : null}

      {!aiAllowed ? null : !activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare il checker sintomi." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>Pet: {pet?.name ?? "—"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Sintomi</div>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={4}
                placeholder="Descrivi sintomi (cosa, da quando, frequenza)."
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Durata (ore)</div>
                <input
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Gravità</div>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="low">Bassa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Appetito</div>
                <select
                  value={appetite}
                  onChange={(e) => setAppetite(e.target.value as Intake)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="normal">Normale</option>
                  <option value="reduced">Ridotto</option>
                  <option value="none">Assente</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Assunzione acqua</div>
                <select
                  value={waterIntake}
                  onChange={(e) => setWaterIntake(e.target.value as Intake)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="normal">Normale</option>
                  <option value="reduced">Ridotta</option>
                  <option value="none">Assente</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={vomiting} onChange={(e) => setVomiting(e.target.checked)} />
                Vomito
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={diarrhea} onChange={(e) => setDiarrhea(e.target.checked)} />
                Diarrea
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={breathing} onChange={(e) => setBreathing(e.target.checked)} />
                Problemi respiratori
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={bleeding} onChange={(e) => setBleeding(e.target.checked)} />
                Sanguinamento
              </label>
            </div>
            {redFlag ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-medium">Possibile urgenza</div>
                  <div className="text-xs text-rose-100/80 mt-1">
                    Se ci sono difficoltà respiratoria, collasso, convulsioni, sanguinamento importante o disidratazione severa: pronto soccorso veterinario.
                  </div>
                </div>
              </div>
            ) : null}
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Note (opzionale)</div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Temperatura, farmaci, trigger, cambi recenti…"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onAskAi}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? "…" : "Chiedi all’AI"}
              </button>
              <button
                onClick={onSaveHealthEvent}
                disabled={!user}
                className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900 disabled:opacity-60"
              >
                Salva in Salute
              </button>
            </div>
            {saved ? <div className="text-xs text-emerald-200">Salvato in Salute → Sintomi.</div> : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Risposta</CardTitle>
              <CardDescription>Interpretazione prudente e step pratici.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm whitespace-pre-wrap min-h-72">
              {answer ?? "Inserisci i sintomi e premi “Chiedi all’AI”."}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Se compaiono: difficoltà respiratoria, collasso, convulsioni, sanguinamento importante, disidratazione severa → pronto soccorso veterinario.
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

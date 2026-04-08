import { useEffect, useMemo, useState } from "react";
import { Camera, Save, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { aiVisionAnalyze } from "@/data/ai";
import { aiUserMessage } from "@/lib/aiErrors";
import { subscribeUserProfile } from "@/data/users";
import { uploadPetDocument } from "@/data/documents";
import { createHealthEvent } from "@/data/health";

type VisionMode = "skin" | "eyes" | "stool" | "general";

function modeLabel(m: VisionMode) {
  if (m === "skin") return "Pelle";
  if (m === "eyes") return "Occhi";
  if (m === "stool") return "Feci";
  return "Generale";
}

export default function Vision() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [aiAllowed, setAiAllowed] = useState(true);
  const [mode, setMode] = useState<VisionMode>("skin");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [savingToHealth, setSavingToHealth] = useState(false);

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

  async function analyze() {
    if (!activePetId || !imageDataUrl) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const prompt = [
        "Sei LifePet AI.",
        "Analizza l'immagine e rispondi in italiano.",
        "NON fare diagnosi e NON prescrivere farmaci.",
        "Restituisci: 1) Osservazioni possibili, 2) Cosa monitorare 24-48h, 3) Segnali di allarme (contatta vet), 4) Come rifare una foto migliore.",
        `Categoria: ${modeLabel(mode)}.`,
        pet
          ? `Pet: ${JSON.stringify({ species: pet.species, breed: pet.breed, weightKg: pet.weightKg, allergies: pet.healthProfile?.allergies, conditions: pet.healthProfile?.conditions })}`
          : "",
        notes.trim() ? `Note proprietario: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const res = await aiVisionAnalyze(activePetId, imageDataUrl, prompt);
      setAiText(res.answer);
    } catch (e) {
      setAiText(aiUserMessage(e));
    } finally {
      setAiLoading(false);
    }
  }

  async function saveToHealth() {
    if (!user || user.isDemo || !activePetId || !imageFile || !aiText) return;
    setSavingToHealth(true);
    try {
      const uploaded = await uploadPetDocument(activePetId, user.uid, imageFile);
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type: "symptom",
        title: `AI foto: ${modeLabel(mode)}`,
        note: [notes.trim() ? `Note: ${notes.trim()}` : null, aiText ? `AI:\n${aiText}` : null].filter(Boolean).join("\n\n") || undefined,
        occurredAt: Date.now(),
        createdAt: Date.now(),
        createdBy: user.uid,
        severity: "low",
        attachments: imageFile ? [{ name: imageFile.name, storagePath: uploaded.storagePath, docId: uploaded.docId }] : undefined,
      });
    } finally {
      setSavingToHealth(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analisi Foto AI" description="Supporto informativo per pelle/occhi e altri dubbi." />

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare l’analisi foto." />
      ) : !aiAllowed ? (
        <EmptyState title="AI disattivata" description="Riattivala in Impostazioni → Preferenze per usare Analisi Foto AI." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Carica foto</CardTitle>
            <CardDescription>Non è una diagnosi. Per dubbi seri o sintomi gravi, contatta il veterinario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <label className="md:col-span-3 block">
                <div className="text-xs text-slate-600 mb-1">Categoria</div>
                <select value={mode} onChange={(e) => setMode(e.target.value as VisionMode)} className="lp-select">
                  <option value="skin">Pelle</option>
                  <option value="eyes">Occhi</option>
                  <option value="stool">Feci</option>
                  <option value="general">Generale</option>
                </select>
              </label>

              <label className="md:col-span-6 block">
                <div className="text-xs text-slate-600 mb-1">Note (opzionale)</div>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="lp-input" placeholder="Da quanto? prurito? arrossamento? lacrimazione?" />
              </label>

              <label className="md:col-span-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm hover:bg-white cursor-pointer inline-flex items-center justify-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={aiLoading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    setAiText(null);
                    if (!f) {
                      setImageDataUrl(null);
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setImageDataUrl(typeof reader.result === "string" ? reader.result : null);
                    reader.readAsDataURL(f);
                  }}
                />
                <Camera className="w-4 h-4" />
                Seleziona foto
              </label>
            </div>

            {imageDataUrl ? (
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                <img src={imageDataUrl} alt="Foto" className="max-h-80 rounded-lg" />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="lp-btn-primary inline-flex items-center gap-2"
                disabled={aiLoading || !imageDataUrl}
                onClick={() => void analyze()}
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? "Analisi…" : "Analizza"}
              </button>

              <button
                type="button"
                className="lp-btn-secondary inline-flex items-center gap-2"
                disabled={!aiText || !imageFile || savingToHealth || !user || user.isDemo}
                onClick={() => void saveToHealth()}
              >
                <Save className="w-4 h-4" />
                {savingToHealth ? "Salvataggio…" : "Salva in Salute"}
              </button>
            </div>

            {aiText ? <div className="lp-surface p-4 text-sm text-slate-800 whitespace-pre-wrap">{aiText}</div> : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


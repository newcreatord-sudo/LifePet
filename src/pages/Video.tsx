import { useEffect, useMemo, useState } from "react";
import { Film, Save, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { aiUserMessage } from "@/lib/aiErrors";
import { subscribeUserProfile } from "@/data/users";
import { aiVisionAnalyzeMulti } from "@/data/ai";
import { uploadPetDocument } from "@/data/documents";
import { createHealthEvent } from "@/data/health";

type VideoMode = "behavior" | "gait" | "breathing" | "general";

function modeLabel(m: VideoMode) {
  if (m === "behavior") return "Comportamento";
  if (m === "gait") return "Andatura";
  if (m === "breathing") return "Respiro";
  return "Generale";
}

async function extractFrames(file: File, frameCount: number) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossibile leggere il video"));
    });

    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Durata video non valida");

    const w = Math.min(960, video.videoWidth || 960);
    const h = Math.min(540, video.videoHeight || 540);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile");

    const frames: string[] = [];
    for (let i = 0; i < frameCount; i += 1) {
      const t = ((i + 1) / (frameCount + 1)) * duration;
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        const onErr = () => reject(new Error("Errore seek video"));
        video.addEventListener("seeked", onSeeked);
        video.currentTime = t;
        video.onerror = onErr;
      });
      ctx.drawImage(video, 0, 0, w, h);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Video() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const pushToast = useToastStore((s) => s.push);

  const [aiAllowed, setAiAllowed] = useState(true);
  const [mode, setMode] = useState<VideoMode>("behavior");
  const [notes, setNotes] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);

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
    if (!activePetId) return;
    if (frames.length === 0) {
      pushToast({ type: "error", title: "Frame mancanti", message: "Seleziona un video e attendi l’estrazione frame." });
      return;
    }
    setAiLoading(true);
    setAiText(null);
    try {
      const prompt = [
        "Sei LifePet AI.",
        "Ti verranno forniti alcuni frame estratti da un breve video.",
        "Rispondi in italiano.",
        "NON fare diagnosi e NON prescrivere farmaci.",
        "Restituisci: 1) Osservazioni sul comportamento/movimento, 2) Cosa monitorare 24-48h, 3) Segnali di allarme (contatta vet), 4) Come registrare un video migliore.",
        `Categoria: ${modeLabel(mode)}.`,
        pet
          ? `Pet: ${JSON.stringify({ species: pet.species, breed: pet.breed, weightKg: pet.weightKg, allergies: pet.healthProfile?.allergies, conditions: pet.healthProfile?.conditions })}`
          : "",
        notes.trim() ? `Note proprietario: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await aiVisionAnalyzeMulti(activePetId, frames.slice(0, 6), prompt);
      setAiText(res.answer);
    } catch (e) {
      setAiText(aiUserMessage(e));
      pushToast({ type: "error", title: "Errore AI", message: aiUserMessage(e) });
    } finally {
      setAiLoading(false);
    }
  }

  async function saveToHealth() {
    if (!user || user.isDemo || !activePetId || !videoFile || !aiText) return;
    setSavingToHealth(true);
    try {
      if (videoFile.size > 10 * 1024 * 1024) {
        pushToast({ type: "error", title: "File troppo grande", message: "Massimo 10MB." });
        return;
      }
      const uploaded = await uploadPetDocument(activePetId, user.uid, videoFile);
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type: "symptom",
        title: `AI video: ${modeLabel(mode)}`,
        note: [notes.trim() ? `Note: ${notes.trim()}` : null, aiText ? `AI:\n${aiText}` : null].filter(Boolean).join("\n\n") || undefined,
        occurredAt: Date.now(),
        createdAt: Date.now(),
        createdBy: user.uid,
        severity: "low",
        attachments: [{ name: videoFile.name, storagePath: uploaded.storagePath, docId: uploaded.docId }],
      });
      pushToast({ type: "success", title: "Salvato", message: "Evento creato in Salute." });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
    } finally {
      setSavingToHealth(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analisi Video AI" description="Supporto informativo per comportamento e movimento." />

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare l’analisi video." />
      ) : !aiAllowed ? (
        <EmptyState title="AI disattivata" description="Riattivala in Impostazioni → Preferenze per usare Analisi Video AI." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Carica video</CardTitle>
            <CardDescription>Non è una diagnosi. Per segnali seri contatta il veterinario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <label className="md:col-span-3 block">
                <div className="text-xs text-slate-600 mb-1">Categoria</div>
                <select value={mode} onChange={(e) => setMode(e.target.value as VideoMode)} className="lp-select">
                  <option value="behavior">Comportamento</option>
                  <option value="gait">Andatura</option>
                  <option value="breathing">Respiro</option>
                  <option value="general">Generale</option>
                </select>
              </label>

              <label className="md:col-span-6 block">
                <div className="text-xs text-slate-600 mb-1">Note (opzionale)</div>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="lp-input" placeholder="Da quanto? quando succede? durata?" />
              </label>

              <label className="md:col-span-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm hover:bg-white cursor-pointer inline-flex items-center justify-center gap-2">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={extracting || aiLoading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > 10 * 1024 * 1024) {
                      pushToast({ type: "error", title: "File troppo grande", message: "Massimo 10MB." });
                      e.target.value = "";
                      setVideoFile(null);
                      setAiText(null);
                      setFrames([]);
                      return;
                    }
                    setVideoFile(f);
                    setAiText(null);
                    setFrames([]);
                    if (!f) return;
                    setExtracting(true);
                    try {
                      const extracted = await extractFrames(f, 4);
                      setFrames(extracted);
                    } catch (err) {
                      setAiText(aiUserMessage(err));
                      pushToast({ type: "error", title: "Errore", message: aiUserMessage(err) });
                    } finally {
                      setExtracting(false);
                    }
                  }}
                />
                <Film className="w-4 h-4" />
                Seleziona video
              </label>
            </div>

            {frames.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {frames.map((f, idx) => (
                  <img key={String(idx)} src={f} alt={`Frame ${idx + 1}`} className="rounded-xl border border-slate-200/70 bg-white/70" />
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="lp-btn-primary inline-flex items-center gap-2"
                disabled={aiLoading || extracting || frames.length === 0}
                onClick={() => void analyze()}
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? "Analisi…" : "Analizza"}
              </button>

              <button
                type="button"
                className="lp-btn-secondary inline-flex items-center gap-2"
                disabled={!aiText || !videoFile || savingToHealth || !user || user.isDemo}
                onClick={() => void saveToHealth()}
              >
                <Save className="w-4 h-4" />
                {savingToHealth ? "Salvataggio…" : "Salva in Salute"}
              </button>
            </div>

            {extracting ? <div className="text-sm text-slate-600">Estrazione frame…</div> : null}
            {aiText ? <div className="lp-surface p-4 text-sm text-slate-800 whitespace-pre-wrap">{aiText}</div> : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

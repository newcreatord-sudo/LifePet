import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { createHealthEvent, deleteHealthEvent, subscribeHealthEventsRange, updateHealthEvent } from "@/data/health";
import { getPetDocumentDownloadUrl, subscribeDocuments, uploadPetDocument } from "@/data/documents";
import type { HealthEvent, HealthEventType } from "@/types";
import type { PetDocument } from "@/types";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Activity, CalendarCheck, Files, Paperclip, Pencil, Search, StickyNote, Syringe, Pill, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { deleteField } from "firebase/firestore";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { ConfirmStyles, useConfirmDialog } from "@/components/confirm";

export default function Health() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const pushToast = useToastStore((s) => s.push);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const confirmDialog = useConfirmDialog();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [rangeDays, setRangeDays] = useState("180");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<Record<HealthEventType, boolean>>({
    visit: true,
    vaccine: true,
    med: true,
    symptom: true,
    allergy: true,
    note: true,
  });

  type HealthView = "timeline" | "new" | "documents" | "sos";
  const [view, setView] = useState<HealthView>("timeline");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [type, setType] = useState<HealthEventType>("visit");
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<"referto" | "ricetta" | "vaccino" | "analisi" | "altro">("referto");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocumentAt, setUploadDocumentAt] = useState<string>("");

  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [attachExistingDocId, setAttachExistingDocId] = useState<string>("");
  const [attachEventId, setAttachEventId] = useState<string | null>(null);
  const [attachEventDocId, setAttachEventDocId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editOccurredAt, setEditOccurredAt] = useState("");
  const [editSeverity, setEditSeverity] = useState<"low" | "medium" | "high">("low");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function typeLabel(t: HealthEventType) {
    if (t === "visit") return "Visita";
    if (t === "vaccine") return "Vaccino";
    if (t === "med") return "Farmaco";
    if (t === "symptom") return "Sintomo";
    if (t === "allergy") return "Allergia";
    return "Nota";
  }

  function typeIcon(t: HealthEventType) {
    if (t === "visit") return CalendarCheck;
    if (t === "vaccine") return Syringe;
    if (t === "med") return Pill;
    if (t === "symptom") return Activity;
    if (t === "allergy") return AlertTriangle;
    return StickyNote;
  }

  function typeBadgeStyle(t: HealthEventType) {
    if (t === "visit") return { background: "rgba(var(--lp-primary),0.12)", border: "1px solid rgba(var(--lp-primary),0.22)", color: "rgb(var(--lp-primary-700))" };
    if (t === "vaccine") return { background: "rgba(var(--lp-accent-1),0.14)", border: "1px solid rgba(var(--lp-accent-1),0.26)", color: "rgb(var(--lp-ink))" };
    if (t === "med") return { background: "rgba(var(--lp-accent-2),0.14)", border: "1px solid rgba(var(--lp-accent-2),0.26)", color: "rgb(var(--lp-ink))" };
    if (t === "symptom") return { background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.22)", color: "rgb(var(--lp-ink))" };
    if (t === "allergy") return { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", color: "rgb(var(--lp-ink))" };
    return { background: "rgba(var(--lp-ink),0.06)", border: "1px solid rgba(var(--lp-ink),0.12)", color: "rgb(var(--lp-ink))" };
  }

  function severityBadgeStyle(s?: "low" | "medium" | "high") {
    if (!s) return null;
    if (s === "high") return { background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.26)", color: "rgb(var(--lp-ink))" };
    if (s === "medium") return { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", color: "rgb(var(--lp-ink))" };
    return { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "rgb(var(--lp-ink))" };
  }

  function severityLabel(s: "low" | "medium" | "high") {
    if (s === "high") return "Alta";
    if (s === "medium") return "Media";
    return "Bassa";
  }

  function validateUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) return "Massimo 10MB.";
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    const okType = type === "application/pdf" || type === "text/plain" || type.startsWith("image/");
    const okExt = name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
    if (!okType && !okExt) return "Formato non supportato (PDF, immagini, TXT).";
    return null;
  }

  function nowLocalInputValue() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function parseWhenMs(v: string) {
    const parsed = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function parseSeverity(v: string): "low" | "medium" | "high" {
    if (v === "medium" || v === "high") return v;
    return "low";
  }

  const placeholderTitle = useMemo(() => {
    if (type === "vaccine") return "Vaccino (es. rabbia)";
    if (type === "med") return "Farmaco";
    if (type === "visit") return "Visita veterinaria";
    if (type === "allergy") return "Allergia";
    if (type === "symptom") return "Sintomo";
    return "Nota";
  }, [type]);

  useEffect(() => {
    if (!activePetId || !user) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const toMs = Date.now();
    const days = Number(rangeDays);
    const fromMs = toMs - (Number.isFinite(days) && days > 0 ? days : 180) * 24 * 60 * 60 * 1000;
    setLoading(true);
    setInlineError(null);
    const unsub = subscribeHealthEventsRange(
      activePetId,
      user.uid,
      fromMs,
      toMs,
      200,
      (next) => {
        setEvents(next);
        setLoading(false);
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento eventi fallito");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [activePetId, rangeDays, user]);

  useEffect(() => {
    if (!activePetId) {
      setDocs([]);
      return;
    }
    const unsub = subscribeDocuments(activePetId, setDocs);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    setOccurredAt((v) => v || nowLocalInputValue());
    setUploadDocumentAt((v) => v || nowLocalInputValue());
  }, [activePetId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events
      .filter((e) => typeFilter[e.type])
      .filter((e) => {
        if (!needle) return true;
        return `${e.type} ${e.title} ${e.note ?? ""}`.toLowerCase().includes(needle);
      });
  }, [events, q, typeFilter]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    setSaving(true);
    setInlineError(null);
    try {
      const occurredMs = parseWhenMs(occurredAt);
      const selectedDoc = attachExistingDocId ? docs.find((d) => d.id === attachExistingDocId) ?? null : null;
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type,
        title: title.trim() || placeholderTitle,
        note: note.trim() || undefined,
        severity: type === "symptom" ? severity : undefined,
        occurredAt: occurredMs,
        createdAt: Date.now(),
        createdBy: user.uid,
        attachments: selectedDoc ? [{ name: selectedDoc.title || selectedDoc.name, storagePath: selectedDoc.storagePath, docId: selectedDoc.id }] : undefined,
      });
      setTitle("");
      setNote("");
      setOccurredAt(nowLocalInputValue());
      setSeverity("low");
      setAttachExistingDocId("");
      pushToast({ type: "success", title: "Evento aggiunto", message: "Salvato in cartella clinica." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Creazione evento fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione evento fallita" });
    } finally {
      setSaving(false);
    }
  }

  async function onUploadPrescription(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activePetId) return;
    const validation = validateUpload(file);
    if (validation) {
      pushToast({ type: "error", title: "File non valido", message: validation });
      e.target.value = "";
      return;
    }
    setUploading(true);
    setInlineError(null);
    try {
      const when = parseWhenMs(uploadDocumentAt);
      const safeTitle = uploadTitle.trim() || "Documento clinico";
      const { docId, storagePath } = await uploadPetDocument(activePetId, user.uid, file, {
        title: safeTitle,
        docType: uploadDocType,
        documentAt: when,
        tags: ["salute"],
      });
      const eventType: HealthEventType = uploadDocType === "vaccino" ? "vaccine" : "visit";
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type: eventType,
        title: safeTitle,
        note: `Documento: ${file.name}`,
        occurredAt: when,
        createdAt: Date.now(),
        createdBy: user.uid,
        attachments: [{ name: file.name, storagePath, docId }],
      });
      e.target.value = "";
      pushToast({ type: "success", title: "Documento allegato", message: "Aggiunto alla timeline salute." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Upload fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Upload fallito" });
    } finally {
      setUploading(false);
    }
  }

  async function onUploadAttachment(ev: HealthEvent, file: File) {
    if (!user || !activePetId) return;
    const validation = validateUpload(file);
    if (validation) {
      pushToast({ type: "error", title: "File non valido", message: validation });
      return;
    }
    setUploading(true);
    setInlineError(null);
    try {
      const { docId, storagePath } = await uploadPetDocument(activePetId, user.uid, file);
      const next = [...(ev.attachments ?? []), { name: file.name, storagePath, docId }];
      await updateHealthEvent(activePetId, ev.id, { attachments: next });
      pushToast({ type: "success", title: "Allegato caricato", message: "Aggiornato evento." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Upload allegato fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Upload allegato fallito" });
    } finally {
      setUploading(false);
    }
  }

  async function onAttachExistingDoc(ev: HealthEvent, docId: string) {
    if (!user || !activePetId) return;
    const docMeta = docs.find((d) => d.id === docId) ?? null;
    if (!docMeta) return;
    const next = [...(ev.attachments ?? [])];
    if (next.some((a) => a.storagePath === docMeta.storagePath)) return;
    next.push({ name: docMeta.title || docMeta.name, storagePath: docMeta.storagePath, docId: docMeta.id });
    setUploading(true);
    setInlineError(null);
    try {
      await updateHealthEvent(activePetId, ev.id, { attachments: next });
      pushToast({ type: "success", title: "Documento collegato", message: "Aggiornato evento." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Collegamento fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Collegamento fallito" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6" spellCheck={false}>
      <PageHeader
        title="Salute"
        description="Cartella clinica del pet: timeline eventi, documenti e promemoria salute."
        imagePrompt="minimal clean illustration, stethoscope and medical card UI for pet health, white background, accent color, premium, no text, no watermark"
        imageAlt="Salute"
        actions={
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            onClick={() => {
              if (!activePet) {
                pushToast({ type: "info", title: "AI", message: "Seleziona un pet per usare l’AI in modo contestuale." });
                return;
              }
              openWithDraft(
                `Pet: ${activePet.name}. Aiutami a monitorare la salute: proponi una checklist giornaliera + segnali di allarme + 5 domande per capire urgenza. Se utile, suggerisci anche 3 task nel planner.`
              );
            }}
          >
            <Sparkles className="w-4 h-4" />
            AI salute
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={view === "timeline" ? "lp-chip lp-chip-active" : "lp-chip"}
          style={view === "timeline" ? { background: "linear-gradient(135deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-2)) 100%)" } : undefined}
          onClick={() => setView("timeline")}
        >
          Timeline
        </button>
        <button
          type="button"
          className={view === "new" ? "lp-chip lp-chip-active" : "lp-chip"}
          style={view === "new" ? { background: "linear-gradient(135deg, rgb(var(--lp-accent-1)) 0%, rgb(var(--lp-primary)) 100%)" } : undefined}
          onClick={() => setView("new")}
        >
          Nuovo evento
        </button>
        <button
          type="button"
          className={view === "documents" ? "lp-chip lp-chip-active" : "lp-chip"}
          style={view === "documents" ? { background: "linear-gradient(135deg, rgb(var(--lp-accent-2)) 0%, rgb(var(--lp-accent-1)) 100%)" } : undefined}
          onClick={() => setView("documents")}
        >
          Documenti
        </button>
        <button
          type="button"
          className={view === "sos" ? "lp-chip lp-chip-active" : "lp-chip"}
          style={view === "sos" ? { background: "linear-gradient(135deg, rgba(244,63,94,0.85) 0%, rgb(var(--lp-accent-2)) 100%)" } : undefined}
          onClick={() => setView("sos")}
        >
          Vet SOS
        </button>
      </div>

      {!activePetId ? (
        <EmptyState
          title="Seleziona un pet"
          description="La pagina Salute usa il profilo del tuo animale. Crea o seleziona un pet per continuare."
          action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
        />
      ) : view === "new" ? (
        <Card className="relative overflow-hidden">
          <div className="lp-card-accent" aria-hidden="true" />
          <CardHeader>
            <CardTitle>Aggiungi evento</CardTitle>
            <CardDescription>Registra visite, vaccini, farmaci e sintomi in modo semplice.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAdd} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["visit", "Visita"],
                    ["vaccine", "Vaccino"],
                    ["med", "Farmaco"],
                    ["symptom", "Sintomo"],
                    ["allergy", "Allergia"],
                    ["note", "Nota"],
                  ] as const
                ).map(([k, label]) => {
                  const active = type === k;
                  const Icon = typeIcon(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className={active ? "lp-chip lp-chip-active" : "lp-chip"}
                      style={active ? typeBadgeStyle(k) : undefined}
                      onClick={() => {
                        setType(k);
                        setTitle("");
                        setSeverity(k === "symptom" ? "medium" : "low");
                        setOccurredAt(nowLocalInputValue());
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <label className="lg:col-span-5 block">
                  <div className="text-xs lp-muted mb-1">Titolo</div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholderTitle} className="lp-input" />
                </label>
                <label className="lg:col-span-4 block">
                  <div className="text-xs lp-muted mb-1">Quando</div>
                  <div className="flex items-center gap-2">
                    <input value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} type="datetime-local" className="lp-input" />
                    <button type="button" className="lp-btn-secondary whitespace-nowrap" onClick={() => setOccurredAt(nowLocalInputValue())}>
                      Ora
                    </button>
                  </div>
                </label>
                <label className="lg:col-span-3 block">
                  <div className="text-xs lp-muted mb-1">Gravità</div>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")} disabled={type !== "symptom"} className="lp-select disabled:opacity-60">
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
                <label className="lg:col-span-12 block">
                  <div className="text-xs lp-muted mb-1">Note</div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="lp-textarea" placeholder="Aggiungi dettagli utili (es. sintomi, dosi, esito visita)…" />
                </label>

                <label className="lg:col-span-12 block">
                  <div className="text-xs lp-muted mb-1">Allega documento esistente (opzionale)</div>
                  <select value={attachExistingDocId} onChange={(e) => setAttachExistingDocId(e.target.value)} className="lp-select">
                    <option value="">Nessun allegato</option>
                    {docs
                      .filter((d) => d.uploadStatus !== "failed")
                      .slice(0, 50)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {(d.title || d.name).slice(0, 60)}
                          {d.docType ? ` · ${d.docType}` : ""}
                          {typeof d.documentAt === "number" ? ` · ${new Date(d.documentAt).toLocaleDateString()}` : ""}
                        </option>
                      ))}
                  </select>
                  <div className="mt-1 text-[11px] lp-muted">Consiglio: usa titoli brevi e una data documento per ritrovare tutto subito.</div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Salvataggio automatico in cartella clinica.</div>
                <button type="submit" disabled={saving} className="lp-btn-primary">
                  {saving ? "…" : "Aggiungi"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : view === "documents" ? (
        <Card className="relative overflow-hidden">
          <div className="lp-card-accent" aria-hidden="true" />
          <CardHeader>
            <CardTitle>Carica documento</CardTitle>
            <CardDescription>Carica referti e ricette: creeremo anche un evento in timeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <label className="lg:col-span-3 block">
                  <div className="text-xs lp-muted mb-1">Tipo documento</div>
                  <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value as typeof uploadDocType)} className="lp-select" data-testid="health-upload-doc-type">
                    <option value="referto">Referto</option>
                    <option value="ricetta">Ricetta</option>
                    <option value="vaccino">Vaccino</option>
                    <option value="analisi">Analisi</option>
                    <option value="altro">Altro</option>
                  </select>
                </label>
                <label className="lg:col-span-6 block">
                  <div className="text-xs lp-muted mb-1">Titolo</div>
                  <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Es. Analisi sangue, Vaccino rabbia…" className="lp-input" />
                </label>
                <label className="lg:col-span-3 block">
                  <div className="text-xs lp-muted mb-1">Data documento</div>
                  <div className="flex items-center gap-2">
                    <input value={uploadDocumentAt} onChange={(e) => setUploadDocumentAt(e.target.value)} type="datetime-local" className="lp-input" />
                    <button type="button" className="lp-btn-secondary whitespace-nowrap" onClick={() => setUploadDocumentAt(nowLocalInputValue())}>
                      Ora
                    </button>
                  </div>
                </label>
                <div className="lg:col-span-12">
                  <input type="file" onChange={onUploadPrescription} disabled={uploading} className="lp-file-input" data-testid="health-upload-file" />
                  <div className="mt-1 text-xs lp-muted">Formati: PDF, immagini, TXT. Max 10MB.</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs lp-muted">Suggerimento: puoi gestire e cercare tutti i documenti nella sezione dedicata.</div>
                <Link to="/app/documents" className="lp-btn-secondary inline-flex items-center gap-2">
                  <Files className="w-4 h-4" />
                  Apri Documenti
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : view === "sos" ? (
        <Card className="relative overflow-hidden">
          <div className="lp-card-accent" aria-hidden="true" />
          <CardHeader>
            <CardTitle>Vet SOS</CardTitle>
            <CardDescription>Contatti rapidi e azioni in emergenza.</CardDescription>
          </CardHeader>
          <CardContent>
            {!activePet ? (
              <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere i contatti del veterinario." action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Clinica</div>
                  <div className="text-sm font-medium">{activePet.vetContact?.clinicName ?? "—"}</div>
                  <div className="text-xs lp-muted mt-2">Telefono</div>
                  <div className="text-sm font-medium">{activePet.vetContact?.phone ?? "—"}</div>
                  <div className="text-xs lp-muted mt-2">Emergenza</div>
                  <div className="text-sm font-medium">{activePet.vetContact?.emergencyPhone ?? "—"}</div>
                </div>
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Azioni rapide</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {activePet.vetContact?.emergencyPhone ? (
                      <a href={`tel:${activePet.vetContact.emergencyPhone}`} className="lp-btn-primary text-center" style={ConfirmStyles.dangerButtonStyle}>
                        Chiama emergenza
                      </a>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm lp-muted">Aggiungi il numero in Profilo Pet.</div>
                        <Link to="/app/pets" className="lp-btn-secondary text-center">
                          Modifica contatti
                        </Link>
                      </div>
                    )}
                    {activePet.vetContact?.phone ? (
                      <a href={`tel:${activePet.vetContact.phone}`} className="lp-btn-secondary text-center">
                        Chiama clinica
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 text-xs lp-muted">Se grave: difficoltà respiratoria, collasso, convulsioni, sanguinamento → emergenza.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="relative overflow-hidden">
          <div className="lp-card-accent" aria-hidden="true" />
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Eventi clinici in ordine: cerca e filtra quando ti serve.</CardDescription>
          </CardHeader>
          <CardContent>
            {inlineError ? <Alert variant="danger" title="Errore">{inlineError}</Alert> : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <div className="text-xs lp-muted mb-1">Cerca</div>
                <div className="flex items-center gap-2 lp-panel px-3 py-2">
                  <Search className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="titolo, note…" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>
              <div className="lg:col-span-3">
                <div className="text-xs lp-muted mb-1">Periodo</div>
                <select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="lp-select">
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="180">Ultimi 180 giorni</option>
                  <option value="365">Ultimo anno</option>
                </select>
              </div>
              <div className="lg:col-span-3">
                <button type="button" className="lp-btn-secondary w-full" onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? "Nascondi filtri" : "Filtri"}
                </button>
              </div>
            </div>

            {filtersOpen ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["visit", "Visite"],
                    ["vaccine", "Vaccini"],
                    ["med", "Farmaci"],
                    ["symptom", "Sintomi"],
                    ["allergy", "Allergie"],
                    ["note", "Note"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTypeFilter((s) => ({ ...s, [k]: !s[k] }))}
                    className={typeFilter[k] ? "lp-chip lp-chip-active" : "lp-chip"}
                    style={typeFilter[k] ? typeBadgeStyle(k) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {(() => {
                        const I = typeIcon(k);
                        return <I className="w-3.5 h-3.5" />;
                      })()}
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Eventi nel periodo</div>
                <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{filtered.length}</div>
                <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Dopo filtri e ricerca</div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Allegati</div>
                <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{filtered.reduce((sum, e) => sum + (e.attachments?.length || 0), 0)}</div>
                <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>PDF / foto / referti</div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Collegamenti</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link to={{ pathname: "/app/planner", search: activePetId ? `?petId=${encodeURIComponent(activePetId)}` : "" }} className="lp-chip">
                    Crea task
                  </Link>
                  <Link to={{ pathname: "/app/documents", search: activePetId ? `?petId=${encodeURIComponent(activePetId)}` : "" }} className="lp-chip">
                    Apri documenti
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState title="Nessun evento" description="Aggiungi il primo evento o carica un referto." />
              ) : (
                <div className="space-y-2">
                  {filtered.map((ev) => (
                    <div key={ev.id} className="lp-panel px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {editingId === ev.id ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!activePetId) return;
                                setSavingEdit(true);
                                try {
                                  const parsed = editOccurredAt ? new Date(editOccurredAt).getTime() : undefined;
                                  const when = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : ev.occurredAt;
                                  await updateHealthEvent(activePetId, ev.id, {
                                    title: editTitle.trim() || ev.title,
                                    note: editNote.trim() ? editNote.trim() : deleteField(),
                                    occurredAt: when,
                                    severity: ev.type === "symptom" ? editSeverity : deleteField(),
                                  });
                                  setEditingId(null);
                                  pushToast({ type: "success", title: "Evento aggiornato", message: "Salvataggio completato." });
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
                                } finally {
                                  setSavingEdit(false);
                                }
                              }}
                              className="space-y-2"
                            >
                              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="lp-input" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input value={editOccurredAt} onChange={(e) => setEditOccurredAt(e.target.value)} type="datetime-local" className="lp-input" />
                                <select value={editSeverity} onChange={(e) => setEditSeverity(parseSeverity(e.target.value))} disabled={ev.type !== "symptom"} className="lp-select disabled:opacity-60">
                                  <option value="low">Bassa</option>
                                  <option value="medium">Media</option>
                                  <option value="high">Alta</option>
                                </select>
                              </div>
                              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} className="lp-textarea" />
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setEditingId(null)} className="lp-btn-secondary">
                                  Annulla
                                </button>
                                <button type="submit" disabled={savingEdit} className="lp-btn-primary">
                                  {savingEdit ? "…" : "Salva"}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs" style={typeBadgeStyle(ev.type)}>
                                  {(() => {
                                    const I = typeIcon(ev.type);
                                    return <I className="w-3.5 h-3.5" />;
                                  })()}
                                  {typeLabel(ev.type)}
                                </span>
                                {ev.type === "symptom" && ev.severity ? (
                                  <span className="rounded-full px-2.5 py-1 text-xs" style={severityBadgeStyle(ev.severity) ?? undefined}>
                                    Gravità: {severityLabel(ev.severity)}
                                  </span>
                                ) : null}
                                <span className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>{new Date(ev.occurredAt).toLocaleString()}</span>
                              </div>
                              <div className="text-sm font-medium mt-1">{ev.title}</div>
                              {ev.note ? (
                                <div className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "rgb(var(--lp-ink))" }}>{ev.note}</div>
                              ) : null}
                            </>
                          )}

                          {ev.attachments && ev.attachments.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {ev.attachments.map((a) => (
                                <button
                                  key={`${ev.id}:${a.storagePath}`}
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const url = await getPetDocumentDownloadUrl(a.storagePath);
                                      window.open(url, "_blank", "noopener,noreferrer");
                                    } catch (err) {
                                      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Apertura allegato fallita" });
                                    }
                                  }}
                                  className="lp-btn-icon"
                                >
                                  Apri: {a.name}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {editingId !== ev.id && activePetId ? (
                            <div className="mt-2 flex items-center gap-2">
                              <label className="lp-btn-icon inline-flex items-center gap-2 cursor-pointer">
                                <Paperclip className="w-4 h-4" />
                                Allega
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    void onUploadAttachment(ev, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className="lp-btn-icon"
                                onClick={() => {
                                  setAttachEventId(ev.id);
                                  setAttachEventDocId("");
                                }}
                              >
                                Collega documento
                              </button>
                            </div>
                          ) : null}

                          {attachEventId === ev.id ? (
                            <div className="mt-2 lp-card p-3">
                              <div className="text-xs lp-muted mb-1">Seleziona documento</div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select value={attachEventDocId} onChange={(e) => setAttachEventDocId(e.target.value)} className="lp-select flex-1">
                                  <option value="">Scegli…</option>
                                  {docs
                                    .filter((d) => d.uploadStatus !== "failed")
                                    .slice(0, 50)
                                    .map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {(d.title || d.name).slice(0, 60)}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  className="lp-btn-primary"
                                  disabled={!attachEventDocId || uploading}
                                  onClick={async () => {
                                    if (!attachEventDocId) return;
                                    await onAttachExistingDoc(ev, attachEventDocId);
                                    setAttachEventId(null);
                                    setAttachEventDocId("");
                                  }}
                                >
                                  Collega
                                </button>
                                <button
                                  type="button"
                                  className="lp-btn-secondary"
                                  onClick={() => {
                                    setAttachEventId(null);
                                    setAttachEventDocId("");
                                  }}
                                >
                                  Annulla
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingId !== ev.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(ev.id);
                                  setEditTitle(ev.title);
                                  setEditNote(ev.note ?? "");
                                  setEditOccurredAt(new Date(ev.occurredAt).toISOString().slice(0, 16));
                                  setEditSeverity(ev.severity ?? "low");
                                }}
                                className="lp-btn-icon"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activePetId) return;
                                  if (deletingId) return;
                                  const ok = await confirmDialog({
                                    title: "Elimina evento",
                                    description: "Vuoi eliminare questo evento salute?",
                                    confirmLabel: "Elimina",
                                    variant: "danger",
                                  });
                                  if (!ok) return;
                                  setDeletingId(ev.id);
                                  setInlineError(null);
                                  try {
                                    await deleteHealthEvent(activePetId, ev.id);
                                    pushToast({ type: "success", title: "Evento eliminato", message: "Rimosso." });
                                  } catch (err) {
                                    setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
                                    pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
                                  } finally {
                                    setDeletingId(null);
                                  }
                                }}
                                className="lp-btn-icon"
                                disabled={deletingId === ev.id}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

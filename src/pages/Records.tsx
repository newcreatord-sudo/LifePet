import { useEffect, useMemo, useState } from "react";
import { Crown, FileText, HeartPulse, ListTodo, NotebookPen, Paperclip, Pencil, Search, ShieldPlus, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { subscribeRecentHealthEvents } from "@/data/health";
import { deleteLog, subscribeLogsRange, updateLog } from "@/data/logs";
import { subscribeDocuments, uploadPetDocument, getPetDocumentDownloadUrl } from "@/data/documents";
import { subscribeTasks } from "@/data/tasks";
import type { HealthEvent, PetDocument, PetLog, PetTask } from "@/types";
import { exportPetData } from "@/data/export";
import { createRecordsShare } from "@/data/recordsShare";
import { useToastStore } from "@/stores/toastStore";
import { deleteField } from "firebase/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Link, useLocation } from "react-router-dom";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { useConfirmDialog } from "@/components/confirm";
import { docEffectiveAt, docTypeLabel } from "@/lib/documentsUi";

type ItemKind = "health" | "log" | "doc" | "task";

type TimelineItem = {
  kind: ItemKind;
  id: string;
  ts: number;
  title: string;
  subtitle?: string;
  note?: string;
  valueText?: string;
  attachment?: { name: string; storagePath: string };
};

function iconFor(kind: ItemKind) {
  if (kind === "health") return ShieldPlus;
  if (kind === "log") return NotebookPen;
  if (kind === "task") return ListTodo;
  return FileText;
}

function labelForLogType(type: string) {
  if (type === "symptom") return "Sintomo";
  if (type === "weight") return "Peso";
  if (type === "med") return "Farmaco";
  if (type === "vet") return "Veterinario";
  if (type === "food") return "Cibo";
  if (type === "water") return "Acqua";
  if (type === "activity") return "Attività";
  return type.toUpperCase();
}

function logValueText(l: PetLog) {
  const v = l.value;
  if (!v) return null;
  if (typeof v.amount !== "number" || !Number.isFinite(v.amount)) return null;
  if (!v.unit) return String(v.amount);
  return `${v.amount} ${v.unit}`;
}

function fileNameFromStoragePath(path: string) {
  const last = path.split("/").pop() || path;
  const idx = last.indexOf("_");
  return idx > 0 ? last.slice(idx + 1) : last;
}

function docSizeText(size?: number) {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "—";
  return `${(size / 1024).toFixed(0)} KB`;
}

function docTagsText(tags?: string[]) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (list.length === 0) return "";
  const shown = list.slice(0, 4).map((t) => `#${t}`);
  return ` · ${shown.join(" ")}`;
}

export default function Records() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const confirmDialog = useConfirmDialog();
  const location = useLocation();
  const [health, setHealth] = useState<HealthEvent[]>([]);
  const [logs, setLogs] = useState<PetLog[]>([]);
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Record<ItemKind, boolean>>({ health: true, log: true, doc: true, task: false });
  const [logTypeFilter, setLogTypeFilter] = useState<Record<string, boolean>>({
    symptom: true,
    weight: true,
    med: true,
    vet: true,
    food: true,
    water: true,
    activity: true,
  });
  const [rangeDays, setRangeDays] = useState("180");

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ exporting: boolean; sharing: boolean; fileForId: string | null }>({
    exporting: false,
    sharing: false,
    fileForId: null,
  });
  const [loaded, setLoaded] = useState({ health: false, logs: false, docs: false, tasks: false });

  const [shareOpen, setShareOpen] = useState(false);
  const [shareHours, setShareHours] = useState("24");
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("share") !== "1") return;
    if (!user || user.isDemo || !activePetId) return;
    setShareLink(null);
    setShareHours("24");
    setShareOpen(true);
  }, [activePetId, location.search, user]);

  const [editLogOpen, setEditLogOpen] = useState(false);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [editLogNote, setEditLogNote] = useState("");
  const [editLogAmount, setEditLogAmount] = useState("");

  const range = useMemo(() => {
    const toMs = Date.now();
    const days = Number(rangeDays);
    const fromMs = toMs - (Number.isFinite(days) && days > 0 ? days : 180) * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
  }, [rangeDays]);

  useEffect(() => {
    if (!activePetId || !user) {
      setHealth([]);
      setLoaded((s) => ({ ...s, health: false }));
      return;
    }
    setLoaded((s) => ({ ...s, health: false }));
    const unsub = subscribeRecentHealthEvents(activePetId, user.uid, 80, (items) => {
      setHealth(items);
      setLoaded((s) => ({ ...s, health: true }));
    });
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId || !user) {
      setLogs([]);
      setLoaded((s) => ({ ...s, logs: false }));
      return;
    }
    setLoaded((s) => ({ ...s, logs: false }));
    const unsub = subscribeLogsRange(activePetId, user.uid, range.fromMs, range.toMs, (items) => {
      setLogs(items);
      setLoaded((s) => ({ ...s, logs: true }));
    });
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs, user]);

  useEffect(() => {
    if (!activePetId) {
      setDocs([]);
      setLoaded((s) => ({ ...s, docs: false }));
      return;
    }
    setLoaded((s) => ({ ...s, docs: false }));
    const unsub = subscribeDocuments(activePetId, (items) => {
      setDocs(items);
      setLoaded((s) => ({ ...s, docs: true }));
    });
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId || !user) {
      setTasks([]);
      setLoaded((s) => ({ ...s, tasks: false }));
      return;
    }
    setLoaded((s) => ({ ...s, tasks: false }));
    const unsub = subscribeTasks(activePetId, user.uid, (items) => {
      setTasks(items);
      setLoaded((s) => ({ ...s, tasks: true }));
    });
    return () => unsub();
  }, [activePetId, user]);


  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const ev of health) {
      items.push({
        kind: "health",
        id: ev.id,
        ts: ev.occurredAt,
        title: ev.title,
        subtitle: `${ev.type}${ev.severity ? ` · ${ev.severity}` : ""}`,
        note: ev.note,
        attachment: ev.attachments?.[0] ? { name: ev.attachments[0].name, storagePath: ev.attachments[0].storagePath } : undefined,
      });
    }

    const logTypes = new Set(["symptom", "weight", "med", "vet", "food", "water", "activity"]);
    for (const l of logs) {
      if (!logTypes.has(l.type)) continue;
      if (!logTypeFilter[l.type]) continue;
      items.push({
        kind: "log",
        id: l.id,
        ts: l.occurredAt,
        title: labelForLogType(l.type),
        subtitle: logValueText(l) ?? new Date(l.occurredAt).toLocaleString(),
        note: l.note,
        valueText: logValueText(l) ?? undefined,
        attachment:
          l.attachmentPaths && l.attachmentPaths.length
            ? { name: fileNameFromStoragePath(l.attachmentPaths[0]), storagePath: l.attachmentPaths[0] }
            : undefined,
      });
    }

    for (const d of docs) {
      items.push({
        kind: "doc",
        id: d.id,
        ts: docEffectiveAt(d),
        title: d.title ? d.title : d.name,
        subtitle: `${d.docType ? docTypeLabel(d.docType) : "Documento"}${d.isFavorite ? " · ★" : ""} · ${docSizeText(d.size)} · ${new Date(docEffectiveAt(d)).toLocaleDateString()}${docTagsText(d.tags)}`,
        attachment: { name: d.name, storagePath: d.storagePath },
      });
    }

    for (const t of tasks) {
      if (!t.dueAt && !t.completedAt) continue;
      items.push({
        kind: "task",
        id: t.id,
        ts: t.completedAt ?? t.dueAt ?? t.createdAt,
        title: t.title,
        subtitle: `Task · ${t.status === "done" ? "completato" : "da fare"}`,
      });
    }

    const needle = q.trim().toLowerCase();
    return items
      .filter((it) => show[it.kind])
      .filter((it) => it.ts >= range.fromMs && it.ts <= range.toMs)
      .filter((it) => {
        if (!needle) return true;
        return `${it.title} ${it.subtitle ?? ""} ${it.note ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200);
  }, [docs, health, logTypeFilter, logs, q, range.fromMs, range.toMs, show, tasks]);

  const canExport = Boolean(user && !user.isDemo);

  async function submitShare() {
    if (!user || user.isDemo || !activePetId) return;
    const hours = Number(String(shareHours).replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      pushToast({ type: "error", title: "Condivisione", message: "Inserisci un numero tra 1 e 168." });
      return;
    }
    const expiresAt = Date.now() + Math.round(hours * 60 * 60 * 1000);
    const withAttachments = timeline.map((t) =>
      t.attachment
        ? {
            kind: t.kind,
            ts: t.ts,
            title: t.title,
            subtitle: t.subtitle,
            note: t.note,
            attachment: { name: t.attachment.name, storagePath: t.attachment.storagePath },
          }
        : { kind: t.kind, ts: t.ts, title: t.title, subtitle: t.subtitle, note: t.note }
    );
    setInlineError(null);
    setBusy((s) => ({ ...s, sharing: true }));
    try {
      const token = await createRecordsShare({
        ownerId: user.uid,
        petId: activePetId,
        createdAt: Date.now(),
        expiresAt,
        range,
        items: withAttachments,
      });
      const url = `${window.location.origin}/share/${token}`;
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        pushToast({ type: "success", title: "Condivisione", message: "Link copiato." });
      } catch {
        pushToast({ type: "info", title: "Condivisione", message: "Link generato." });
      }
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Creazione link fallita");
      pushToast({ type: "error", title: "Condivisione", message: e instanceof Error ? e.message : "Creazione link fallita" });
    } finally {
      setBusy((s) => ({ ...s, sharing: false }));
    }
  }

  async function submitEditLog() {
    if (!user || user.isDemo || !activePetId || !editLogId) return;
    const l = logs.find((x) => x.id === editLogId);
    if (!l) return;
    const nextNote = editLogNote.trim();
    let nextValue = l.value;
    if (l.type === "water" || l.type === "food" || l.type === "activity" || l.type === "weight") {
      const v = editLogAmount.trim();
      if (!v) {
        nextValue = undefined;
      } else {
        const n = Number(v.replace(",", "."));
        if (Number.isFinite(n) && n > 0) {
          const unit = l.type === "water" ? "ml" : l.type === "food" ? "g" : l.type === "activity" ? "min" : "kg";
          nextValue = { amount: n, unit };
        }
      }
    }
    setInlineError(null);
    try {
      await updateLog(activePetId, l.id, {
        note: nextNote ? nextNote : deleteField(),
        value: nextValue ? nextValue : deleteField(),
      });
      setEditLogOpen(false);
      pushToast({ type: "success", title: "Log", message: "Aggiornato." });
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Aggiornamento fallito");
      pushToast({ type: "error", title: "Log", message: e instanceof Error ? e.message : "Aggiornamento fallito" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartella clinica"
        description="Timeline unificata: salute, log, documenti (task opzionali)."
        imagePrompt="minimal clean illustration, medical timeline cards and document thumbnails for a pet health record, white background, accent color, premium, no text, no watermark"
        imageAlt="Cartella clinica"
        actions={
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            onClick={() => openWithDraft("Riassumi la cartella clinica in modo pratico: 1) cosa è successo 2) cosa monitorare 3) prossimi passi e task. Se mancano dati, dimmi cosa aggiungere.")}
            disabled={!activePetId}
          >
            <Sparkles className="w-4 h-4" />
            AI riepilogo
          </button>
        }
      />

      <Modal
        open={shareOpen}
        title="Condividi cartella"
        description="Crea un link in sola lettura (con scadenza)."
        onClose={() => setShareOpen(false)}
      >
        <div className="grid gap-3">
          <div>
            <div className="text-xs mb-1" style={{ color: "rgb(var(--lp-muted))" }}>Validità (ore, 1–168)</div>
            <input className="lp-input" inputMode="decimal" value={shareHours} onChange={(e) => setShareHours(e.target.value)} />
          </div>
          {shareLink ? (
            <div>
              <div className="text-xs mb-1" style={{ color: "rgb(var(--lp-muted))" }}>Link</div>
              <input className="lp-input" value={shareLink} readOnly />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareLink);
                      pushToast({ type: "success", title: "Condivisione", message: "Copiato." });
                    } catch {
                      pushToast({ type: "error", title: "Condivisione", message: "Copia non disponibile." });
                    }
                  }}
                >
                  Copia
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setShareOpen(false)}>
              Chiudi
            </button>
            <button type="button" className="lp-btn-primary" onClick={submitShare} disabled={!canExport || !activePetId || busy.sharing}>
              {busy.sharing ? "Creo…" : "Genera"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editLogOpen} title="Modifica log" description="Aggiorna nota e valore." onClose={() => setEditLogOpen(false)}>
        <div className="grid gap-3">
          <div>
            <div className="text-xs mb-1" style={{ color: "rgb(var(--lp-muted))" }}>Nota</div>
            <textarea className="lp-textarea min-h-[90px]" value={editLogNote} onChange={(e) => setEditLogNote(e.target.value)} />
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: "rgb(var(--lp-muted))" }}>Valore (opz.)</div>
            <input className="lp-input" inputMode="decimal" value={editLogAmount} onChange={(e) => setEditLogAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setEditLogOpen(false)}>Annulla</button>
            <button type="button" className="lp-btn-primary" onClick={submitEditLog}>Salva</button>
          </div>
        </div>
      </Modal>

      {!activePetId ? (
        <EmptyState
          title="Seleziona un pet"
          description="Scegli un profilo per vedere la cartella clinica."
          action={
            <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center justify-center">
              Vai al profilo pet
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4 lg:sticky lg:top-24 h-fit relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Filtri</CardTitle>
                  <CardDescription>Trova rapidamente un evento, un documento o un log.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
            {inlineError ? (
              <div className="mb-3">
                <Alert variant="danger" title="Errore">{inlineError}</Alert>
              </div>
            ) : null}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <div className="text-xs lp-muted mb-1">Cerca</div>
                <div className="flex items-center gap-2 lp-panel px-3 py-2">
                  <Search className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="tipo, titolo, note…"
                    className="w-full bg-transparent outline-none text-sm"
                  />
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
              <div className="lg:col-span-3 flex flex-wrap gap-2">
                {(
                  [
                    ["health", "Salute"],
                    ["log", "Log"],
                    ["doc", "Documenti"],
                    ["task", "Task"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                    className={show[k] ? "lp-chip lp-chip-active" : "lp-chip"}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {show.log ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["symptom", "Sintomi"],
                    ["weight", "Peso"],
                    ["food", "Cibo"],
                    ["water", "Acqua"],
                    ["activity", "Attività"],
                    ["med", "Farmaci"],
                    ["vet", "Veterinario"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setLogTypeFilter((s) => ({ ...s, [k]: !s[k] }))}
                    className={logTypeFilter[k] ? "lp-chip lp-chip-active" : "lp-chip"}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-8 relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>Più recenti prima</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
                <div className="flex items-center gap-2">
                <button
                  disabled={!canExport || busy.exporting}
                  onClick={() => {
                    (async () => {
                      setInlineError(null);
                      setBusy((s) => ({ ...s, exporting: true }));
                      try {
                        const payload = await exportPetData(activePetId, range);
                        const url = (payload as { url?: string }).url;
                        if (!url) throw new Error("Export non disponibile");
                        const a = document.createElement("a");
                        a.href = url;
                        a.click();
                        pushToast({ type: "success", title: "Export", message: "Download avviato." });
                      } catch (e) {
                        setInlineError(e instanceof Error ? e.message : "Export fallito");
                        pushToast({ type: "error", title: "Export", message: e instanceof Error ? e.message : "Export fallito" });
                      } finally {
                        setBusy((s) => ({ ...s, exporting: false }));
                      }
                    })();
                  }}
                  className={canExport ? "lp-btn-primary" : "lp-btn-secondary opacity-60"}
                >
                  <span className="inline-flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Esporta
                  </span>
                </button>

                <button
                  disabled={!canExport || busy.sharing}
                  onClick={() => {
                    setShareLink(null);
                    setShareHours("24");
                    setShareOpen(true);
                  }}
                  className={canExport ? "lp-btn-secondary" : "lp-btn-secondary opacity-60"}
                >
                  Condividi
                </button>
                <div className="text-xs" style={{ color: "rgb(var(--lp-primary-700))" }}>
                  Gratis
                </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            {!loaded.health || !loaded.logs || !loaded.docs || !loaded.tasks ? (
              <div className="grid gap-2">
                <SkeletonCard rows={2} />
                <SkeletonCard rows={2} />
                <SkeletonCard rows={2} />
              </div>
            ) : timeline.length === 0 ? (
              <EmptyState title="Nessun elemento" description="Prova a cambiare filtri o ricerca." />
            ) : (
              <div className="space-y-2">
                {timeline.map((it) => {
                  const Icon = iconFor(it.kind);
                  return (
                    <div key={`${it.kind}:${it.id}`} className="lp-panel px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Icon
                              className="w-4 h-4"
                              style={it.kind === "health" ? { color: "rgb(var(--lp-primary-700))" } : { color: "rgb(var(--lp-muted))" }}
                            />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{it.title}</div>
                            <div className="text-xs lp-muted">{it.subtitle ?? it.kind}</div>
                            {it.note ? (
                              <div className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "rgb(var(--lp-ink))" }}>
                                {it.note}
                              </div>
                            ) : null}
                            {it.attachment ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const url = await getPetDocumentDownloadUrl(it.attachment!.storagePath);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  } catch (e) {
                                    setInlineError(e instanceof Error ? e.message : "Impossibile aprire allegato");
                                    pushToast({ type: "error", title: "Allegato", message: e instanceof Error ? e.message : "Impossibile aprire allegato" });
                                  }
                                }}
                                className="mt-2 lp-btn-icon"
                              >
                                Apri: {it.attachment.name}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs lp-muted whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                          {activePetId && it.kind === "log" ? (
                            <>
                              <button
                                className="lp-btn-icon"
                                onClick={async () => {
                                  if (!user || user.isDemo || !activePetId) return;
                                  const l = logs.find((x) => x.id === it.id);
                                  if (!l) return;
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = "application/pdf,image/*";
                                  input.onchange = async () => {
                                    const f = input.files?.[0];
                                    if (!f) return;
                                    setBusy((s) => ({ ...s, fileForId: l.id }));
                                    setInlineError(null);
                                    try {
                                      const uploaded = await uploadPetDocument(activePetId, user.uid, f);
                                      const next = Array.from(new Set([...(l.attachmentPaths ?? []), uploaded.storagePath]));
                                      await updateLog(activePetId, l.id, { attachmentPaths: next });
                                      pushToast({ type: "success", title: "Allegato", message: "Caricato." });
                                    } catch (e) {
                                      setInlineError(e instanceof Error ? e.message : "Upload fallito");
                                      pushToast({ type: "error", title: "Allegato", message: e instanceof Error ? e.message : "Upload fallito" });
                                    } finally {
                                      setBusy((s) => ({ ...s, fileForId: null }));
                                    }
                                  };
                                  input.click();
                                }}
                                disabled={busy.fileForId === it.id}
                              >
                                <Paperclip className="w-4 h-4" />
                              </button>
                              <button
                                className="lp-btn-icon"
                                onClick={() => {
                                  const l = logs.find((x) => x.id === it.id);
                                  if (!l) return;
                                  setEditLogId(l.id);
                                  setEditLogNote(l.note ?? "");
                                  const current = typeof l.value?.amount === "number" ? String(l.value.amount) : "";
                                  setEditLogAmount(current);
                                  setEditLogOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                className="lp-btn-icon"
                                onClick={async () => {
                                  const ok = await confirmDialog({
                                    title: "Elimina log",
                                    description: "Vuoi eliminare questo log dalla timeline?",
                                    confirmLabel: "Elimina",
                                    variant: "danger",
                                  });
                                  if (!ok) return;
                                  setInlineError(null);
                                  try {
                                    await deleteLog(activePetId, it.id);
                                    pushToast({ type: "success", title: "Log", message: "Eliminato." });
                                  } catch (e) {
                                    setInlineError(e instanceof Error ? e.message : "Eliminazione fallita");
                                    pushToast({ type: "error", title: "Log", message: e instanceof Error ? e.message : "Eliminazione fallita" });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-xs lp-muted">Questa vista aiuta a ricostruire storia clinica e routine. Non sostituisce il veterinario.</div>
            </CardContent>
          </Card>
          </div>
        </>
      )}
      <div className="text-xs lp-muted flex items-center gap-2">
        <HeartPulse className="w-4 h-4" />
        Suggerimento: usa Salute per gli eventi e Documenti per i file.
      </div>
    </div>
  );
}

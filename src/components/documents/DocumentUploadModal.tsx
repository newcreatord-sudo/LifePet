import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { retryPetDocumentUpload, uploadPetDocument } from "@/data/documents";
import type { PetDocument } from "@/types";

function baseTitleFromFileName(name: string) {
  const n = String(name || "");
  const idx = n.lastIndexOf(".");
  const base = idx > 0 ? n.slice(0, idx) : n;
  return base.trim() || n.trim() || "Documento";
}

function parseDateInput(v: string) {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function formatDateInput(ts?: number) {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDocType(v: string): PetDocument["docType"] | "" {
  if (v === "referto" || v === "ricetta" || v === "vaccino" || v === "analisi" || v === "altro") return v;
  return "";
}

function parseTagsInput(v: string) {
  const raw = String(v || "");
  const parts = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const cleaned = p.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned.length > 24 ? cleaned.slice(0, 24).trim() : cleaned);
    if (out.length >= 8) break;
  }
  return out;
}

export function DocumentUploadModal(props: {
  open: boolean;
  petId: string;
  userId: string;
  mode?: "new" | "retry";
  retryDocId?: string;
  retryPrevStoragePath?: string | null;
  initialMeta?: {
    title?: string;
    docType?: PetDocument["docType"];
    documentAt?: number;
    tags?: string[];
  };
  titleSuffix?: string;
  autoCloseOnSuccess?: boolean;
  busy?: boolean;
  onClose: () => void;
  onUploaded?: () => void;
  onError?: (message: string) => void;
}) {
  const { open, petId, userId, mode = "new", retryDocId, retryPrevStoragePath, initialMeta, titleSuffix, autoCloseOnSuccess = true, busy, onClose, onUploaded, onError } = props;
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<PetDocument["docType"] | "">("");
  const [docDate, setDocDate] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [progress, setProgress] = useState<{ percent: number; bytes: number; total: number } | null>(null);

  const maxBytes = 10 * 1024 * 1024;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle(String(initialMeta?.title || ""));
    setDocType(initialMeta?.docType ? initialMeta.docType : "");
    setDocDate(formatDateInput(initialMeta?.documentAt));
    setTagsText(Array.isArray(initialMeta?.tags) && initialMeta.tags.length ? initialMeta.tags.join(", ") : "");
    setProgress(null);
  }, [initialMeta, open]);

  const sizeError = useMemo(() => {
    if (!file) return null;
    if (file.size <= maxBytes) return null;
    return "Massimo 10MB.";
  }, [file, maxBytes]);

  const isBusy = Boolean(busy || submitting);
  const canSubmit = Boolean(open && file && !sizeError && !isBusy);

  async function onSubmit() {
    if (!file || !canSubmit) return;
    try {
      setSubmitting(true);
      setProgress({ percent: 0, bytes: 0, total: file.size || 0 });
      const t = title.trim() || baseTitleFromFileName(file.name);
      const documentAt = parseDateInput(docDate);
      const tags = parseTagsInput(tagsText);
      const meta = {
        title: t,
        docType: docType || undefined,
        documentAt: documentAt ?? undefined,
        tags: tags.length ? tags : undefined,
      };
      if (mode === "retry") {
        if (!retryDocId) throw new Error("Documento non valido");
        await retryPetDocumentUpload(
          petId,
          userId,
          retryDocId,
          retryPrevStoragePath ?? null,
          file,
          meta,
          (p) => setProgress({ percent: p.percent, bytes: p.bytesTransferred, total: p.totalBytes })
        );
      } else {
        await uploadPetDocument(petId, userId, file, meta, (p) => setProgress({ percent: p.percent, bytes: p.bytesTransferred, total: p.totalBytes }));
      }
      onUploaded?.();
      if (autoCloseOnSuccess) onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload fallito";
      onError?.(msg);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "retry" ? `Riprendi upload${titleSuffix ? ` ${titleSuffix}` : ""}` : "Carica documento"}
      description={mode === "retry" ? "Seleziona di nuovo il file: manterremo metadati e sostituiremo l’upload fallito." : "PDF, immagini o testo fino a 10MB. Aggiungi titolo e data per ritrovarlo subito."}
      onClose={() => {
        if (isBusy) return;
        onClose();
      }}
    >
      <div className="space-y-3">
        <label className="block">
          <div className="text-xs lp-muted mb-1">File</div>
          <input
            data-testid="documents-file-input"
            type="file"
            accept="application/pdf,image/*,text/plain"
            className="lp-file-input"
            disabled={isBusy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (!f) return;
              setFile(f);
              if (!title.trim()) setTitle(baseTitleFromFileName(f.name));
            }}
          />
          {file ? (
            <div className="mt-1 text-xs lp-muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
          ) : null}
          {sizeError ? <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-danger))" }}>{sizeError}</div> : null}
        </label>

        {progress ? (
          <div className="lp-panel p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs lp-muted">Caricamento</div>
              <div className="text-xs" style={{ color: "rgb(var(--lp-ink))" }}>{progress.percent}%</div>
            </div>
            <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: "rgba(var(--lp-ink),0.08)", overflow: "hidden" }}>
              <div
                className="h-full"
                style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%`, background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-2)) 100%)" }}
              />
            </div>
            <div className="mt-2 text-[11px] lp-muted">
              {Math.round(progress.bytes / 1024)} KB / {Math.round(progress.total / 1024)} KB
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Titolo</div>
            <input className="lp-input" value={title} disabled={isBusy} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Tipo</div>
            <select className="lp-input" value={docType} disabled={isBusy} onChange={(e) => setDocType(parseDocType(e.target.value))}>
              <option value="">(non specificato)</option>
              <option value="referto">Referto</option>
              <option value="ricetta">Ricetta</option>
              <option value="vaccino">Vaccino</option>
              <option value="analisi">Analisi</option>
              <option value="altro">Altro</option>
            </select>
          </label>
        </div>

        <label className="block">
          <div className="text-xs lp-muted mb-1">Data documento (opzionale)</div>
          <input type="date" className="lp-input" value={docDate} disabled={isBusy} onChange={(e) => setDocDate(e.target.value)} />
        </label>

        <label className="block">
          <div className="text-xs lp-muted mb-1">Tag (opzionale)</div>
          <input
            className="lp-input"
            value={tagsText}
            disabled={isBusy}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="es. vet, analisi, vaccini"
          />
          <div className="mt-1 text-xs lp-muted">Separali con virgole. Max 8 tag.</div>
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className="lp-btn-secondary" onClick={onClose} disabled={isBusy}>
            Annulla
          </button>
          <button type="button" className="lp-btn-primary" onClick={() => void onSubmit()} disabled={!canSubmit}>
            {isBusy ? "Carico…" : "Carica"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, FileText, Image as ImageIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getPetDocumentDownloadUrl } from "@/data/documents";
import type { PetDocument } from "@/types";
import { docTypeLabel } from "@/lib/documentsUi";

function fileExt(name: string) {
  const n = String(name || "");
  const idx = n.lastIndexOf(".");
  if (idx <= 0) return "";
  return n.slice(idx + 1).toLowerCase();
}

function viewerKind(doc: PetDocument) {
  const ct = String(doc.contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image" as const;
  if (ct === "application/pdf") return "pdf" as const;
  const ext = fileExt(doc.name);
  if (ext === "pdf") return "pdf" as const;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image" as const;
  return "file" as const;
}

export function DocumentPreviewModal({
  open,
  doc,
  onClose,
}: {
  open: boolean;
  doc: PetDocument | null;
  onClose: () => void;
}) {
  const kind = useMemo(() => (doc ? viewerKind(doc) : "file"), [doc]);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !doc) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setUrl(null);
    getPetDocumentDownloadUrl(doc.storagePath)
      .then((u) => {
        if (!alive) return;
        setUrl(u);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Impossibile aprire il documento");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [doc, open]);

  if (!open || !doc) return null;

  return (
    <Modal
      open={open}
      title={doc.title ? doc.title : doc.name}
      description={doc.docType ? `Categoria: ${docTypeLabel(doc.docType)}` : "Anteprima documento"}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs lp-muted">
            {doc.size ? `${Math.round(doc.size / 1024)} KB` : "—"} · {new Date((doc.documentAt ?? doc.createdAt) as number).toLocaleDateString()}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="lp-btn-secondary inline-flex items-center gap-2"
              disabled={!url}
              onClick={() => {
                if (!url) return;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Nuova scheda
            </button>
            <button
              type="button"
              className="lp-btn-primary inline-flex items-center gap-2"
              disabled={!url}
              onClick={() => {
                if (!url) return;
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.name || "documento";
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>

        {loading ? (
          <div className="lp-panel p-4 text-sm lp-muted">Caricamento anteprima…</div>
        ) : error ? (
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-danger))" }}>Errore</div>
            <div className="text-sm text-slate-700 mt-1">{error}</div>
          </div>
        ) : !url ? (
          <div className="lp-panel p-4 text-sm lp-muted">Nessun URL disponibile.</div>
        ) : kind === "image" ? (
          <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white">
            <div className="p-3 flex items-center gap-2 text-xs lp-muted">
              <ImageIcon className="w-4 h-4" />
              Anteprima immagine
            </div>
            <img src={url} alt={doc.title ? doc.title : doc.name} className="w-full h-auto" />
          </div>
        ) : kind === "pdf" ? (
          <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white">
            <div className="p-3 flex items-center gap-2 text-xs lp-muted">
              <FileText className="w-4 h-4" />
              Anteprima PDF
            </div>
            <iframe
              title={doc.title ? doc.title : doc.name}
              src={url}
              className="w-full"
              style={{ height: "70vh" }}
            />
          </div>
        ) : (
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Anteprima non disponibile</div>
            <div className="text-sm text-slate-700 mt-1">Apri in nuova scheda o scarica il file.</div>
          </div>
        )}

        {doc.tags && doc.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {doc.tags.slice(0, 10).map((t) => (
              <span key={t} className="lp-badge">{t}</span>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

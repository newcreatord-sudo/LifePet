import { useMemo, useState } from "react";
import type { PetDocument } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Archive, Tag } from "lucide-react";
import { docTypeLabel } from "@/lib/documentsUi";

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

export function DocumentsBulkEditModal({
  open,
  selected,
  onClose,
  onApply,
  busy,
}: {
  open: boolean;
  selected: PetDocument[];
  busy: boolean;
  onClose: () => void;
  onApply: (patch: {
    docType?: PetDocument["docType"];
    documentAt?: number;
    tags?: string[];
    isFavorite?: boolean;
  }) => void;
}) {
  const [docType, setDocType] = useState<PetDocument["docType"] | "">("");
  const [date, setDate] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [favorite, setFavorite] = useState<"" | "1" | "0">("");

  const preview = useMemo(() => {
    const d = selected[0];
    if (!d) return null;
    const ms = date ? new Date(date).getTime() : NaN;
    const docAt = Number.isFinite(ms) ? ms : d.documentAt;
    const nextTags = tagsText.trim() ? parseTagsInput(tagsText) : d.tags;
    const nextFav = favorite === "" ? d.isFavorite : favorite === "1";
    const nextType = docType || d.docType;
    return {
      title: d.title ? d.title : d.name,
      docType: nextType ? docTypeLabel(nextType) : "—",
      date: docAt ? new Date(docAt).toLocaleDateString() : "—",
      tags: nextTags?.length ? nextTags.join(", ") : "—",
      fav: nextFav ? "Sì" : "No",
    };
  }, [date, docType, favorite, selected, tagsText]);

  return (
    <Modal
      open={open}
      title={`Modifica multipla (${selected.length})`}
      description="Applica gli stessi metadati a tutti i documenti selezionati."
      onClose={() => {
        if (busy) return;
        onClose();
      }}
    >
      <div className="space-y-3">
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Categoria</div>
          <select className="lp-input mt-1" value={docType} onChange={(e) => setDocType(parseDocType(e.target.value))} disabled={busy}>
            <option value="">Non cambiare</option>
            <option value="referto">{docTypeLabel("referto")}</option>
            <option value="ricetta">{docTypeLabel("ricetta")}</option>
            <option value="vaccino">{docTypeLabel("vaccino")}</option>
            <option value="analisi">{docTypeLabel("analisi")}</option>
            <option value="altro">{docTypeLabel("altro")}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Data documento</div>
            <input type="date" className="lp-input mt-1" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
            <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>Lascia vuoto per non cambiare.</div>
          </div>
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Preferiti</div>
            <select className="lp-input mt-1" value={favorite} onChange={(e) => setFavorite(e.target.value as "" | "1" | "0")} disabled={busy}>
              <option value="">Non cambiare</option>
              <option value="1">Imposta preferito</option>
              <option value="0">Rimuovi preferito</option>
            </select>
          </div>
        </div>

        <div className="lp-panel p-3">
          <div className="flex items-center gap-2 text-xs lp-muted">
            <Tag className="w-4 h-4" />
            Tag (separati da virgola)
          </div>
          <input className="lp-input mt-1" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="vaccino, microchip, referto" disabled={busy} />
          <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>Compila per sovrascrivere i tag. Lascia vuoto per non cambiare.</div>
        </div>

        {preview ? (
          <div className="lp-panel p-3">
            <div className="flex items-center gap-2 text-xs lp-muted">
              <Archive className="w-4 h-4" />
              Anteprima (primo documento)
            </div>
            <div className="mt-2 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{preview.title}</div>
            <div className="mt-1 text-xs lp-muted">{preview.docType} · {preview.date} · Tag: {preview.tags} · Preferito: {preview.fav}</div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="lp-btn-primary"
            disabled={busy || selected.length === 0}
            onClick={() => {
              const ms = date ? new Date(date).getTime() : NaN;
              const documentAt = Number.isFinite(ms) ? ms : undefined;
              const tags = tagsText.trim() ? parseTagsInput(tagsText) : undefined;
              const isFavorite = favorite === "" ? undefined : favorite === "1";
              const patch = {
                docType: docType || undefined,
                documentAt,
                tags,
                isFavorite,
              };
              onApply(patch);
            }}
          >
            {busy ? "Applico…" : "Applica"}
          </button>
          <button type="button" className="lp-btn-secondary" disabled={busy} onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}


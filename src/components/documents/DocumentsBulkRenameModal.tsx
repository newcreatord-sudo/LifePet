import { useMemo, useState } from "react";
import type { PetDocument } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { FileSignature } from "lucide-react";

function stripExt(name: string) {
  const n = String(name || "");
  const idx = n.lastIndexOf(".");
  if (idx <= 0) return n;
  return n.slice(0, idx);
}

function compactSpaces(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function DocumentsBulkRenameModal({
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
  onApply: (computeTitle: (d: PetDocument) => string) => void;
}) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [base, setBase] = useState<"title" | "name">("title");
  const [addDate, setAddDate] = useState(false);
  const [dateMode, setDateMode] = useState<"document" | "today">("document");

  const preview = useMemo(() => {
    const compute = (d: PetDocument) => {
      const rawBase = base === "title" ? (d.title ? d.title : stripExt(d.name)) : stripExt(d.name);
      const main = compactSpaces(`${prefix}${rawBase}${suffix}`);
      if (!main) return "Documento";
      if (!addDate) return main;
      const ms = dateMode === "today" ? Date.now() : (d.documentAt ?? d.createdAt);
      const dt = new Date(ms);
      const ds = Number.isFinite(dt.getTime()) ? dt.toLocaleDateString() : "";
      return compactSpaces(`${ds} · ${main}`);
    };
    return selected.slice(0, 4).map((d) => ({ id: d.id, from: d.title ? d.title : d.name, to: compute(d) }));
  }, [addDate, base, dateMode, prefix, selected, suffix]);

  return (
    <Modal
      open={open}
      title={`Rinomina multipla (${selected.length})`}
      description="Aggiorna il titolo dei documenti selezionati (non rinomina il file)."
      onClose={() => {
        if (busy) return;
        onClose();
      }}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Base</div>
            <select className="lp-input mt-1" value={base} onChange={(e) => setBase(e.target.value as "title" | "name")} disabled={busy}>
              <option value="title">Titolo (o nome file)</option>
              <option value="name">Nome file (senza estensione)</option>
            </select>
          </div>
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Data nel titolo</div>
            <label className="mt-2 inline-flex items-center gap-2 text-sm lp-panel px-3 py-2">
              <input type="checkbox" checked={addDate} onChange={(e) => setAddDate(e.target.checked)} disabled={busy} />
              Aggiungi data
            </label>
            {addDate ? (
              <select className="lp-input mt-2" value={dateMode} onChange={(e) => setDateMode(e.target.value as "document" | "today")} disabled={busy}>
                <option value="document">Usa data documento (o caricamento)</option>
                <option value="today">Usa oggi</option>
              </select>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Prefisso</div>
            <input className="lp-input mt-1" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Es. Referto - " disabled={busy} />
          </div>
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Suffisso</div>
            <input className="lp-input mt-1" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Es. (Clinica XYZ)" disabled={busy} />
          </div>
        </div>

        <div className="lp-panel p-3">
          <div className="flex items-center gap-2 text-xs lp-muted">
            <FileSignature className="w-4 h-4" />
            Anteprima
          </div>
          <div className="mt-2 grid gap-2">
            {preview.map((p) => (
              <div key={p.id} className="lp-panel px-3 py-2">
                <div className="text-xs lp-muted truncate">Da: {p.from}</div>
                <div className="text-sm font-semibold truncate" style={{ color: "rgb(var(--lp-ink))" }}>A: {p.to}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] mt-2" style={{ color: "rgb(var(--lp-muted))" }}>Se un titolo risulta vuoto, verrà usato “Documento”.</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="lp-btn-primary"
            disabled={busy || selected.length === 0}
            onClick={() => {
              const compute = (d: PetDocument) => {
                const rawBase = base === "title" ? (d.title ? d.title : stripExt(d.name)) : stripExt(d.name);
                const main = compactSpaces(`${prefix}${rawBase}${suffix}`);
                const v = main || "Documento";
                if (!addDate) return v;
                const ms = dateMode === "today" ? Date.now() : (d.documentAt ?? d.createdAt);
                const dt = new Date(ms);
                const ds = Number.isFinite(dt.getTime()) ? dt.toLocaleDateString() : "";
                return compactSpaces(`${ds} · ${v}`);
              };
              onApply(compute);
            }}
          >
            {busy ? "Rinomino…" : "Applica"}
          </button>
          <button type="button" className="lp-btn-secondary" disabled={busy} onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}


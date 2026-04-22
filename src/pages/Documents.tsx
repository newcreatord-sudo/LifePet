import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Cloud, CloudUpload, Download, HardDrive, Pencil, RotateCw, Search, Star, Trash2, Upload, PawPrint, FolderOpen, FileSignature, SlidersHorizontal } from "lucide-react";
import JSZip from "jszip";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { deletePetDocument, getPetDocumentDownloadUrl, subscribeDocuments, updatePetDocumentMeta } from "@/data/documents";
import type { PetDocument } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/confirm";
import { Modal } from "@/components/ui/Modal";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentsBulkEditModal } from "@/components/documents/DocumentsBulkEditModal";
import { DocumentsBulkRenameModal } from "@/components/documents/DocumentsBulkRenameModal";
import { docTypeLabel, filterPetDocuments } from "@/lib/documentsUi";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/telemetryClient";
import { uxCopy } from "@/lib/uxCopy";

function parseDocType(v: string): PetDocument["docType"] | "" {
  if (v === "referto" || v === "ricetta" || v === "vaccino" || v === "analisi" || v === "altro") return v;
  return "";
}

function parseDocTypeFilter(v: string): PetDocument["docType"] | "all" {
  if (v === "all") return "all";
  const p = parseDocType(v);
  return p ? p : "all";
}

function parseSortKey(v: string): "documentAt" | "createdAt" | "name" {
  if (v === "createdAt" || v === "name" || v === "documentAt") return v;
  return "documentAt";
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

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  const digits = idx === 0 ? 0 : idx === 1 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[idx]}`;
}

export default function Documents() {
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadInitialMeta, setUploadInitialMeta] = useState<{
    title?: string;
    docType?: PetDocument["docType"];
    documentAt?: number;
    tags?: string[];
  } | null>(null);
  const [retryDocId, setRetryDocId] = useState<string | null>(null);
  const [retryAll, setRetryAll] = useState<{ ids: string[]; index: number } | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<PetDocument["docType"] | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"documentAt" | "createdAt" | "name">("documentAt");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<PetDocument | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<PetDocument["docType"] | "">("");
  const [editDate, setEditDate] = useState("");
  const [editTagsText, setEditTagsText] = useState("");
  const [editFavorite, setEditFavorite] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [backupOpen, setBackupOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [backupSource, setBackupSource] = useState<"auto" | "selected" | "filtered">("auto");
  const backupAbortRef = useRef<AbortController | null>(null);

  const [selectedById, setSelectedById] = useState<Record<string, boolean>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PetDocument | null>(null);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const filtersKey = useMemo(() => {
    const pid = activePetId || "none";
    return `lifepet:docs:filters:${pid}`;
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    try {
      const raw = localStorage.getItem(filtersKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { q?: unknown; type?: unknown; tag?: unknown; fav?: unknown; from?: unknown; to?: unknown };
      const nq = typeof parsed.q === "string" ? parsed.q : "";
      const nt = typeof parsed.type === "string" ? parseDocTypeFilter(parsed.type) : "all";
      const ntag = typeof parsed.tag === "string" ? String(parsed.tag || "all") : "all";
      const nfav = typeof parsed.fav === "boolean" ? Boolean(parsed.fav) : false;
      const nsort = typeof (parsed as { sort?: unknown }).sort === "string" ? String((parsed as { sort?: unknown }).sort) : "";
      const safeSort = nsort === "createdAt" || nsort === "name" || nsort === "documentAt" ? nsort : "documentAt";
      const nf = typeof parsed.from === "string" ? parsed.from : "";
      const ntod = typeof parsed.to === "string" ? parsed.to : "";
      setQ(nq);
      setTypeFilter(nt);
      setTagFilter(ntag);
      setFavoriteOnly(nfav);
      setSortKey(safeSort);
      setFromDate(nf);
      setToDate(ntod);
    } catch {
      return;
    }
  }, [activePetId, filtersKey]);

  useEffect(() => {
    if (!activePetId) return;
    try {
      localStorage.setItem(
        filtersKey,
        JSON.stringify({ q, type: typeFilter, tag: tagFilter, fav: favoriteOnly, sort: sortKey, from: fromDate, to: toDate })
      );
    } catch {
      return;
    }
  }, [activePetId, favoriteOnly, filtersKey, fromDate, q, sortKey, tagFilter, toDate, typeFilter]);

  useEffect(() => {
    if (!activePetId) {
      setDocs([]);
      setBusyId(null);
      setLoaded(false);
      setInlineError(null);
      setSelectedById({});
      return;
    }
    setLoaded(false);
    setInlineError(null);
    const unsub = subscribeDocuments(
      activePetId,
      (items) => {
      setDocs(items);
      setLoaded(true);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : "Caricamento documenti fallito";
        setInlineError(msg);
      }
    );
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    setSelectedById({});
  }, [activePetId]);

  const cloudState = useMemo(() => {
    const uploading = docs.filter((d) => d.uploadStatus === "uploading").length;
    const failed = docs.filter((d) => d.uploadStatus === "failed").length;
    return { uploading, failed };
  }, [docs]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: docs.length };
    for (const d of docs) {
      const k = d.docType || "altro";
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [docs]);

  const retryDoc = useMemo(() => {
    if (!retryDocId) return null;
    return docs.find((d) => d.id === retryDocId) ?? null;
  }, [docs, retryDocId]);

  function scrollToDoc(docId: string) {
    const el = document.getElementById(`doc-${docId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (!activePetId) return;
    setSelectedById((prev) => {
      const ids = new Set(docs.map((d) => d.id));
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v && ids.has(k)) next[k] = true;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [activePetId, docs]);

  const filtered = useMemo(() => {
    const parse = (v: string) => {
      const ms = v ? new Date(v).getTime() : NaN;
      return Number.isFinite(ms) ? ms : null;
    };
    const fromMs = parse(fromDate);
    const toMs = parse(toDate);
    const safeTo = toMs !== null ? toMs + 24 * 60 * 60 * 1000 - 1 : null;
    return filterPetDocuments(docs, {
      q,
      docType: typeFilter,
      tag: tagFilter,
      favoriteOnly,
      fromMs: fromMs ?? undefined,
      toMs: safeTo ?? undefined,
    });
  }, [docs, favoriteOnly, fromDate, q, tagFilter, toDate, typeFilter]);

  const visible = useMemo(() => {
    const copy = filtered.slice();
    copy.sort((a, b) => {
      if (sortKey === "name") {
        return (a.title || a.name).localeCompare(b.title || b.name, "it");
      }
      if (sortKey === "createdAt") {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      const at = typeof a.documentAt === "number" ? a.documentAt : a.createdAt;
      const bt = typeof b.documentAt === "number" ? b.documentAt : b.createdAt;
      return (bt || 0) - (at || 0);
    });
    return copy;
  }, [filtered, sortKey]);

  const hasFilters = Boolean(q.trim() || typeFilter !== "all" || tagFilter !== "all" || favoriteOnly || fromDate || toDate);

  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of docs) {
      for (const t of d.tags || []) {
        const key = String(t).trim();
        if (!key) continue;
        const lower = key.toLowerCase();
        if (!map.has(lower)) map.set(lower, key);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "it"));
  }, [docs]);

  const selectedIds = useMemo(() => Object.keys(selectedById).filter((k) => selectedById[k]), [selectedById]);
  const selectedCount = selectedIds.length;
  const selectedDocs = useMemo(() => {
    if (selectedCount === 0) return [] as PetDocument[];
    const map = new Map(docs.map((d) => [d.id, d] as const));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as PetDocument[];
  }, [docs, selectedCount, selectedIds]);

  const backupItems = useMemo(() => {
    if (backupSource === "filtered") return visible;
    if (backupSource === "selected") return selectedDocs;
    return selectedCount > 0 ? selectedDocs : visible;
  }, [backupSource, selectedCount, selectedDocs, visible]);

  const backupStats = useMemo(() => {
    const totalBytes = backupItems.reduce((sum, d) => sum + (d.size || 0), 0);
    const demoCount = backupItems.filter((d) => d.storagePath.startsWith("demo://")).length;
    return { totalBytes, demoCount };
  }, [backupItems]);

  async function bulkDeleteSelected() {
    if (!activePetId) return;
    if (selectedDocs.length === 0) return;
    const ok = await confirmDialog({
      title: "Elimina documenti",
      description: `Vuoi eliminare ${selectedDocs.length} documenti selezionati? L’operazione è irreversibile.`,
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setInlineError(null);
    try {
      for (const d of selectedDocs) {
        setBusyId(d.id);
        await deletePetDocument(activePetId, d.id, d.storagePath);
      }
      clearSelection();
      pushToast({ type: "success", title: "Documenti", message: "Eliminati." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eliminazione fallita";
      setInlineError(msg);
      pushToast({ type: "error", title: "Documenti", message: msg });
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id: string, next: boolean) {
    setSelectedById((prev) => {
      if (next) return { ...prev, [id]: true };
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function clearSelection() {
    setSelectedById({});
  }

  function selectAllFiltered() {
    setSelectedById((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const d of filtered) next[d.id] = true;
      return next;
    });
  }

  function openEdit(d: PetDocument) {
    setEditDoc(d);
    setEditTitle(d.title || "");
    setEditType(d.docType || "");
    setEditDate(d.documentAt ? new Date(d.documentAt).toISOString().slice(0, 10) : "");
    setEditTagsText((d.tags || []).join(", "));
    setEditFavorite(Boolean(d.isFavorite));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!activePetId || !editDoc) return;
    if (savingEdit) return;
    setSavingEdit(true);
    setInlineError(null);
    try {
      const title = editTitle.trim();
      const ms = editDate ? new Date(editDate).getTime() : NaN;
      const documentAt = Number.isFinite(ms) ? ms : undefined;
      const tags = parseTagsInput(editTagsText);
      await updatePetDocumentMeta(activePetId, editDoc.id, {
        title: title || undefined,
        docType: editType || undefined,
        documentAt,
        tags,
        isFavorite: editFavorite,
      });
      pushToast({ type: "success", title: "Documento", message: "Metadati aggiornati." });
      setEditOpen(false);
      setEditDoc(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Aggiornamento fallito";
      setInlineError(msg);
      pushToast({ type: "error", title: "Documento", message: msg });
    } finally {
      setSavingEdit(false);
    }
  }

  async function openDoc(d: PetDocument) {
    setInlineError(null);
    setPreviewDoc(d);
    setPreviewOpen(true);
  }

  async function downloadDoc(d: PetDocument) {
    setInlineError(null);
    setBusyId(d.id);
    try {
      const url = await getPetDocumentDownloadUrl(d.storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name || "documento";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download fallito";
      setInlineError(msg);
      pushToast({ type: "error", title: "Errore", message: msg });
    } finally {
      setBusyId(null);
    }
  }

  function safeFileName(name: string) {
    const base = String(name || "documento")
      .replace(/[\\/]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    const safe = base.replace(/[^\w\-. ()[\]]+/g, "");
    const trimmed = safe.length > 120 ? safe.slice(0, 120).trim() : safe;
    return trimmed || "documento";
  }

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function buildManifest(items: PetDocument[]) {
    return {
      exportedAt: Date.now(),
      petId: activePetId,
      filters: {
        q,
        docType: typeFilter,
        tag: tagFilter,
        favoriteOnly,
        fromDate,
        toDate,
      },
      documents: items.map((d) => ({
        id: d.id,
        name: d.name,
        title: d.title ?? null,
        docType: d.docType ?? null,
        documentAt: d.documentAt ?? null,
        tags: d.tags ?? [],
        isFavorite: Boolean(d.isFavorite),
        size: d.size ?? null,
        contentType: d.contentType ?? null,
        storagePath: d.storagePath,
        createdAt: d.createdAt,
        createdBy: d.createdBy,
      })),
    };
  }

  async function exportManifestJson(items: PetDocument[]) {
    const manifest = buildManifest(items);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(`lifepet-documents-${activePetId || "pet"}-${date}.json`, blob);
  }

  async function exportZip(items: PetDocument[]) {
    if (!activePetId) return;
    const real = items.filter((d) => !d.storagePath.startsWith("demo://"));
    if (real.length === 0) {
      pushToast({ type: "info", title: "Backup", message: "Nessun documento esportabile (demo o lista vuota)." });
      return;
    }

    const countLimit = 25;
    const sizeLimit = 60 * 1024 * 1024;
    const totalBytes = real.reduce((sum, d) => sum + (d.size || 0), 0);
    if (real.length > countLimit || totalBytes > sizeLimit) {
      const ok = await confirmDialog({
        title: "Backup grande",
        description: `Stai esportando ${real.length} documenti (${Math.round(totalBytes / 1024 / 1024)} MB). Per una UX affidabile, riduci filtri oppure conferma comunque.`,
        confirmLabel: "Continua",
        variant: "danger",
      });
      if (!ok) return;
    }

    setBackupBusy(true);
    setBackupProgress({ done: 0, total: real.length, label: "Preparazione…" });
    try {
      const ctrl = new AbortController();
      backupAbortRef.current = ctrl;
      const zip = new JSZip();
      const manifest = buildManifest(items);
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      for (let i = 0; i < real.length; i++) {
        const d = real[i];
        setBackupProgress({ done: i, total: real.length, label: d.title || d.name });
        const url = await getPetDocumentDownloadUrl(d.storagePath);
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Download fallito: ${d.name}`);
        const blob = await res.blob();
        const folder = "files";
        const base = safeFileName(d.title || d.name);
        const ext = (() => {
          const idx = d.name.lastIndexOf(".");
          return idx > 0 ? d.name.slice(idx) : "";
        })();
        const filename = `${d.id}_${base}${ext}`;
        zip.file(`${folder}/${filename}`, blob);
        setBackupProgress({ done: i + 1, total: real.length, label: d.title || d.name });
      }

      setBackupProgress({ done: real.length, total: real.length, label: "Composizione ZIP…" });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(`lifepet-documents-${activePetId}-${date}.zip`, zipBlob);
      pushToast({ type: "success", title: "Backup", message: "Esportazione completata." });
      setBackupOpen(false);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      const msg = aborted ? "Backup annullato." : e instanceof Error ? e.message : "Backup fallito";
      setInlineError(msg);
      pushToast({ type: aborted ? "info" : "error", title: "Backup", message: msg });
    } finally {
      setBackupBusy(false);
      setBackupProgress(null);
      backupAbortRef.current = null;
    }
  }

  async function toggleFavorite(d: PetDocument) {
    if (!activePetId) return;
    setInlineError(null);
    setBusyId(d.id);
    try {
      const next = !d.isFavorite;
      await updatePetDocumentMeta(activePetId, d.id, { isFavorite: next });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Aggiornamento fallito";
      setInlineError(msg);
      pushToast({ type: "error", title: "Documento", message: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function applyBulkMeta(patch: {
    docType?: PetDocument["docType"];
    documentAt?: number;
    tags?: string[];
    isFavorite?: boolean;
  }) {
    if (!activePetId) return;
    if (bulkBusy) return;
    const ids = selectedDocs.map((d) => d.id);
    if (ids.length === 0) return;
    setInlineError(null);
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: ids.length, label: "Preparazione…" });
    try {
      for (let i = 0; i < selectedDocs.length; i++) {
        const d = selectedDocs[i];
        setBulkProgress({ done: i, total: selectedDocs.length, label: d.title ? d.title : d.name });
        await updatePetDocumentMeta(activePetId, d.id, {
          ...(patch.docType !== undefined ? { docType: patch.docType } : {}),
          ...(patch.documentAt !== undefined ? { documentAt: patch.documentAt } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
          ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
        });
        setBulkProgress({ done: i + 1, total: selectedDocs.length, label: d.title ? d.title : d.name });
      }
      pushToast({ type: "success", title: "Documenti", message: "Aggiornati." });
      void trackEvent({ uid: user?.uid, profile, event: "documents_bulk_action", route: "/app/documents", props: { kind: "meta", count: selectedDocs.length } });
      setBulkEditOpen(false);
      clearSelection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Aggiornamento fallito";
      setInlineError(msg);
      pushToast({ type: "error", title: "Documenti", message: msg });
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  }

  async function applyBulkRename(computeTitle: (d: PetDocument) => string) {
    if (!activePetId) return;
    if (bulkBusy) return;
    if (selectedDocs.length === 0) return;
    setInlineError(null);
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: selectedDocs.length, label: "Preparazione…" });
    try {
      for (let i = 0; i < selectedDocs.length; i++) {
        const d = selectedDocs[i];
        const nextTitle = String(computeTitle(d) || "").trim();
        setBulkProgress({ done: i, total: selectedDocs.length, label: d.title ? d.title : d.name });
        await updatePetDocumentMeta(activePetId, d.id, { title: nextTitle || undefined });
        setBulkProgress({ done: i + 1, total: selectedDocs.length, label: nextTitle || (d.title ? d.title : d.name) });
      }
      pushToast({ type: "success", title: "Documenti", message: "Rinominati." });
      void trackEvent({ uid: user?.uid, profile, event: "documents_bulk_action", route: "/app/documents", props: { kind: "rename", count: selectedDocs.length } });
      setBulkRenameOpen(false);
      clearSelection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rinomina fallita";
      setInlineError(msg);
      pushToast({ type: "error", title: "Documenti", message: msg });
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={uxCopy.documents.headerTitle}
        description={uxCopy.documents.headerDescription}
        imagePrompt="minimal clean illustration, document cards and paperclip, pet paw icon, airy white background, accent color, premium, no text, no watermark"
        imageAlt="Documenti"
        actions={
          activePetId ? (
            <>
              <button
                type="button"
                className="lp-btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  setUploadInitialMeta(null);
                  setUploadOpen(true);
                }}
              >
                <Upload className="w-4 h-4" />
                Carica
              </button>
              <button type="button" className="lp-btn-secondary inline-flex items-center gap-2" onClick={() => setBackupOpen(true)} disabled={docs.length === 0}>
                <Archive className="w-4 h-4" />
                Backup
              </button>
            </>
          ) : null
        }
      />

      <DocumentPreviewModal
        open={previewOpen}
        doc={previewDoc}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewDoc(null);
        }}
      />

      <DocumentsBulkEditModal
        open={bulkEditOpen}
        selected={selectedDocs}
        busy={bulkBusy}
        onClose={() => setBulkEditOpen(false)}
        onApply={(patch) => void applyBulkMeta(patch)}
      />

      <DocumentsBulkRenameModal
        open={bulkRenameOpen}
        selected={selectedDocs}
        busy={bulkBusy}
        onClose={() => setBulkRenameOpen(false)}
        onApply={(compute) => void applyBulkRename(compute)}
      />

      {user && activePetId ? (
        cloudState.failed > 0 ? (
          <Alert variant="danger" title="Backup cloud: errori">
            <div className="space-y-2">
              <div>Ci sono {cloudState.failed} documenti con upload fallito. Premi “Riprendi” sul documento per ricaricare il file senza perdere i metadati.</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="lp-btn-primary"
                  onClick={() => {
                    const ids = docs.filter((d) => d.uploadStatus === "failed").map((d) => d.id);
                    if (ids.length === 0) return;
                    setRetryAll({ ids, index: 0 });
                    setRetryDocId(ids[0]);
                  }}
                >
                  Riprendi tutti
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => {
                    const first = docs.find((d) => d.uploadStatus === "failed");
                    if (first) scrollToDoc(first.id);
                  }}
                >
                  Vai al primo errore
                </button>
              </div>
              <div className="text-xs lp-muted">Per ogni documento ti verrà chiesto di selezionare il file sul dispositivo.</div>
            </div>
          </Alert>
        ) : cloudState.uploading > 0 ? (
          <Alert variant="warn" title="Backup cloud: in caricamento">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>Caricamenti in corso: {cloudState.uploading}. Non chiudere la pagina finché non finiscono.</div>
              <div className="inline-flex items-center gap-2 text-xs" style={{ color: "rgba(var(--lp-ink), 0.70)" }}>
                <CloudUpload className="w-4 h-4" />
                Sincronizzazione attiva
              </div>
            </div>
          </Alert>
        ) : (
          <Alert variant="success" title="Backup cloud: OK">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>I documenti sono salvati nel cloud e restano disponibili anche cambiando telefono (con lo stesso account).</div>
              <div className="inline-flex items-center gap-2 text-xs" style={{ color: "rgba(var(--lp-ink), 0.70)" }}>
                <Cloud className="w-4 h-4" />
                Protetti
              </div>
            </div>
          </Alert>
        )
      ) : user ? (
        <Alert variant="info" title="Backup cloud">
          Seleziona un pet per visualizzare e salvare i documenti nel cloud.
        </Alert>
      ) : (
        <Alert variant="warn" title="Backup cloud non attivo">
          Accedi per salvare i documenti nel cloud e ritrovarli su qualsiasi telefono.
        </Alert>
      )}

      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Totale</div>
              <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{docs.length}</div>
              <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Documenti archiviati</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Preferiti</div>
              <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{docs.filter((d) => d.isFavorite).length}</div>
              <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Per accesso rapido</div>
            </div>
            <div className="lp-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs lp-muted">Spazio</div>
                  <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{formatBytes(docs.reduce((sum, d) => sum + (d.size || 0), 0))}</div>
                  <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>{backupStats.demoCount ? `${backupStats.demoCount} demo/offline` : "Storage + metadati"}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <HardDrive className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
                  <button
                    type="button"
                    className="lp-btn-primary px-3 py-2 text-xs inline-flex items-center gap-2"
                    onClick={() => {
                      setUploadInitialMeta(null);
                      setUploadOpen(true);
                    }}
                    disabled={!activePetId || !user}
                  >
                    <Upload className="w-4 h-4" />
                    Carica
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocumentUploadModal
        open={uploadOpen && Boolean(activePetId && user)}
        petId={activePetId || ""}
        userId={user?.uid || ""}
        initialMeta={uploadInitialMeta ?? undefined}
        onClose={() => {
          setUploadOpen(false);
          setUploadInitialMeta(null);
        }}
        onUploaded={() => {
          setUploadInitialMeta(null);
          pushToast({ type: "success", title: "Documento caricato", message: "Disponibile in libreria." });
        }}
        onError={(msg) => {
          setInlineError(msg);
          pushToast({ type: "error", title: "Errore", message: msg });
        }}
      />

      <DocumentUploadModal
        open={Boolean(retryDoc && activePetId && user)}
        mode="retry"
        petId={activePetId || ""}
        userId={user?.uid || ""}
        retryDocId={retryDoc?.id}
        retryPrevStoragePath={retryDoc?.storagePath ?? null}
        titleSuffix={retryAll ? `(${retryAll.index + 1}/${retryAll.ids.length})` : undefined}
        autoCloseOnSuccess={!retryAll}
        initialMeta={{
          title: retryDoc?.title,
          docType: retryDoc?.docType,
          documentAt: retryDoc?.documentAt,
          tags: retryDoc?.tags,
        }}
        onClose={() => {
          setRetryAll(null);
          setRetryDocId(null);
        }}
        onUploaded={() => {
          if (retryAll) {
            const nextIndex = retryAll.index + 1;
            const nextId = retryAll.ids[nextIndex];
            if (nextId) {
              setRetryAll({ ids: retryAll.ids, index: nextIndex });
              setRetryDocId(nextId);
              return;
            }
            setRetryAll(null);
            setRetryDocId(null);
            pushToast({ type: "success", title: "Backup cloud", message: "Upload ripresi per tutti i documenti." });
            return;
          }
          pushToast({ type: "success", title: "Upload ripreso", message: "Documento sincronizzato." });
        }}
        onError={(msg) => {
          setInlineError(msg);
          pushToast({ type: "error", title: "Errore", message: msg });
        }}
      />

      <Modal
        open={editOpen}
        title="Modifica metadati"
        description="Titolo, tipo e data del documento."
        onClose={() => {
          if (savingEdit) return;
          setEditOpen(false);
        }}
      >
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Titolo</div>
            <input className="lp-input" value={editTitle} disabled={savingEdit} onChange={(e) => setEditTitle(e.target.value)} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs lp-muted mb-1">Tipo</div>
              <select className="lp-input" value={editType} disabled={savingEdit} onChange={(e) => setEditType(parseDocType(e.target.value))}>
                <option value="">(non specificato)</option>
                <option value="referto">Referto</option>
                <option value="ricetta">Ricetta</option>
                <option value="vaccino">Vaccino</option>
                <option value="analisi">Analisi</option>
                <option value="altro">Altro</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs lp-muted mb-1">Data documento</div>
              <input type="date" className="lp-input" value={editDate} disabled={savingEdit} onChange={(e) => setEditDate(e.target.value)} />
            </label>
          </div>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Tag</div>
            <input
              className="lp-input"
              value={editTagsText}
              disabled={savingEdit}
              onChange={(e) => setEditTagsText(e.target.value)}
              placeholder="es. vet, analisi, vaccini"
            />
            <div className="mt-1 text-xs lp-muted">Separali con virgole. Max 8 tag.</div>
          </label>

          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Preferito</div>
              <div className="text-xs lp-muted">Mostra in alto e nel filtro preferiti.</div>
            </div>
            <input type="checkbox" checked={editFavorite} disabled={savingEdit} onChange={(e) => setEditFavorite(e.target.checked)} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Annulla
            </button>
            <button type="button" className="lp-btn-primary" onClick={() => void saveEdit()} disabled={savingEdit}>
              {savingEdit ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-4 lg:sticky lg:top-24 h-fit relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{uxCopy.documents.uploadCardTitle}</CardTitle>
              <CardDescription>{uxCopy.documents.uploadCardDescription}</CardDescription>
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
        {!activePetId ? (
          <EmptyState
            icon={PawPrint}
            title={uxCopy.common.empty.selectPetTitle}
            description={uxCopy.documents.selectPetUploadDescription}
            action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">{uxCopy.common.cta.openPetProfile}</Link>}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{uxCopy.documents.uploadCardHintTitle}</div>
                <div className="text-xs lp-muted">{uxCopy.documents.uploadCardHintDescription}</div>
              </div>
              <button
                type="button"
                data-testid="documents-upload-open"
                className="lp-btn-primary inline-flex items-center gap-2"
              onClick={() => {
                setUploadInitialMeta(null);
                setUploadOpen(true);
              }}
              >
                <Upload className="w-4 h-4" />
                {uxCopy.common.cta.uploadShort}
              </button>
            </div>
            <div className="text-xs lp-muted">{uxCopy.documents.uploadCardTip}</div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-8 relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Libreria</CardTitle>
              <CardDescription>{uxCopy.documents.libraryDescription}</CardDescription>
            </div>
            <div className="lp-mini-ill" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState
            icon={FolderOpen}
            title={uxCopy.common.empty.selectPetTitle}
            description={uxCopy.documents.selectPetLibraryDescription}
            action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">{uxCopy.common.cta.openPetProfile}</Link>}
          />
        ) : !loaded ? (
          <div className="grid gap-2">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
          </div>
        ) : docs.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              icon={FolderOpen}
              title={uxCopy.documents.emptyLibraryTitle}
              description={uxCopy.documents.emptyLibraryDescription}
              action={
                <button
                  type="button"
                  className="lp-btn-primary inline-flex items-center justify-center"
                  onClick={() => {
                    setUploadInitialMeta(null);
                    setUploadOpen(true);
                  }}
                >
                  {uxCopy.common.cta.uploadDocument}
                </button>
              }
              secondaryAction={<Link to="/app/vaccines" className="lp-btn-secondary inline-flex items-center justify-center">Aggiungi vaccino</Link>}
            />
            <div className="flex flex-wrap gap-2">
              {[
                { title: "Libretto sanitario", docType: "altro" as const, tags: ["libretto sanitario"] },
                { title: "Microchip", docType: "altro" as const, tags: ["microchip"] },
                { title: "Vaccinazioni", docType: "vaccino" as const, tags: ["vaccino"] },
                { title: "Referto", docType: "referto" as const, tags: ["referto"] },
              ].map((x) => (
                <button
                  key={x.title}
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => {
                    setUploadInitialMeta({ title: x.title, docType: x.docType, tags: x.tags });
                    setUploadOpen(true);
                  }}
                >
                  {x.title}
                </button>
              ))}
            </div>
            <div className="text-xs lp-muted">Suggerimento: aggiungi anche una foto identificativa ben visibile (muso + mantello).</div>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.length < 3 && !hasFilters ? (
              <div className="lp-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Completa la libreria documenti</div>
                    <div className="text-xs lp-muted mt-1">Carica 1–2 documenti essenziali: ti tornano utili in visita o emergenza.</div>
                  </div>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => {
                      setUploadInitialMeta(null);
                      setUploadOpen(true);
                    }}
                  >
                    Carica
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { title: "Libretto sanitario", docType: "altro" as const, tags: ["libretto sanitario"] },
                    { title: "Microchip", docType: "altro" as const, tags: ["microchip"] },
                    { title: "Vaccinazioni", docType: "vaccino" as const, tags: ["vaccino"] },
                  ].map((x) => (
                    <button
                      key={x.title}
                      type="button"
                      className="lp-btn-secondary"
                      onClick={() => {
                        setUploadInitialMeta({ title: x.title, docType: x.docType, tags: x.tags });
                        setUploadOpen(true);
                      }}
                    >
                      {x.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <div className="lg:col-span-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgb(var(--lp-muted))" }} />
                  <input
                    className="lp-input pl-9"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cerca per titolo o nome file…"
                  />
                </div>
              </div>
              <div className="lg:col-span-6 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className={(favoriteOnly ? "lp-btn-primary" : "lp-btn-secondary") + " whitespace-nowrap inline-flex items-center gap-2"}
                  onClick={() => setFavoriteOnly((s) => !s)}
                >
                  <Star className="w-4 h-4" />
                  Preferiti
                </button>
                <select className="lp-input" value={typeFilter} onChange={(e) => setTypeFilter(parseDocTypeFilter(e.target.value))}>
                  <option value="all">Tutti i tipi</option>
                  <option value="referto">Referti</option>
                  <option value="ricetta">Ricette</option>
                  <option value="vaccino">Vaccini</option>
                  <option value="analisi">Analisi</option>
                  <option value="altro">Altro</option>
                </select>

                <select className="lp-input" value={sortKey} onChange={(e) => setSortKey(parseSortKey(e.target.value))}>
                  <option value="documentAt">Ordina: data documento</option>
                  <option value="createdAt">Ordina: caricamento</option>
                  <option value="name">Ordina: nome</option>
                </select>
                <select className="lp-input" value={tagFilter} onChange={(e) => setTagFilter(String(e.target.value || "all"))}>
                  <option value="all">Tutti i tag</option>
                  {availableTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input type="date" className="lp-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <input type="date" className="lp-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                {hasFilters ? (
                  <button
                    type="button"
                    className="lp-btn-secondary whitespace-nowrap"
                    onClick={() => {
                      setQ("");
                      setTypeFilter("all");
                      setTagFilter("all");
                      setFavoriteOnly(false);
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lp-panel px-3 py-2 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex items-center gap-2 min-w-max">
                {(
                  [
                    { key: "all", label: "Tutti" },
                    { key: "referto", label: "Referti" },
                    { key: "ricetta", label: "Ricette" },
                    { key: "vaccino", label: "Vaccini" },
                    { key: "analisi", label: "Analisi" },
                    { key: "altro", label: "Altro" },
                  ] as const
                ).map((x) => {
                  const active = typeFilter === x.key;
                  const count = typeCounts[x.key] || 0;
                  return (
                    <button
                      key={x.key}
                      type="button"
                      className={active ? "lp-btn-primary" : "lp-btn-secondary"}
                      onClick={() => setTypeFilter(x.key)}
                    >
                      {x.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lp-panel px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs lp-muted">
                Filtri: <span className="font-medium">{visible.length}</span> documenti
                {" · "}
                Selezionati: <span className="font-medium">{selectedCount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="lp-btn-secondary whitespace-nowrap" onClick={selectAllFiltered} disabled={filtered.length === 0}>
                  Seleziona tutti
                </button>
                {selectedCount > 0 ? (
                  <button type="button" className="lp-btn-secondary whitespace-nowrap" onClick={clearSelection}>
                    Deseleziona
                  </button>
                ) : null}
                <button
                  type="button"
                  className="lp-btn-secondary whitespace-nowrap inline-flex items-center gap-2"
                  onClick={() => void bulkDeleteSelected()}
                  disabled={selectedCount === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary whitespace-nowrap inline-flex items-center gap-2"
                  onClick={() => setBulkEditOpen(true)}
                  disabled={selectedCount === 0 || bulkBusy}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Modifica
                </button>
                <button
                  type="button"
                  className="lp-btn-secondary whitespace-nowrap inline-flex items-center gap-2"
                  onClick={() => setBulkRenameOpen(true)}
                  disabled={selectedCount === 0 || bulkBusy}
                >
                  <FileSignature className="w-4 h-4" />
                  Rinomina
                </button>
                <button type="button" className="lp-btn-secondary inline-flex items-center gap-2" onClick={() => setBackupOpen(true)}>
                  <Archive className="w-4 h-4" />
                  Backup
                </button>
              </div>
            </div>

            {bulkProgress ? (
              <div className="lp-panel px-3 py-2">
                <div className="text-xs lp-muted">Aggiornamento: {bulkProgress.label}</div>
                <div className="text-sm font-medium">{bulkProgress.done}/{bulkProgress.total}</div>
                <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-2">
                  <div
                    className="h-full"
                    style={{
                      width: bulkProgress.total ? `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` : "0%",
                      backgroundColor: "rgb(var(--lp-accent))",
                    }}
                  />
                </div>
              </div>
            ) : null}

            <Modal
              open={backupOpen}
              title="Backup documenti"
              description="Esporta la selezione corrente: manifest JSON e/o ZIP con i file."
              onClose={() => {
                if (backupBusy) return;
                setBackupSource("auto");
                setBackupOpen(false);
              }}
            >
              <div className="space-y-3">
                <div className="text-sm">
                  Documento/i inclusi: <span className="font-semibold">{backupItems.length}</span>
                </div>

                <div className="lp-panel px-3 py-2">
                  <div className="text-xs lp-muted">Sorgente</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className={(backupSource === "auto" ? "lp-btn-primary" : "lp-btn-secondary") + " whitespace-nowrap"}
                      disabled={backupBusy}
                      onClick={() => setBackupSource("auto")}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className={(backupSource === "selected" ? "lp-btn-primary" : "lp-btn-secondary") + " whitespace-nowrap"}
                      disabled={backupBusy || selectedCount === 0}
                      onClick={() => setBackupSource("selected")}
                    >
                      Selezione ({selectedCount})
                    </button>
                    <button
                      type="button"
                      className={(backupSource === "filtered" ? "lp-btn-primary" : "lp-btn-secondary") + " whitespace-nowrap"}
                      disabled={backupBusy}
                      onClick={() => setBackupSource("filtered")}
                    >
                      Filtri ({filtered.length})
                    </button>
                  </div>
                  <div className="mt-2 text-xs lp-muted">
                    Auto usa la selezione se presente, altrimenti la lista filtrata.
                  </div>
                </div>

                <div className="text-xs lp-muted">
                  Stima dimensione: {Math.round(backupStats.totalBytes / 1024 / 1024)} MB
                  {backupStats.demoCount ? ` · Demo: ${backupStats.demoCount}` : ""}
                </div>

                {backupProgress ? (
                  <div className="lp-panel px-3 py-2">
                    <div className="text-xs lp-muted">{backupProgress.label}</div>
                    <div className="text-sm font-medium">{backupProgress.done}/{backupProgress.total}</div>
                    <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-2">
                      <div
                        className="h-full"
                        style={{
                          width: backupProgress.total ? `${Math.round((backupProgress.done / backupProgress.total) * 100)}%` : "0%",
                          backgroundColor: "rgb(var(--lp-accent))",
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={backupBusy || backupItems.length === 0}
                    onClick={() => void exportManifestJson(backupItems)}
                  >
                    Esporta manifest (JSON)
                  </button>
                  <button
                    type="button"
                    className="lp-btn-primary"
                    disabled={backupBusy || backupItems.length === 0}
                    onClick={() => void exportZip(backupItems)}
                  >
                    {backupBusy ? "Esporto…" : "Backup ZIP"}
                  </button>
                  {backupBusy ? (
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={() => {
                        backupAbortRef.current?.abort();
                      }}
                    >
                      Annulla
                    </button>
                  ) : null}
                </div>
                <div className="text-xs lp-muted">
                  Nota: in modalità demo i file non sono permanenti, quindi lo ZIP può non includerli.
                </div>
              </div>
            </Modal>

            {visible.length === 0 ? (
              <EmptyState title={uxCopy.documents.emptyResultsTitle} description={uxCopy.documents.emptyResultsDescription} />
            ) : (
              <div className="space-y-2">
                {visible.map((d) => (
                  <div key={d.id} id={`doc-${d.id}`} className="lp-panel px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <label className="pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedById[d.id])}
                            onChange={(e) => toggleSelected(d.id, e.target.checked)}
                          />
                        </label>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-sm font-medium truncate text-left hover:underline"
                            disabled={d.uploadStatus === "uploading" || d.uploadStatus === "failed"}
                            onClick={() => void openDoc(d)}
                          >
                            {d.title ? d.title : d.name}
                          </button>
                          {d.isFavorite ? <Star className="w-4 h-4" style={{ color: "rgb(var(--lp-warning))" }} /> : null}
                          {d.uploadStatus === "uploading" ? (
                            <span className="lp-badge" style={{ background: "rgba(var(--lp-primary),0.12)", border: "1px solid rgba(var(--lp-primary),0.22)", color: "rgb(var(--lp-primary-700))" }}>
                              In caricamento…
                            </span>
                          ) : d.uploadStatus === "failed" ? (
                            <span className="lp-badge" style={{ background: "rgba(var(--lp-danger),0.12)", border: "1px solid rgba(var(--lp-danger),0.22)", color: "rgb(var(--lp-danger))" }}>
                              Upload fallito
                            </span>
                          ) : null}
                          {d.docType ? (
                            <button
                              type="button"
                              className="lp-badge lp-badge-info"
                              onClick={() => setTypeFilter(d.docType || "all")}
                            >
                              {docTypeLabel(d.docType)}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="lp-badge"
                              onClick={() => openEdit(d)}
                              title="Aggiungi categoria"
                            >
                              Senza categoria
                            </button>
                          )}
                          </div>
                          {d.title ? <div className="text-xs lp-muted truncate">File: {d.name}</div> : null}
                          {d.uploadStatus === "failed" && d.uploadError ? (
                            <div className="text-xs" style={{ color: "rgb(var(--lp-danger))" }}>
                              {d.uploadError}
                            </div>
                          ) : null}
                          {d.tags && d.tags.length ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {d.tags.slice(0, 6).map((t) => (
                                <button
                                  type="button"
                                  key={t}
                                  className="lp-badge"
                                  onClick={() => setTagFilter(String(t || "all"))}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="text-xs lp-muted">
                            {(d.size ? `${(d.size / 1024).toFixed(0)} KB` : "—")}
                            {" · "}
                            Data: {new Date((d.documentAt ?? d.createdAt) as number).toLocaleDateString()}
                            {" · "}
                            Caricato: {new Date(d.createdAt).toLocaleString()}
                          </div>
                      </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button type="button" className="lp-btn-icon" disabled={busyId === d.id} onClick={() => void toggleFavorite(d)}>
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="lp-btn-icon"
                          disabled={busyId === d.id || d.uploadStatus === "uploading" || d.uploadStatus === "failed"}
                          onClick={() => void openDoc(d)}
                        >
                          Apri
                        </button>
                        <button
                          type="button"
                          className="lp-btn-icon"
                          disabled={busyId === d.id || d.uploadStatus === "uploading" || d.uploadStatus === "failed"}
                          onClick={() => void downloadDoc(d)}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {d.uploadStatus === "failed" ? (
                          <button
                            type="button"
                            className="lp-btn-icon"
                            disabled={busyId === d.id || !user || !activePetId}
                            onClick={() => {
                              setRetryAll(null);
                              setRetryDocId(d.id);
                            }}
                          >
                            <RotateCw className="w-4 h-4" />
                            Riprendi
                          </button>
                        ) : null}
                        <button type="button" className="lp-btn-icon" disabled={busyId === d.id} onClick={() => openEdit(d)}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activePetId) return;
                            const ok = await confirmDialog({
                              title: "Elimina documento",
                              description: `Vuoi eliminare "${d.name}"?`,
                              confirmLabel: "Elimina",
                              variant: "danger",
                            });
                            if (!ok) return;
                            setBusyId(d.id);
                            setInlineError(null);
                            try {
                              await deletePetDocument(activePetId, d.id, d.storagePath);
                              pushToast({ type: "success", title: "Documento eliminato", message: "Rimosso." });
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : "Eliminazione fallita";
                              setInlineError(msg);
                              pushToast({ type: "error", title: "Errore", message: msg });
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === d.id}
                          className="lp-btn-icon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </CardContent>
      </Card>

      </div>
    </div>
  );
}

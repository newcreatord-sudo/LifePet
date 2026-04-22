import type { PetDocument } from "@/types";

export type DocsFilters = {
  q: string;
  docType: PetDocument["docType"] | "all";
  tag: string | "all";
  favoriteOnly: boolean;
  fromMs?: number;
  toMs?: number;
};

export function docEffectiveAt(d: PetDocument) {
  return typeof d.documentAt === "number" && Number.isFinite(d.documentAt) ? d.documentAt : d.createdAt;
}

export function filterPetDocuments(docs: PetDocument[], filters: DocsFilters) {
  const needle = String(filters.q || "").trim().toLowerCase();
  const type = filters.docType;
  const tag = String(filters.tag || "all");
  const favoriteOnly = Boolean(filters.favoriteOnly);
  const fromMs = typeof filters.fromMs === "number" && Number.isFinite(filters.fromMs) ? filters.fromMs : null;
  const toMs = typeof filters.toMs === "number" && Number.isFinite(filters.toMs) ? filters.toMs : null;

  return docs
    .filter((d) => (favoriteOnly ? Boolean(d.isFavorite) : true))
    .filter((d) => (type === "all" ? true : d.docType === type))
    .filter((d) => {
      if (tag === "all") return true;
      const list = Array.isArray(d.tags) ? d.tags : [];
      const needleTag = tag.toLowerCase();
      return list.some((t) => String(t).toLowerCase() === needleTag);
    })
    .filter((d) => {
      const ts = docEffectiveAt(d);
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    })
    .filter((d) => {
      if (!needle) return true;
      const text = `${d.title || ""} ${d.name || ""} ${d.docType || ""} ${(d.tags || []).join(" ")}`.toLowerCase();
      return text.includes(needle);
    })
    .slice()
    .sort((a, b) => docEffectiveAt(b) - docEffectiveAt(a));
}

export function docTypeLabel(t: PetDocument["docType"] | "all") {
  if (t === "referto") return "Referto";
  if (t === "ricetta") return "Ricetta";
  if (t === "vaccino") return "Vaccino";
  if (t === "analisi") return "Analisi";
  if (t === "altro") return "Altro";
  return "Tutti";
}

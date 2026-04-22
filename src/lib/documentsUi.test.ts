import { describe, expect, it } from "vitest";
import { filterPetDocuments } from "@/lib/documentsUi";
import type { PetDocument } from "@/types";

function d(partial: Partial<PetDocument> & Pick<PetDocument, "id" | "petId" | "name" | "storagePath" | "createdAt" | "createdBy">): PetDocument {
  return partial as PetDocument;
}

describe("documentsUi", () => {
  it("filters by query over title/name", () => {
    const docs: PetDocument[] = [
      d({ id: "1", petId: "p", name: "referto_raggi.pdf", title: "RX torace", storagePath: "x", createdAt: 10, createdBy: "u", docType: "referto" }),
      d({ id: "2", petId: "p", name: "ricetta.txt", title: "", storagePath: "y", createdAt: 20, createdBy: "u", docType: "ricetta" }),
    ];
    expect(filterPetDocuments(docs, { q: "torace", docType: "all", tag: "all", favoriteOnly: false }).map((x) => x.id)).toEqual(["1"]);
    expect(filterPetDocuments(docs, { q: "ricetta", docType: "all", tag: "all", favoriteOnly: false }).map((x) => x.id)).toEqual(["2"]);
  });

  it("filters by docType", () => {
    const docs: PetDocument[] = [
      d({ id: "1", petId: "p", name: "a.pdf", storagePath: "x", createdAt: 10, createdBy: "u", docType: "referto" }),
      d({ id: "2", petId: "p", name: "b.pdf", storagePath: "y", createdAt: 20, createdBy: "u", docType: "ricetta" }),
    ];
    expect(filterPetDocuments(docs, { q: "", docType: "referto", tag: "all", favoriteOnly: false }).map((x) => x.id)).toEqual(["1"]);
  });

  it("filters by date range using documentAt when present", () => {
    const docs: PetDocument[] = [
      d({ id: "1", petId: "p", name: "a.pdf", storagePath: "x", createdAt: 10, createdBy: "u", documentAt: 1_000 }),
      d({ id: "2", petId: "p", name: "b.pdf", storagePath: "y", createdAt: 20, createdBy: "u", documentAt: 2_000 }),
      d({ id: "3", petId: "p", name: "c.pdf", storagePath: "z", createdAt: 3_000, createdBy: "u" }),
    ];
    expect(
      filterPetDocuments(docs, { q: "", docType: "all", tag: "all", favoriteOnly: false, fromMs: 1_500, toMs: 2_500 }).map((x) => x.id)
    ).toEqual(["2"]);
    expect(filterPetDocuments(docs, { q: "", docType: "all", tag: "all", favoriteOnly: false, fromMs: 2_500 }).map((x) => x.id)).toEqual(["3"]);
  });

  it("filters by tag and favorites", () => {
    const docs: PetDocument[] = [
      d({ id: "1", petId: "p", name: "a.pdf", storagePath: "x", createdAt: 10, createdBy: "u", tags: ["vet", "analisi"], isFavorite: true }),
      d({ id: "2", petId: "p", name: "b.pdf", storagePath: "y", createdAt: 20, createdBy: "u", tags: ["cibo"], isFavorite: false }),
    ];
    expect(filterPetDocuments(docs, { q: "", docType: "all", tag: "vet", favoriteOnly: false }).map((x) => x.id)).toEqual(["1"]);
    expect(filterPetDocuments(docs, { q: "", docType: "all", tag: "all", favoriteOnly: true }).map((x) => x.id)).toEqual(["1"]);
  });
});

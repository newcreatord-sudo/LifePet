import { describe, expect, it, beforeEach } from "vitest";
import { usePetStore } from "@/stores/petStore";

beforeEach(() => {
  usePetStore.setState({ activePetId: null, pets: [] });
});

describe("petStore", () => {
  it("imposta activePetId sul primo pet se nullo", () => {
    usePetStore.getState().setPets([
      { id: "p1", ownerId: "u1", name: "A", species: "dog", createdAt: 1 },
      { id: "p2", ownerId: "u1", name: "B", species: "cat", createdAt: 2 },
    ]);
    expect(usePetStore.getState().activePetId).toBe("p1");
  });

  it("mantiene activePetId se presente nella lista", () => {
    usePetStore.setState({ activePetId: "p2", pets: [] });
    usePetStore.getState().setPets([
      { id: "p1", ownerId: "u1", name: "A", species: "dog", createdAt: 1 },
      { id: "p2", ownerId: "u1", name: "B", species: "cat", createdAt: 2 },
    ]);
    expect(usePetStore.getState().activePetId).toBe("p2");
  });

  it("ripristina activePetId se non esiste più", () => {
    usePetStore.setState({ activePetId: "gone", pets: [] });
    usePetStore.getState().setPets([{ id: "p1", ownerId: "u1", name: "A", species: "dog", createdAt: 1 }]);
    expect(usePetStore.getState().activePetId).toBe("p1");
  });
});


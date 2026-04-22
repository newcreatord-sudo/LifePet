import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtimeMode", () => ({
  shouldUseDemoData: vi.fn(() => true),
}));

vi.mock("@/multispecies/data/msRepo", () => ({
  subscribeSubjects: vi.fn(() => () => {}),
}));

vi.mock("@/multispecies/data/msFirestoreRepo", () => ({
  subscribeSubjects: vi.fn(() => () => {}),
}));

describe("msData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega a demo repo quando shouldUseDemoData() è true", async () => {
    const { shouldUseDemoData } = await import("@/lib/runtimeMode");
    (shouldUseDemoData as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const demo = await import("@/multispecies/data/msRepo");
    const fs = await import("@/multispecies/data/msFirestoreRepo");
    const { subscribeSubjects } = await import("@/multispecies/data/msData");

    const onData = vi.fn();
    subscribeSubjects("u1", onData);
    expect(demo.subscribeSubjects).toHaveBeenCalledTimes(1);
    expect(fs.subscribeSubjects).toHaveBeenCalledTimes(0);
  });

  it("delega a firestore repo quando shouldUseDemoData() è false", async () => {
    const { shouldUseDemoData } = await import("@/lib/runtimeMode");
    (shouldUseDemoData as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const demo = await import("@/multispecies/data/msRepo");
    const fs = await import("@/multispecies/data/msFirestoreRepo");
    const { subscribeSubjects } = await import("@/multispecies/data/msData");

    const onData = vi.fn();
    subscribeSubjects("u1", onData);
    expect(fs.subscribeSubjects).toHaveBeenCalledTimes(1);
    expect(demo.subscribeSubjects).toHaveBeenCalledTimes(0);
  });
});

import { describe, expect, it } from "vitest";
import { randomHexToken, sha256Hex } from "@/lib/crypto";

describe("crypto", () => {
  it("randomHexToken returns hex of expected length", () => {
    const t = randomHexToken(24);
    expect(t).toMatch(/^[0-9a-f]+$/);
    expect(t.length).toBe(48);
  });

  it("sha256Hex matches known vector", async () => {
    const h = await sha256Hex("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});


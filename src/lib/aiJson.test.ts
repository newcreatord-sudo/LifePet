import { describe, expect, it } from "vitest";
import { extractJsonValue } from "@/lib/aiJson";

describe("extractJsonValue", () => {
  it("parsa JSON puro", () => {
    expect(extractJsonValue('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonValue("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("estrae JSON da testo con rumore", () => {
    const raw = "risposta: {\"events\":[{\"title\":\"x\",\"dueAt\":1,\"kind\":\"other\"}],\"confidence\":0.9} fine";
    expect(extractJsonValue(raw)).toEqual({ events: [{ title: "x", dueAt: 1, kind: "other" }], confidence: 0.9 });
  });

  it("ritorna null su input vuoto o non JSON", () => {
    expect(extractJsonValue("")).toBeNull();
    expect(extractJsonValue("ciao")).toBeNull();
  });
});


import { describe, expect, it } from "vitest";
import { TractiveAdapter, CowManagerAdapter } from "@/multispecies/adapters/mock/mockAdapters";

describe("mock adapters", () => {
  it("TractiveAdapter normalizza GPS + geofence + batteria", () => {
    const now = Date.now();
    const res = TractiveAdapter.normalizeTelemetry({
      subjectId: "s1",
      deviceId: "d1",
      receivedAt: now,
      payload: {
        ts: now - 500,
        battery: 80,
        signal: 55,
        online: true,
        lat: 45.1,
        lng: 9.2,
        speed: 2.4,
        geofence: "breach",
        activity: 62,
        sleepMin: 220,
      },
    });

    const types = new Set(res.samples.map((s) => s.metricType));
    expect(types.has("location_lat")).toBe(true);
    expect(types.has("location_lng")).toBe(true);
    expect(types.has("speed")).toBe(true);
    expect(types.has("geofence_status")).toBe(true);
    expect(types.has("device_battery_level")).toBe(true);
    expect(res.devicePatch?.isOnline).toBe(true);
  });

  it("CowManagerAdapter normalizza ruminazione e estro", () => {
    const now = Date.now();
    const res = CowManagerAdapter.normalizeTelemetry({
      subjectId: "c1",
      deviceId: "d2",
      receivedAt: now,
      payload: {
        ts: now,
        battery: 34,
        signal: 71,
        online: true,
        earTemp: 38.3,
        rumMin: 190,
        activity: 72,
        estrusP: 0.82,
        insemination: 0.64,
      },
    });

    const types = new Set(res.samples.map((s) => s.metricType));
    expect(types.has("ear_temperature")).toBe(true);
    expect(types.has("rumination_duration")).toBe(true);
    expect(types.has("estrus_probability")).toBe(true);
    expect(types.has("insemination_window_score")).toBe(true);
  });
});


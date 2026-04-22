import { describe, expect, it } from "vitest";
import { evaluateAlerts } from "@/multispecies/engine/AlertEngine";
import type { AlertEvent, AlertRule, Device, DeviceBinding, MetricSample, Subject } from "@/multispecies/types";

function makeBase(now: number) {
  const subject: Subject = {
    id: "s1",
    type: "pet",
    species: "dog",
    displayName: "Luna",
    ownerId: "demo",
    status: "normal",
    createdAt: now - 1000,
    updatedAt: now - 1000,
  };
  const device: Device = {
    id: "d1",
    brand: "Tractive",
    model: "GPS",
    adapterType: "TractiveAdapter",
    category: "gps_tracker",
    connectivityType: "lte",
    isOnline: true,
    supportedMetrics: ["body_temperature", "device_online"],
    supportedAlerts: [],
    metadata: {},
    status: "connected",
    createdAt: now - 1000,
    updatedAt: now - 1000,
  };
  const binding: DeviceBinding = { id: "b1", deviceId: "d1", subjectId: "s1", boundAt: now - 1000 };
  return { subject, device, binding };
}

describe("AlertEngine", () => {
  it("apre un alert threshold quando una metrica supera la soglia", () => {
    const now = Date.now();
    const { subject, device, binding } = makeBase(now);

    const rule: AlertRule = {
      id: "r1",
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "pet",
      metricType: "body_temperature",
      operator: ">=",
      threshold: 39.5,
      windowMinutes: 15,
      severity: "warning",
      category: "health",
      title: "Febbre",
      description: "Temperatura sopra soglia",
      recommendedActions: ["Controllo"],
      createdAt: now - 1000,
    };

    const samples: MetricSample[] = [
      {
        id: "m1",
        subjectId: subject.id,
        deviceId: device.id,
        metricType: "body_temperature",
        value: 40.1,
        unit: "°C",
        qualityScore: 1,
        sourceTimestamp: now - 1000 * 60,
        receivedAt: now - 1000 * 60,
        sourceType: "device",
      },
    ];

    const res = evaluateAlerts({
      now,
      subjects: [subject],
      devices: [device],
      bindings: [binding],
      rules: [rule],
      samples,
      existingAlerts: [],
    });

    expect(res.nextAlerts.filter((a) => a.status === "open")).toHaveLength(1);
    expect(res.notificationsToCreate).toHaveLength(1);
    expect(res.nextAlerts[0].ruleId).toBe("r1");
  });

  it("chiude un alert threshold quando la condizione non è più vera", () => {
    const now = Date.now();
    const { subject, device, binding } = makeBase(now);

    const rule: AlertRule = {
      id: "r1",
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "pet",
      metricType: "body_temperature",
      operator: ">=",
      threshold: 39.5,
      windowMinutes: 10,
      severity: "warning",
      category: "health",
      title: "Febbre",
      createdAt: now - 1000,
    };

    const existing: AlertEvent = {
      id: "a1",
      ruleId: "r1",
      subjectId: subject.id,
      deviceId: device.id,
      severity: "warning",
      category: "health",
      title: "Febbre",
      description: "",
      recommendedActions: [],
      triggeredAt: now - 1000 * 60 * 5,
      source: "engine:threshold",
      status: "open",
    };

    const samples: MetricSample[] = [
      {
        id: "m2",
        subjectId: subject.id,
        deviceId: device.id,
        metricType: "body_temperature",
        value: 38.7,
        unit: "°C",
        sourceTimestamp: now - 1000 * 60,
        receivedAt: now - 1000 * 60,
        sourceType: "device",
      },
    ];

    const res = evaluateAlerts({
      now,
      subjects: [subject],
      devices: [device],
      bindings: [binding],
      rules: [rule],
      samples,
      existingAlerts: [existing],
    });

    expect(res.nextAlerts.find((a) => a.id === "a1")?.status).toBe("closed");
  });

  it("genera un alert anomaly quando lo z-score supera la soglia", () => {
    const now = Date.now();
    const { subject, device, binding } = makeBase(now);
    const rule: AlertRule = {
      id: "rA",
      type: "anomaly",
      enabled: true,
      scope: "type",
      subjectType: "pet",
      metricType: "activity_score",
      windowMinutes: 120,
      severity: "warning",
      category: "health",
      title: "Attività anomala",
      createdAt: now - 1000,
    };

    const samples: MetricSample[] = Array.from({ length: 12 }).map((_, i) => {
      const v = i === 0 ? 96 : 48 + (i % 3);
      return {
        id: `m${i}`,
        subjectId: subject.id,
        deviceId: device.id,
        metricType: "activity_score",
        value: v,
        sourceTimestamp: now - i * 1000 * 60,
        receivedAt: now - i * 1000 * 60,
        sourceType: "device",
      };
    });

    const res = evaluateAlerts({
      now,
      subjects: [subject],
      devices: [device],
      bindings: [binding],
      rules: [rule],
      samples,
      existingAlerts: [],
    });

    expect(res.nextAlerts.some((a) => a.ruleId === "rA" && a.status === "open")).toBe(true);
  });
});


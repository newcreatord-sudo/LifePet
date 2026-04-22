import { demoRead } from "@/lib/demoDb";
import { MOCK_ADAPTERS_BY_TYPE } from "@/multispecies/adapters/mock/mockAdapters";
import { msKey } from "@/multispecies/data/msKeys";
import { getBoundSubjectId, ingestSamples } from "@/multispecies/data/msRepo";
import type { Device, MetricSample, Subject } from "@/multispecies/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function chance(p: number) {
  return Math.random() < p;
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function subjectBaselines(subject: Subject) {
  if (subject.type === "pet") {
    return {
      hr: subject.species === "cat" ? 140 : 96,
      rr: subject.species === "cat" ? 28 : 22,
      temp: subject.species === "cat" ? 38.6 : 38.4,
      activity: subject.species === "cat" ? 48 : 55,
    };
  }
  return {
    earTemp: 38.2,
    innerTemp: 38.6,
    rumMin: 320,
    rumScore: 62,
    activity: 44,
    inactiveMin: 18,
    estrusP: 0.08,
    insemination: 0.05,
    illness: 0.12,
    ph: 6.5,
  };
}

export function runMultiSpeciesDemoTick(args?: { intensity?: number }) {
  const intensity = clamp(args?.intensity ?? 0.35, 0.05, 1);
  const now = Date.now();
  const subjects = demoRead<Subject[]>(msKey("subjects"), []);
  const devices = demoRead<Device[]>(msKey("devices"), []);

  const subjectsById = new Map(subjects.map((s) => [s.id, s] as const));
  const samples: MetricSample[] = [];
  const devicePatchById: Record<string, Partial<Device>> = {};

  for (const d of devices) {
    const subjectId = getBoundSubjectId("demo", d.id);
    if (!subjectId) continue;
    const subject = subjectsById.get(subjectId);
    if (!subject) continue;
    const adapter = MOCK_ADAPTERS_BY_TYPE[d.adapterType];
    if (!adapter) continue;

    const base = subjectBaselines(subject);
    const battery = clamp((d.batteryLevel ?? 70) - rand(0, 0.08) * (intensity * 4), 3, 100);
    const signal = clamp((d.signalStrength ?? 60) + gaussian() * 1.5, 5, 100);
    const online = chance(0.01 * intensity) ? false : d.isOnline;

    const spike = chance(0.02 * intensity);
    const fever = chance(0.008 * intensity);
    const rumDrop = subject.type !== "pet" && chance(0.02 * intensity);
    const geofenceBreach = subject.type === "pet" && chance(0.01 * intensity);
    const estrus = subject.type !== "pet" && chance(0.015 * intensity);

    const payload: Record<string, unknown> = {
      ts: now,
      battery: battery,
      signal: signal,
      online: online,
    };

    if (subject.type === "pet") {
      const b = base as { hr: number; rr: number; temp: number; activity: number };
      payload.hr = clamp(b.hr + gaussian() * 6 + (spike ? 28 : 0), 40, 220);
      payload.rr = clamp(b.rr + gaussian() * 3 + (spike ? 18 : 0), 8, 90);
      payload.temp = clamp(b.temp + gaussian() * 0.15 + (fever ? 1.0 : 0), 36.5, 41.8);
      payload.activity = clamp(b.activity + gaussian() * 8 + (spike ? 25 : 0), 0, 100);
      payload.sleepMin = clamp(60 + rand(0, 240), 0, 600);

      const centerLat = 45.4642;
      const centerLng = 9.19;
      const drift = 0.0012;
      payload.lat = centerLat + gaussian() * drift + (geofenceBreach ? 0.008 : 0);
      payload.lng = centerLng + gaussian() * drift + (geofenceBreach ? 0.008 : 0);
      payload.speed = clamp(rand(0, 2.2) + (spike ? 3.2 : 0), 0, 10);
      payload.geofence = geofenceBreach ? "breach" : "ok";
      payload.steps = Math.round(clamp(rand(0, 230) + (spike ? 420 : 0), 0, 2000));
    } else {
      const b = base as {
        earTemp: number;
        innerTemp: number;
        rumMin: number;
        rumScore: number;
        activity: number;
        inactiveMin: number;
        estrusP: number;
        insemination: number;
        illness: number;
        ph: number;
      };
      payload.earTemp = clamp(b.earTemp + gaussian() * 0.18 + (fever ? 0.8 : 0), 36.5, 41.8);
      payload.innerTemp = clamp(b.innerTemp + gaussian() * 0.15 + (fever ? 1.0 : 0), 36.5, 42.2);
      payload.rumMin = clamp(b.rumMin + gaussian() * 35 + (rumDrop ? -190 : 0), 40, 520);
      payload.rumScore = clamp(b.rumScore + gaussian() * 8 + (rumDrop ? -18 : 0), 0, 100);
      payload.activity = clamp(b.activity + gaussian() * 9 + (estrus ? 30 : 0), 0, 100);
      payload.inactiveMin = clamp(b.inactiveMin + gaussian() * 6 + (rumDrop ? 28 : 0), 0, 240);
      payload.estrusP = clamp(b.estrusP + (estrus ? 0.75 : 0) + gaussian() * 0.06, 0, 1);
      payload.insemination = clamp(b.insemination + (estrus ? 0.65 : 0) + gaussian() * 0.05, 0, 1);
      payload.illness = clamp(b.illness + (rumDrop || fever ? 0.5 : 0) + gaussian() * 0.05, 0, 1);
      payload.ph = clamp(b.ph + gaussian() * 0.08, 5.5, 7.4);
    }

    const normalized = adapter.normalizeTelemetry({ subjectId, deviceId: d.id, receivedAt: now, payload });
    samples.push(...normalized.samples);
    if (normalized.devicePatch) {
      devicePatchById[d.id] = {
        batteryLevel: normalized.devicePatch.batteryLevel,
        signalStrength: normalized.devicePatch.signalStrength,
        isOnline: normalized.devicePatch.isOnline,
        lastSeenAt: normalized.devicePatch.lastSeenAt,
        status: normalized.devicePatch.status,
      };
    }
  }

  if (samples.length) ingestSamples("demo", samples, devicePatchById);
}

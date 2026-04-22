import { demoId } from "@/lib/demoDb";
import type { DeviceAdapter } from "@/multispecies/adapters/DeviceAdapter";
import type { MetricSample, MetricType } from "@/multispecies/types";

function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "1" || v === 1) return true;
  if (v === "0" || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function sample(args: {
  subjectId: string;
  deviceId: string;
  metricType: MetricType;
  value: number | boolean | string;
  unit?: string;
  sourceTimestamp: number;
  receivedAt: number;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
}): MetricSample {
  return {
    id: demoId(),
    subjectId: args.subjectId,
    deviceId: args.deviceId,
    metricType: args.metricType,
    value: args.value,
    unit: args.unit,
    qualityScore: 0.92,
    sourceTimestamp: args.sourceTimestamp,
    receivedAt: args.receivedAt,
    sourceType: "device",
    rawPayload: args.rawPayload,
    normalizedPayload: args.normalizedPayload,
  };
}

function buildGenericAdapter(meta: {
  adapterType: string;
  brand: string;
  modelHint: string;
  supportedMetrics: MetricType[];
  supportedAlerts: string[];
  integrationLevel: "mock" | "beta" | "ready" | "planned";
  category: "collar" | "ear_tag" | "bolus" | "harness" | "clip" | "gps_tracker" | "biometric_sensor";
  connectivity: Array<"bluetooth" | "wifi" | "lte" | "lorawan" | "gateway" | "satellite" | "mixed">;
  speciesSupported: Array<"pet" | "bovine">;
}) {
  const adapter: DeviceAdapter = {
    identify: () => ({ adapterType: meta.adapterType, brand: meta.brand }),
    capabilities: () => ({
      adapterType: meta.adapterType,
      brand: meta.brand,
      integrationLevel: meta.integrationLevel,
      deviceCategory: meta.category,
      connectivity: meta.connectivity,
      speciesSupported: meta.speciesSupported,
      supportedMetrics: meta.supportedMetrics,
      supportedAlerts: meta.supportedAlerts,
    }),
    registerDevice: (input) => {
      const externalDeviceId = `${meta.adapterType}:${input.serialNumber || demoId()}`;
      return {
        externalDeviceId,
        adapterConfig: {
          vendor: meta.brand,
          modelHint: meta.modelHint,
          createdAt: Date.now(),
        },
      };
    },
    normalizeTelemetry: ({ subjectId, deviceId, receivedAt, payload }) => {
      const ts = n(payload.ts) ?? receivedAt;
      const out: MetricSample[] = [];

      const battery = n(payload.battery);
      const signal = n(payload.signal);
      const online = bool(payload.online);

      if (battery !== null) {
        out.push(sample({ subjectId, deviceId, metricType: "device_battery_level", value: battery, unit: "%", sourceTimestamp: ts, receivedAt, rawPayload: payload }));
      }
      if (signal !== null) {
        out.push(sample({ subjectId, deviceId, metricType: "device_signal_strength", value: signal, unit: "%", sourceTimestamp: ts, receivedAt, rawPayload: payload }));
      }
      if (online !== null) {
        out.push(sample({ subjectId, deviceId, metricType: "device_online", value: online, sourceTimestamp: ts, receivedAt, rawPayload: payload }));
      }

      const mappings: Array<[MetricType, string, string | undefined]> = [
        ["heart_rate", "hr", "bpm"],
        ["respiratory_rate", "rr", "rpm"],
        ["body_temperature", "temp", "°C"],
        ["ear_temperature", "earTemp", "°C"],
        ["inner_body_temperature", "innerTemp", "°C"],
        ["hrv", "hrv", "ms"],
        ["activity_score", "activity", undefined],
        ["sleep_duration", "sleepMin", "min"],
        ["sleep_quality", "sleepQ", undefined],
        ["step_count", "steps", "count"],
        ["rumination_duration", "rumMin", "min"],
        ["rumination_score", "rumScore", undefined],
        ["eating_duration", "eatMin", "min"],
        ["drinking_duration", "drinkMin", "min"],
        ["water_intake", "waterMl", "ml"],
        ["inactivity_duration", "inactiveMin", "min"],
        ["estrus_probability", "estrusP", undefined],
        ["insemination_window_score", "insemination", undefined],
        ["illness_risk_score", "illness", undefined],
        ["stress_score", "stress", undefined],
        ["location_lat", "lat", "deg"],
        ["location_lng", "lng", "deg"],
        ["speed", "speed", "m/s"],
        ["geofence_status", "geofence", undefined],
      ];

      for (const [metricType, key, unit] of mappings) {
        if (!meta.supportedMetrics.includes(metricType)) continue;
        const raw = payload[key];
        if (metricType === "geofence_status") {
          const v = typeof raw === "string" ? raw : raw === null || raw === undefined ? null : String(raw);
          if (v) out.push(sample({ subjectId, deviceId, metricType, value: v, unit, sourceTimestamp: ts, receivedAt, rawPayload: payload }));
          continue;
        }
        const v = n(raw);
        if (v === null) continue;
        out.push(sample({ subjectId, deviceId, metricType, value: v, unit, sourceTimestamp: ts, receivedAt, rawPayload: payload }));
      }

      return {
        samples: out,
        devicePatch: {
          batteryLevel: battery ?? undefined,
          signalStrength: signal ?? undefined,
          isOnline: online ?? undefined,
          lastSeenAt: receivedAt,
          status: online === false ? "offline" : battery !== null && battery <= 15 ? "battery_low" : "connected",
        },
      };
    },
  };
  return adapter;
}

export const PetPaceAdapter = buildGenericAdapter({
  adapterType: "PetPaceAdapter",
  brand: "PetPace",
  modelHint: "Health Collar",
  supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "hrv", "activity_score", "resting_state", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["fever", "respiratory_out_of_range", "tachycardia", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "collar",
  connectivity: ["lte"],
  speciesSupported: ["pet"],
});

export const TractiveAdapter = buildGenericAdapter({
  adapterType: "TractiveAdapter",
  brand: "Tractive",
  modelHint: "GPS Tracker",
  supportedMetrics: ["location_lat", "location_lng", "speed", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "gps_tracker",
  connectivity: ["lte"],
  speciesSupported: ["pet"],
});

export const FiAdapter = buildGenericAdapter({
  adapterType: "FiAdapter",
  brand: "Fi",
  modelHint: "Smart Collar",
  supportedMetrics: ["location_lat", "location_lng", "speed", "step_count", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "collar",
  connectivity: ["lte"],
  speciesSupported: ["pet"],
});

export const CowManagerAdapter = buildGenericAdapter({
  adapterType: "CowManagerAdapter",
  brand: "CowManager",
  modelHint: "Ear Tag",
  supportedMetrics: ["ear_temperature", "movement_activity", "inactivity_duration", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["estrus_detected", "rumination_drop", "fever", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "ear_tag",
  connectivity: ["gateway", "lorawan"],
  speciesSupported: ["bovine"],
});

export const SmaxtecAdapter = buildGenericAdapter({
  adapterType: "SmaxtecAdapter",
  brand: "Smaxtec",
  modelHint: "Bolus",
  supportedMetrics: ["inner_body_temperature", "rumination_score", "movement_activity", "illness_risk_score", "ph_value", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["illness_risk", "fever", "device_offline"],
  integrationLevel: "mock",
  category: "bolus",
  connectivity: ["gateway"],
  speciesSupported: ["bovine"],
});

export const SenseHubAdapter = buildGenericAdapter({
  adapterType: "SenseHubAdapter",
  brand: "SenseHub",
  modelHint: "Collar + Gateway",
  supportedMetrics: ["activity_score", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["estrus_detected", "device_offline"],
  integrationLevel: "mock",
  category: "collar",
  connectivity: ["gateway"],
  speciesSupported: ["bovine"],
});

export const GenericGpsCollarAdapter = buildGenericAdapter({
  adapterType: "GenericGpsCollarAdapter",
  brand: "Generic",
  modelHint: "GPS Collar",
  supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "gps_tracker",
  connectivity: ["lte", "satellite"],
  speciesSupported: ["pet"],
});

export const GenericBluetoothHealthTagAdapter = buildGenericAdapter({
  adapterType: "GenericBluetoothHealthTagAdapter",
  brand: "Generic",
  modelHint: "BLE Tag",
  supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
  supportedAlerts: ["tachycardia", "fever", "device_offline", "battery_low"],
  integrationLevel: "mock",
  category: "biometric_sensor",
  connectivity: ["bluetooth"],
  speciesSupported: ["pet"],
});

export const ManualFarmSensorAdapter = buildGenericAdapter({
  adapterType: "ManualFarmSensorAdapter",
  brand: "Manual",
  modelHint: "Operator Input",
  supportedMetrics: ["body_temperature", "water_intake", "eating_duration", "rumination_duration", "movement_activity"],
  supportedAlerts: ["manual_flag"],
  integrationLevel: "mock",
  category: "clip",
  connectivity: ["mixed"],
  speciesSupported: ["bovine"],
});

export const ALL_MOCK_ADAPTERS: DeviceAdapter[] = [
  PetPaceAdapter,
  TractiveAdapter,
  FiAdapter,
  CowManagerAdapter,
  SmaxtecAdapter,
  SenseHubAdapter,
  GenericGpsCollarAdapter,
  GenericBluetoothHealthTagAdapter,
  ManualFarmSensorAdapter,
];

export const MOCK_ADAPTERS_BY_TYPE = Object.fromEntries(ALL_MOCK_ADAPTERS.map((a) => [a.identify().adapterType, a] as const));


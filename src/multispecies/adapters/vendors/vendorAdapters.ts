import type { DeviceAdapter, DeviceRegistrationInput, NormalizedTelemetryBatch } from "@/multispecies/adapters/DeviceAdapter";
import type { ConnectivityType, DeviceCategory, MetricSample, MetricType, SubjectType } from "@/multispecies/types";

function num(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toSample(args: {
  subjectId: string;
  deviceId: string;
  metricType: MetricType;
  value: number;
  unit?: string;
  sourceTimestamp: number;
  receivedAt: number;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
}): MetricSample {
  return {
    id: `${args.deviceId}:${args.metricType}:${args.sourceTimestamp}`,
    subjectId: args.subjectId,
    deviceId: args.deviceId,
    metricType: args.metricType,
    value: args.value,
    unit: args.unit,
    qualityScore: 0.85,
    sourceTimestamp: args.sourceTimestamp,
    receivedAt: args.receivedAt,
    sourceType: "device",
    rawPayload: args.rawPayload,
    normalizedPayload: args.normalizedPayload,
  };
}

function normalizeGenericVitals(args: {
  subjectId: string;
  deviceId: string;
  receivedAt: number;
  payload: Record<string, unknown>;
}): NormalizedTelemetryBatch {
  const p = args.payload;
  const receivedAt = args.receivedAt;
  const ts = num(p.ts) ?? num(p.timestamp) ?? receivedAt;

  const samples: MetricSample[] = [];
  const normalized: Record<string, unknown> = { ts };

  const hr = num(p.heart_rate ?? p.hr);
  if (hr != null) {
    normalized.heart_rate = hr;
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "heart_rate", value: hr, unit: "bpm", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const rr = num(p.respiratory_rate ?? p.rr);
  if (rr != null) {
    normalized.respiratory_rate = rr;
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "respiratory_rate", value: rr, unit: "rpm", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const temp = num(p.body_temperature ?? p.temp_c ?? p.tempC);
  if (temp != null) {
    normalized.body_temperature = temp;
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "body_temperature", value: temp, unit: "°C", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const act = num(p.activity_score ?? p.activity);
  if (act != null) {
    normalized.activity_score = act;
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "activity_score", value: act, unit: "score", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const lat = num(p.location_lat ?? p.lat);
  const lng = num(p.location_lng ?? p.lng);
  if (lat != null && lng != null) {
    normalized.location = { lat, lng };
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "location_lat", value: lat, unit: "deg", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "location_lng", value: lng, unit: "deg", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const speed = num(p.speed);
  if (speed != null) {
    normalized.speed = speed;
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "speed", value: speed, unit: "m/s", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const battery = num(p.battery ?? p.batteryLevel);
  const signal = num(p.signal ?? p.signalStrength);
  const online = typeof p.isOnline === "boolean" ? p.isOnline : typeof p.online === "boolean" ? p.online : null;

  if (battery != null) {
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "device_battery_level", value: battery, unit: "%", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }
  if (signal != null) {
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "device_signal_strength", value: signal, unit: "%", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }
  if (online != null) {
    samples.push(toSample({ subjectId: args.subjectId, deviceId: args.deviceId, metricType: "device_online", value: online ? 1 : 0, unit: "bool", sourceTimestamp: ts, receivedAt, rawPayload: p, normalizedPayload: normalized }));
  }

  const patch: NormalizedTelemetryBatch["devicePatch"] = {
    batteryLevel: battery ?? undefined,
    signalStrength: signal ?? undefined,
    isOnline: online ?? true,
    lastSeenAt: ts,
    status: online === false ? "offline" : battery != null && battery < 15 ? "battery_low" : "connected",
  };

  return { samples, devicePatch: patch, errors: samples.length ? undefined : ["payload_non_supportato"] };
}

function plannedAdapter(args: {
  adapterType: string;
  brand: string;
  category: DeviceCategory;
  connectivity: ConnectivityType[];
  species: SubjectType[];
  supportedMetrics: MetricType[];
  supportedAlerts: string[];
}): DeviceAdapter {
  return {
    identify: () => ({ adapterType: args.adapterType, brand: args.brand }),
    capabilities: () => ({
      adapterType: args.adapterType,
      brand: args.brand,
      integrationLevel: "planned",
      deviceCategory: args.category,
      connectivity: args.connectivity,
      speciesSupported: args.species,
      supportedMetrics: args.supportedMetrics,
      supportedAlerts: args.supportedAlerts,
    }),
    registerDevice: (input: DeviceRegistrationInput) => {
      const externalDeviceId = `${args.brand}:${input.serialNumber || Math.random().toString(16).slice(2)}`;
      return { externalDeviceId, adapterConfig: { brand: args.brand, model: input.model } };
    },
    normalizeTelemetry: ({ subjectId, deviceId, receivedAt, payload }) => {
      return normalizeGenericVitals({ subjectId, deviceId, receivedAt, payload });
    },
  };
}

export const VENDOR_ADAPTERS: DeviceAdapter[] = [
  plannedAdapter({
    adapterType: "PetPaceAdapter",
    brand: "PetPace",
    category: "collar",
    connectivity: ["lte"],
    species: ["pet"],
    supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "hrv", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["fever", "respiratory_out_of_range", "tachycardia", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "TractiveAdapter",
    brand: "Tractive",
    category: "gps_tracker",
    connectivity: ["lte"],
    species: ["pet"],
    supportedMetrics: ["location_lat", "location_lng", "speed", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "FiAdapter",
    brand: "Fi",
    category: "collar",
    connectivity: ["lte"],
    species: ["pet"],
    supportedMetrics: ["location_lat", "location_lng", "speed", "step_count", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "CowManagerAdapter",
    brand: "CowManager",
    category: "ear_tag",
    connectivity: ["gateway", "lorawan"],
    species: ["livestock"],
    supportedMetrics: ["ear_temperature", "movement_activity", "inactivity_duration", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["estrus_detected", "rumination_drop", "fever", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "SmaxtecAdapter",
    brand: "SmaXtec",
    category: "bolus",
    connectivity: ["gateway"],
    species: ["livestock"],
    supportedMetrics: ["inner_body_temperature", "rumination_score", "movement_activity", "illness_risk_score", "ph_value", "device_signal_strength", "device_online"],
    supportedAlerts: ["illness_risk", "fever", "device_offline"],
  }),
  plannedAdapter({
    adapterType: "SenseHubAdapter",
    brand: "SenseHub",
    category: "collar",
    connectivity: ["gateway"],
    species: ["livestock"],
    supportedMetrics: ["activity_score", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["estrus_detected", "device_offline"],
  }),
  plannedAdapter({
    adapterType: "GenericGpsCollarAdapter",
    brand: "Generic",
    category: "gps_tracker",
    connectivity: ["lte", "satellite"],
    species: ["pet"],
    supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["geofence_breach", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "GenericBluetoothHealthTagAdapter",
    brand: "Generic",
    category: "biometric_sensor",
    connectivity: ["bluetooth"],
    species: ["pet"],
    supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["tachycardia", "fever", "device_offline", "battery_low"],
  }),
  plannedAdapter({
    adapterType: "ManualFarmSensorAdapter",
    brand: "Manual",
    category: "clip",
    connectivity: ["mixed"],
    species: ["livestock"],
    supportedMetrics: ["body_temperature", "water_intake", "eating_duration", "rumination_duration", "movement_activity"],
    supportedAlerts: ["manual_flag"],
  }),
];

export const VENDOR_PAYLOAD_EXAMPLES: Record<string, { title: string; payload: Record<string, unknown> }[]> = {
  TractiveAdapter: [
    {
      title: "GPS + speed + battery",
      payload: { ts: Date.now(), lat: 41.9028, lng: 12.4964, speed: 1.2, battery: 62, signal: 74, online: true },
    },
  ],
  PetPaceAdapter: [
    {
      title: "Vitali",
      payload: { ts: Date.now(), hr: 104, rr: 22, tempC: 38.6, battery: 41, signal: 70, online: true },
    },
  ],
  CowManagerAdapter: [
    {
      title: "Ear tag (rumination + estro)",
      payload: { ts: Date.now(), ear_temperature: 38.9, rumination_duration: 380, movement_activity: 44, estrus_probability: 0.78, battery: 57, signal: 55, online: true },
    },
  ],
};

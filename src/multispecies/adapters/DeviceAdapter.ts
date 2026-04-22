import type { ConnectivityType, DeviceCategory, MetricSample, MetricType, SubjectType } from "@/multispecies/types";

export type DeviceRegistrationInput = {
  brand: string;
  model: string;
  category: DeviceCategory;
  connectivityType: ConnectivityType;
  serialNumber?: string;
  firmwareVersion?: string;
  metadata?: Record<string, unknown>;
};

export type DeviceAdapterCapabilities = {
  adapterType: string;
  brand: string;
  integrationLevel: "mock" | "beta" | "ready" | "planned";
  deviceCategory: DeviceCategory;
  connectivity: ConnectivityType[];
  speciesSupported: SubjectType[];
  supportedMetrics: MetricType[];
  supportedAlerts: string[];
};

export type NormalizedTelemetryBatch = {
  samples: MetricSample[];
  devicePatch?: {
    batteryLevel?: number;
    signalStrength?: number;
    isOnline?: boolean;
    lastSeenAt?: number;
    status?: "connected" | "syncing" | "delayed" | "battery_low" | "offline" | "unsupported_data" | "error";
  };
  errors?: string[];
};

export type DeviceAdapter = {
  identify: () => { adapterType: string; brand: string };
  capabilities: () => DeviceAdapterCapabilities;
  registerDevice: (input: DeviceRegistrationInput) => {
    externalDeviceId: string;
    adapterConfig: Record<string, unknown>;
  };
  normalizeTelemetry: (args: {
    subjectId: string;
    deviceId: string;
    receivedAt: number;
    payload: Record<string, unknown>;
  }) => NormalizedTelemetryBatch;
};


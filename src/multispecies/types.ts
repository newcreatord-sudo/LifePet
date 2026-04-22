export type SubjectType = "pet" | "livestock" | "bovine";

export type Species =
  | "dog"
  | "cat"
  | "cow"
  | "calf"
  | "horse"
  | "goat"
  | "sheep"
  | "pig"
  | "poultry"
  | "other";

export type DeviceCategory = "collar" | "ear_tag" | "bolus" | "harness" | "clip" | "gps_tracker" | "biometric_sensor";

export type ConnectivityType = "bluetooth" | "wifi" | "lte" | "lorawan" | "gateway" | "satellite" | "mixed";

export type MetricType =
  | "heart_rate"
  | "respiratory_rate"
  | "body_temperature"
  | "ear_temperature"
  | "inner_body_temperature"
  | "hrv"
  | "activity_score"
  | "resting_state"
  | "sleep_duration"
  | "sleep_quality"
  | "calories_burned"
  | "step_count"
  | "scratching_index"
  | "licking_index"
  | "barking_index"
  | "eating_duration"
  | "drinking_duration"
  | "water_intake"
  | "rumination_duration"
  | "rumination_score"
  | "movement_activity"
  | "inactivity_duration"
  | "estrus_probability"
  | "heat_cycle_status"
  | "insemination_window_score"
  | "calving_risk_score"
  | "illness_risk_score"
  | "pain_score"
  | "stress_score"
  | "ph_value"
  | "location_lat"
  | "location_lng"
  | "speed"
  | "geofence_status"
  | "ambient_temperature"
  | "ambient_humidity"
  | "device_battery_level"
  | "device_signal_strength"
  | "device_online";

export type MetricSourceType = "device" | "manual" | "inferred" | "vendor_alert";

export type SubjectStatus = "normal" | "attention" | "warning" | "critical" | "offline";

export type DeviceStatus = "connected" | "syncing" | "delayed" | "battery_low" | "offline" | "unsupported_data" | "error";

export type Farm = {
  id: string;
  name: string;
  createdAt: number;
};

export type Herd = {
  id: string;
  farmId: string;
  name: string;
  createdAt: number;
};

export type Geofence = {
  id: string;
  farmId: string;
  herdId?: string;
  name: string;
  shape: "circle";
  center: { lat: number; lng: number };
  radiusM: number;
  createdAt: number;
  updatedAt: number;
};

export type Subject = {
  id: string;
  type: SubjectType;
  species: Species;
  displayName: string;
  breed?: string;
  sex?: "male" | "female" | "unknown";
  reproductiveStatus?: string;
  birthDate?: string;
  weightKg?: number;
  farmTagNumber?: string;
  earTag?: string;
  microchipNumber?: string;
  photoUrl?: string;
  ownerId: string;
  farmId?: string;
  herdId?: string;
  medicalFlags?: string[];
  baselineProfileId?: string;
  alertProfileId?: string;
  status: SubjectStatus;
  createdAt: number;
  updatedAt: number;
};

export type Device = {
  id: string;
  brand: string;
  model: string;
  adapterType: string;
  externalDeviceId?: string;
  category: DeviceCategory;
  serialNumber?: string;
  firmwareVersion?: string;
  connectivityType: ConnectivityType;
  batteryLevel?: number;
  signalStrength?: number;
  isOnline: boolean;
  lastSeenAt?: number;
  supportedMetrics: MetricType[];
  supportedAlerts: string[];
  metadata: Record<string, unknown>;
  adapterConfig?: Record<string, unknown>;
  status: DeviceStatus;
  createdAt: number;
  updatedAt: number;
};

export type DeviceBinding = {
  id: string;
  deviceId: string;
  subjectId: string;
  boundAt: number;
  unboundAt?: number;
};

export type MetricSample = {
  id: string;
  subjectId: string;
  deviceId: string;
  metricType: MetricType;
  value: number | string | boolean;
  unit?: string;
  qualityScore?: number;
  sourceTimestamp: number;
  receivedAt: number;
  sourceType: MetricSourceType;
  rawPayload?: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
};

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertCategory = "health" | "reproductive" | "safety" | "device" | "farm";

export type AlertRuleType = "threshold" | "anomaly" | "trend";

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  enabled: boolean;
  scope: "subject" | "type";
  subjectId?: string;
  subjectType?: SubjectType;
  metricType: MetricType;
  operator?: ">" | ">=" | "<" | "<=" | "==";
  threshold?: number | string | boolean;
  windowMinutes?: number;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description?: string;
  recommendedActions?: string[];
  createdAt: number;
};

export type AlertEvent = {
  id: string;
  ruleId: string;
  subjectId: string;
  deviceId: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  recommendedActions: string[];
  triggeredAt: number;
  resolvedAt?: number;
  source: string;
  confidenceScore?: number;
  linkedMetrics?: Array<{ metricType: MetricType; sampleId: string }>;
  status: "open" | "closed";
};

export type Notification = {
  id: string;
  alertId: string;
  subjectId: string;
  createdAt: number;
  channel: "in_app";
  title: string;
  body: string;
  readAt?: number;
};

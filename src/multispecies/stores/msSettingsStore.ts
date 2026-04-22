import { create } from "zustand";
import type { MetricType, SubjectType } from "@/multispecies/types";

export type MsNotificationChannel = "in_app" | "push" | "email" | "sms";

export type MsNotificationPreferences = {
  enabled: boolean;
  channels: Record<MsNotificationChannel, boolean>;
  minSeverity: "info" | "warning" | "critical";
  quietHours?: { start: string; end: string };
};

export type ThresholdPreset = {
  id: string;
  subjectType: SubjectType;
  metricType: MetricType;
  operator: ">" | ">=" | "<" | "<=";
  threshold: number;
  windowMinutes: number;
  severity: "info" | "warning" | "critical";
  title: string;
  enabled: boolean;
};

export type MsSettingsState = {
  notifications: MsNotificationPreferences;
  thresholdPresets: ThresholdPreset[];
  setNotifications: (next: MsNotificationPreferences) => void;
  setThresholdPresets: (next: ThresholdPreset[]) => void;
};

type Persisted = Pick<MsSettingsState, "notifications" | "thresholdPresets">;

function read(): Persisted {
  try {
    const raw = localStorage.getItem("lifepet:ms:settings");
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!parsed || typeof parsed !== "object") throw new Error("bad");
    return {
      notifications: {
        enabled: parsed.notifications?.enabled ?? true,
        channels: {
          in_app: parsed.notifications?.channels?.in_app ?? true,
          push: parsed.notifications?.channels?.push ?? false,
          email: parsed.notifications?.channels?.email ?? false,
          sms: parsed.notifications?.channels?.sms ?? false,
        },
        minSeverity: parsed.notifications?.minSeverity === "critical" ? "critical" : parsed.notifications?.minSeverity === "info" ? "info" : "warning",
        quietHours: parsed.notifications?.quietHours,
      },
      thresholdPresets: Array.isArray(parsed.thresholdPresets) ? parsed.thresholdPresets : [],
    };
  } catch {
    return {
      notifications: {
        enabled: true,
        channels: { in_app: true, push: false, email: false, sms: false },
        minSeverity: "warning",
      },
      thresholdPresets: [
        {
          id: "pet-fever",
          subjectType: "pet",
          metricType: "body_temperature",
          operator: ">=",
          threshold: 39.2,
          windowMinutes: 10,
          severity: "warning",
          title: "Febbre (pet)",
          enabled: true,
        },
        {
          id: "bovine-fever",
          subjectType: "livestock",
          metricType: "inner_body_temperature",
          operator: ">=",
          threshold: 39.5,
          windowMinutes: 20,
          severity: "warning",
          title: "Temperatura alta (bovine)",
          enabled: true,
        },
        {
          id: "bovine-rumination-drop",
          subjectType: "livestock",
          metricType: "rumination_duration",
          operator: "<=",
          threshold: 240,
          windowMinutes: 120,
          severity: "warning",
          title: "Calo ruminazione (bovine)",
          enabled: true,
        },
        {
          id: "device-offline",
          subjectType: "pet",
          metricType: "device_online",
          operator: "<=",
          threshold: 0,
          windowMinutes: 10,
          severity: "critical",
          title: "Dispositivo offline",
          enabled: true,
        },
      ],
    };
  }
}

function write(next: Persisted) {
  try {
    localStorage.setItem("lifepet:ms:settings", JSON.stringify(next));
  } catch {
    return;
  }
}

export const useMsSettingsStore = create<MsSettingsState>((set, get) => {
  const initial = read();
  return {
    notifications: initial.notifications,
    thresholdPresets: initial.thresholdPresets,
    setNotifications: (next) => {
      set({ notifications: next });
      write({ notifications: next, thresholdPresets: get().thresholdPresets });
    },
    setThresholdPresets: (next) => {
      set({ thresholdPresets: next });
      write({ notifications: get().notifications, thresholdPresets: next });
    },
  };
});

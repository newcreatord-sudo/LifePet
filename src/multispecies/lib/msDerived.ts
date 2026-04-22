import type { AlertEvent, AlertSeverity, Device, DeviceBinding, Subject, SubjectStatus } from "@/multispecies/types";

export function subjectIdByDeviceId(bindings: DeviceBinding[]) {
  const map = new Map<string, string>();
  for (const b of bindings) {
    if (b.unboundAt) continue;
    map.set(b.deviceId, b.subjectId);
  }
  return map;
}

export function deviceIdBySubjectId(bindings: DeviceBinding[]) {
  const map = new Map<string, string[]>();
  for (const b of bindings) {
    if (b.unboundAt) continue;
    const arr = map.get(b.subjectId) ?? [];
    arr.push(b.deviceId);
    map.set(b.subjectId, arr);
  }
  return map;
}

export function severityRank(s: AlertSeverity): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

export function subjectStatusFromAlerts(subject: Subject, openAlerts: AlertEvent[], devices: Device[], bindings: DeviceBinding[]): SubjectStatus {
  const deviceIds = deviceIdBySubjectId(bindings).get(subject.id) ?? [];
  const offline = deviceIds.some((id) => devices.find((d) => d.id === id)?.isOnline === false);
  if (offline) return "offline";

  const relevant = openAlerts.filter((a) => a.subjectId === subject.id && a.status === "open");
  if (relevant.length === 0) return "normal";
  const max = Math.max(...relevant.map((a) => severityRank(a.severity)));
  if (max >= 3) return "critical";
  if (max === 2) return "warning";
  return "attention";
}


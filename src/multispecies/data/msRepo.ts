import { demoId, demoRead, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { evaluateAlerts } from "@/multispecies/engine/AlertEngine";
import { msKey, msSamplesKey } from "@/multispecies/data/msKeys";
import type { AlertEvent, AlertRule, Device, DeviceBinding, Farm, Geofence, Herd, MetricSample, Notification, Subject } from "@/multispecies/types";

export function subscribeFarms(_uid: string, onData: (items: Farm[]) => void) {
  return demoSubscribe<Farm[]>(msKey("farms"), [], onData);
}

export function subscribeHerds(_uid: string, onData: (items: Herd[]) => void) {
  return demoSubscribe<Herd[]>(msKey("herds"), [], onData);
}

export function subscribeGeofences(_uid: string, onData: (items: Geofence[]) => void) {
  return demoSubscribe<Geofence[]>(msKey("geofences"), [], onData);
}

export function subscribeSubjects(_uid: string, onData: (items: Subject[]) => void) {
  return demoSubscribe<Subject[]>(msKey("subjects"), [], onData);
}

export function subscribeDevices(_uid: string, onData: (items: Device[]) => void) {
  return demoSubscribe<Device[]>(msKey("devices"), [], onData);
}

export function subscribeBindings(_uid: string, onData: (items: DeviceBinding[]) => void) {
  return demoSubscribe<DeviceBinding[]>(msKey("bindings"), [], onData);
}

export function subscribeRules(_uid: string, onData: (items: AlertRule[]) => void) {
  return demoSubscribe<AlertRule[]>(msKey("rules"), [], onData);
}

export function subscribeAlerts(_uid: string, onData: (items: AlertEvent[]) => void) {
  return demoSubscribe<AlertEvent[]>(msKey("alerts"), [], onData);
}

export function subscribeNotifications(_uid: string, onData: (items: Notification[]) => void) {
  return demoSubscribe<Notification[]>(msKey("notifications"), [], onData);
}

export function subscribeRecentSamples(_uid: string, subjectId: string, limitCount: number, onData: (items: MetricSample[]) => void) {
  return demoSubscribe<MetricSample[]>(msSamplesKey(subjectId), [], (all) => {
    const items = all.slice().sort((a, b) => b.sourceTimestamp - a.sourceTimestamp).slice(0, limitCount);
    onData(items);
  });
}

export function upsertRule(_uid: string, rule: Omit<AlertRule, "id" | "createdAt"> & { id?: string }) {
  const now = Date.now();
  const id = rule.id || demoId();
  const next: AlertRule = { ...rule, id, createdAt: rule.id ? (demoRead<AlertRule[]>(msKey("rules"), []).find((r) => r.id === id)?.createdAt ?? now) : now };
  demoUpdate<AlertRule[]>(msKey("rules"), [], (prev) => {
    const i = prev.findIndex((r) => r.id === id);
    if (i >= 0) {
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    }
    return [next, ...prev];
  });
  return id;
}

export function markNotificationRead(_uid: string, id: string) {
  const now = Date.now();
  demoUpdate<Notification[]>(msKey("notifications"), [], (prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)));
}

export function setAlertStatus(_uid: string, alertId: string, status: "open" | "closed") {
  const now = Date.now();
  demoUpdate<AlertEvent[]>(msKey("alerts"), [], (prev) =>
    prev.map((a) => {
      if (a.id !== alertId) return a;
      if (status === "open") return { ...a, status: "open", resolvedAt: undefined };
      return { ...a, status: "closed", resolvedAt: now };
    })
  );
}

export function bindDevice(_uid: string, deviceId: string, subjectId: string) {
  const now = Date.now();
  demoUpdate<DeviceBinding[]>(msKey("bindings"), [], (prev) => {
    const active = prev.find((b) => b.deviceId === deviceId && !b.unboundAt);
    const next = prev.map((b) => (b.deviceId === deviceId && !b.unboundAt ? { ...b, unboundAt: now } : b));
    const n: DeviceBinding = { id: demoId(), deviceId, subjectId, boundAt: now };
    return active ? [n, ...next] : [n, ...prev];
  });
}

export function updateDevice(_uid: string, deviceId: string, patch: Partial<Device>) {
  const now = Date.now();
  demoUpdate<Device[]>(msKey("devices"), [], (prev) =>
    prev.map((d) => {
      if (d.id !== deviceId) return d;
      return { ...d, ...patch, updatedAt: now };
    })
  );
}

export function upsertFarm(_uid: string, farm: Omit<Farm, "id" | "createdAt"> & { id?: string }) {
  const now = Date.now();
  const id = farm.id || demoId();
  const next: Farm = { id, name: farm.name, createdAt: farm.id ? (demoRead<Farm[]>(msKey("farms"), []).find((f) => f.id === id)?.createdAt ?? now) : now };
  demoUpdate<Farm[]>(msKey("farms"), [], (prev) => {
    const i = prev.findIndex((f) => f.id === id);
    if (i >= 0) {
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    }
    return [next, ...prev];
  });
  return id;
}

export function upsertHerd(_uid: string, herd: Omit<Herd, "id" | "createdAt"> & { id?: string }) {
  const now = Date.now();
  const id = herd.id || demoId();
  const next: Herd = { id, farmId: herd.farmId, name: herd.name, createdAt: herd.id ? (demoRead<Herd[]>(msKey("herds"), []).find((h) => h.id === id)?.createdAt ?? now) : now };
  demoUpdate<Herd[]>(msKey("herds"), [], (prev) => {
    const i = prev.findIndex((h) => h.id === id);
    if (i >= 0) {
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    }
    return [next, ...prev];
  });
  return id;
}

export function upsertGeofence(_uid: string, geofence: Omit<Geofence, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const now = Date.now();
  const id = geofence.id || demoId();
  const existing = demoRead<Geofence[]>(msKey("geofences"), []).find((g) => g.id === id);
  const next: Geofence = {
    id,
    farmId: geofence.farmId,
    herdId: geofence.herdId,
    name: geofence.name,
    shape: "circle",
    center: geofence.center,
    radiusM: geofence.radiusM,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  demoUpdate<Geofence[]>(msKey("geofences"), [], (prev) => {
    const i = prev.findIndex((g) => g.id === id);
    if (i >= 0) {
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    }
    return [next, ...prev];
  });
  return id;
}

export function deleteGeofence(_uid: string, geofenceId: string) {
  demoUpdate<Geofence[]>(msKey("geofences"), [], (prev) => prev.filter((g) => g.id !== geofenceId));
}

export function setSubjectHerd(_uid: string, subjectId: string, herdId: string | null) {
  const now = Date.now();
  demoUpdate<Subject[]>(msKey("subjects"), [], (prev) => prev.map((s) => (s.id === subjectId ? { ...s, herdId: herdId ?? undefined, updatedAt: now } : s)));
}

export function getBoundSubjectId(_uid: string, deviceId: string) {
  const bindings = demoRead<DeviceBinding[]>(msKey("bindings"), []);
  const b = bindings.find((x) => x.deviceId === deviceId && !x.unboundAt);
  return b?.subjectId || null;
}

export function ingestSamples(_uid: string, samples: MetricSample[], devicePatchById?: Record<string, Partial<Device>>) {
  const now = Date.now();
  const subjects = demoRead<Subject[]>(msKey("subjects"), []);
  const devices = demoRead<Device[]>(msKey("devices"), []);
  const bindings = demoRead<DeviceBinding[]>(msKey("bindings"), []);
  const rules = demoRead<AlertRule[]>(msKey("rules"), []);
  const existingAlerts = demoRead<AlertEvent[]>(msKey("alerts"), []);

  const bySubject = new Map<string, MetricSample[]>();
  for (const s of samples) {
    const arr = bySubject.get(s.subjectId) ?? [];
    arr.push(s);
    bySubject.set(s.subjectId, arr);
  }

  for (const [subjectId, group] of bySubject) {
    demoUpdate<MetricSample[]>(msSamplesKey(subjectId), [], (prev) => {
      const next = [...group, ...prev];
      return next.slice(0, 1200);
    });
  }

  if (devicePatchById && Object.keys(devicePatchById).length) {
    demoUpdate<Device[]>(msKey("devices"), devices, (prev) =>
      prev.map((d) => {
        const p = devicePatchById[d.id];
        if (!p) return d;
        return { ...d, ...p, updatedAt: now };
      })
    );
  }

  const maxWindowMinutes = rules.reduce((m, r) => Math.max(m, r.windowMinutes ?? (r.type === "anomaly" ? 120 : 30)), 30);
  const windowMs = Math.max(10, maxWindowMinutes) * 60 * 1000;
  const recent: MetricSample[] = [];
  for (const s of subjects) {
    const all = demoRead<MetricSample[]>(msSamplesKey(s.id), []);
    for (const item of all) {
      if (item.sourceTimestamp < now - windowMs) continue;
      recent.push(item);
      if (recent.length > 9000) break;
    }
    if (recent.length > 9000) break;
  }

  const evaluated = evaluateAlerts({
    now,
    subjects,
    devices: demoRead<Device[]>(msKey("devices"), devices),
    bindings,
    rules,
    samples: recent,
    existingAlerts,
  });
  demoUpdate<AlertEvent[]>(msKey("alerts"), existingAlerts, () => evaluated.nextAlerts);

  if (evaluated.notificationsToCreate.length) {
    demoUpdate<Notification[]>(msKey("notifications"), [], (prev) => {
      const created: Notification[] = evaluated.notificationsToCreate.map((n) => ({
        id: demoId(),
        alertId: n.alertId,
        subjectId: n.subjectId,
        createdAt: now,
        channel: "in_app",
        title: n.title,
        body: n.body,
      }));
      return [...created, ...prev].slice(0, 400);
    });
  }
}

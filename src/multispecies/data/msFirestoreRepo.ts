import {
  collection,
  doc,
  getDocs,
  setDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import type { AlertEvent, AlertRule, Device, DeviceBinding, Farm, Geofence, Herd, MetricSample, Notification, Subject } from "@/multispecies/types";

export type IntegrationMappingRow = { path: string; metricType: string; unit?: string; transform?: string };

export type MsSyncLog = { id: string; kind: string; ok: boolean; createdAt: number; [k: string]: unknown };
export type MsDeadLetter = { id: string; kind: string; error: string; createdAt: number; [k: string]: unknown };
export type MsQueueItem = { id: string; status: string; attempts: number; createdAt: number; [k: string]: unknown };
export type MsAuditLog = { id: string; action: string; createdAt: number; [k: string]: unknown };

function userCol(uid: string, name: string) {
  const { db } = getFirebase();
  return collection(db, "users", uid, name);
}

function telemetrySamplesCol(uid: string, subjectId: string) {
  const { db } = getFirebase();
  return collection(db, "users", uid, "msTelemetry", subjectId, "samples");
}

function mapDocs<T>(snap: { docs: Array<{ id: string; data(): DocumentData }> }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as T[];
}

export function subscribeFarms(uid: string, onData: (items: Farm[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msFarms"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Farm>(snap)),
    (err) => {
      reportFirestoreError(err, "msFarms");
      onData([]);
    }
  );
}

export function subscribeHerds(uid: string, onData: (items: Herd[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msHerds"), orderBy("createdAt", "desc"), limit(400));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Herd>(snap)),
    (err) => {
      reportFirestoreError(err, "msHerds");
      onData([]);
    }
  );
}

export function subscribeGeofences(uid: string, onData: (items: Geofence[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msGeofences"), orderBy("createdAt", "desc"), limit(800));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Geofence>(snap)),
    (err) => {
      reportFirestoreError(err, "msGeofences");
      onData([]);
    }
  );
}

export function subscribeSubjects(uid: string, onData: (items: Subject[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msSubjects"), orderBy("createdAt", "desc"), limit(400));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Subject>(snap)),
    (err) => {
      reportFirestoreError(err, "msSubjects");
      onData([]);
    }
  );
}

export function subscribeDevices(uid: string, onData: (items: Device[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msDevices"), orderBy("createdAt", "desc"), limit(500));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Device>(snap)),
    (err) => {
      reportFirestoreError(err, "msDevices");
      onData([]);
    }
  );
}

export function subscribeBindings(uid: string, onData: (items: DeviceBinding[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msBindings"), orderBy("boundAt", "desc"), limit(1200));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<DeviceBinding>(snap)),
    (err) => {
      reportFirestoreError(err, "msBindings");
      onData([]);
    }
  );
}

export function subscribeRules(uid: string, onData: (items: AlertRule[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msRules"), orderBy("createdAt", "desc"), limit(400));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<AlertRule>(snap)),
    (err) => {
      reportFirestoreError(err, "msRules");
      onData([]);
    }
  );
}

export function subscribeAlerts(uid: string, onData: (items: AlertEvent[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msAlerts"), orderBy("triggeredAt", "desc"), limit(800));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<AlertEvent>(snap)),
    (err) => {
      reportFirestoreError(err, "msAlerts");
      onData([]);
    }
  );
}

export function subscribeNotifications(uid: string, onData: (items: Notification[]) => void) {
  if (!uid) {
    onData([]);
    return () => {};
  }
  const q = query(userCol(uid, "msNotifications"), orderBy("createdAt", "desc"), limit(900));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<Notification>(snap)),
    (err) => {
      reportFirestoreError(err, "msNotifications");
      onData([]);
    }
  );
}

export function subscribeRecentSamples(uid: string, subjectId: string, limitCount: number, onData: (items: MetricSample[]) => void) {
  if (!uid || !subjectId) {
    onData([]);
    return () => {};
  }
  const q = query(telemetrySamplesCol(uid, subjectId), orderBy("sourceTimestamp", "desc"), limit(Math.max(1, Math.min(200, limitCount))));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs<MetricSample>(snap)),
    (err) => {
      reportFirestoreError(err, "msTelemetrySamples");
      onData([]);
    }
  );
}

export async function upsertRule(uid: string, rule: Omit<AlertRule, "id" | "createdAt"> & { id?: string }) {
  const { db } = getFirebase();
  const col = userCol(uid, "msRules");
  if (rule.id) {
    await updateDoc(doc(db, "users", uid, "msRules", rule.id), { ...rule, updatedAt: Date.now() });
    return rule.id;
  }
  const createdAt = Date.now();
  const id = doc(col).id;
  const data: Record<string, unknown> = { ...rule, id, createdAt, updatedAt: createdAt };
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }
  await setDoc(doc(db, "users", uid, "msRules", id), data);
  return id;
}

export async function markNotificationRead(uid: string, id: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "users", uid, "msNotifications", id), { readAt: Date.now() });
}

export async function setAlertStatus(uid: string, alertId: string, status: "open" | "closed") {
  const { db } = getFirebase();
  await updateDoc(doc(db, "users", uid, "msAlerts", alertId), {
    status,
    resolvedAt: status === "closed" ? Date.now() : null,
    updatedAt: Date.now(),
  });
}

export async function bindDevice(uid: string, deviceId: string, subjectId: string) {
  const bindingsCol = userCol(uid, "msBindings");
  const q = query(bindingsCol, where("deviceId", "==", deviceId), where("unboundAt", "==", null), limit(6));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await updateDoc(d.ref, { unboundAt: Date.now() });
  }
  const createdAt = Date.now();
  const { db } = getFirebase();
  const id = doc(bindingsCol).id;
  await setDoc(doc(db, "users", uid, "msBindings", id), { id, deviceId, subjectId, boundAt: createdAt, unboundAt: null });
}

export async function updateDevice(uid: string, deviceId: string, patch: Partial<Device>) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msUpdateDevice");
  await fn({ deviceId, patch });
}

export async function ensureSeed(uid: string) {
  if (!uid) throw new Error("uid required");
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msEnsureSeed");
  await fn({});
}

export async function upsertFarm(uid: string, farm: Omit<Farm, "id" | "createdAt"> & { id?: string }) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msUpsertFarm");
  const resp = await fn({ id: farm.id ?? null, name: farm.name });
  const id = (resp.data as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
}

export async function upsertHerd(uid: string, herd: Omit<Herd, "id" | "createdAt"> & { id?: string }) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msUpsertHerd");
  const resp = await fn({ id: herd.id ?? null, farmId: herd.farmId, name: herd.name });
  const id = (resp.data as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
}

export async function setSubjectHerd(uid: string, subjectId: string, herdId: string | null) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msSetSubjectHerd");
  await fn({ subjectId, herdId: herdId ?? null });
}

export async function upsertGeofence(uid: string, geofence: Omit<Geofence, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msUpsertGeofence");
  const resp = await fn({
    id: geofence.id ?? null,
    farmId: geofence.farmId,
    herdId: geofence.herdId ?? null,
    name: geofence.name,
    shape: "circle",
    center: geofence.center,
    radiusM: geofence.radiusM,
  });
  const id = (resp.data as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
}

export async function deleteGeofence(uid: string, geofenceId: string) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msDeleteGeofence");
  await fn({ geofenceId });
}

export async function upsertIntegrationConfig(
  uid: string,
  adapterType: string,
  config: { mappings: IntegrationMappingRow[]; pollingEnabled?: boolean; pollingExternalDeviceIds?: string[] }
) {
  const { db } = getFirebase();
  const ref = doc(db, "users", uid, "msIntegrations", adapterType);
  const now = Date.now();
  await setDoc(
    ref,
    {
      adapterType,
      mappings: config.mappings,
      pollingEnabled: config.pollingEnabled ?? undefined,
      pollingExternalDeviceIds: config.pollingExternalDeviceIds ?? undefined,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function simTick(uid: string, intensity: number) {
  if (!uid) throw new Error("uid required");
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msSimTick");
  await fn({ intensity });
}

export async function enqueueIngest(
  uid: string,
  item: {
    adapterType?: string;
    deviceId?: string;
    subjectId?: string;
    externalDeviceId?: string;
    payload: Record<string, unknown>;
    receivedAt?: number;
    source?: string;
  }
) {
  if (!uid) throw new Error("uid required");
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msEnqueueIngest");
  const resp = await fn(item);
  return resp.data;
}

export async function importTelemetryBatch(
  uid: string,
  rows: Array<{ adapterType?: string; deviceId?: string; subjectId?: string; externalDeviceId?: string; payload: Record<string, unknown>; receivedAt?: number }>
) {
  if (!uid) throw new Error("uid required");
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "msImportTelemetryBatch");
  const resp = await fn({ rows });
  return resp.data;
}

export function subscribeSyncLogs(uid: string, cb: (rows: MsSyncLog[]) => void) {
  const col = userCol(uid, "msSyncLogs");
  const q = query(col, orderBy("createdAt", "desc"), limit(120));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as MsSyncLog[]);
  });
}

export function subscribeDeadLetters(uid: string, cb: (rows: MsDeadLetter[]) => void) {
  const col = userCol(uid, "msDeadLetters");
  const q = query(col, orderBy("createdAt", "desc"), limit(60));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as MsDeadLetter[]);
  });
}

export function subscribeIngestQueue(uid: string, cb: (rows: MsQueueItem[]) => void) {
  const col = userCol(uid, "msIngestQueue");
  const q = query(col, orderBy("createdAt", "desc"), limit(60));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as MsQueueItem[]);
  });
}

export function subscribeAuditLogs(uid: string, cb: (rows: MsAuditLog[]) => void) {
  const col = userCol(uid, "msAuditLogs");
  const q = query(col, orderBy("createdAt", "desc"), limit(120));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as MsAuditLog[]);
  });
}

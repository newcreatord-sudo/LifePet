import { shouldUseDemoData } from "@/lib/runtimeMode";
import * as demo from "@/multispecies/data/msRepo";
import * as fs from "@/multispecies/data/msFirestoreRepo";
import type { AlertEvent, AlertRule, Device, DeviceBinding, Farm, Geofence, Herd, MetricSample, Notification, Subject } from "@/multispecies/types";
import type { IntegrationMappingRow } from "@/multispecies/data/msFirestoreRepo";
import type { MsAuditLog, MsDeadLetter, MsQueueItem, MsSyncLog } from "@/multispecies/data/msFirestoreRepo";

export function subscribeFarms(uid: string, onData: (items: Farm[]) => void) {
  return shouldUseDemoData() ? demo.subscribeFarms(uid, onData) : fs.subscribeFarms(uid, onData);
}

export function subscribeHerds(uid: string, onData: (items: Herd[]) => void) {
  return shouldUseDemoData() ? demo.subscribeHerds(uid, onData) : fs.subscribeHerds(uid, onData);
}

export function subscribeGeofences(uid: string, onData: (items: Geofence[]) => void) {
  return shouldUseDemoData() ? demo.subscribeGeofences(uid, onData) : fs.subscribeGeofences(uid, onData);
}

export function subscribeSubjects(uid: string, onData: (items: Subject[]) => void) {
  return shouldUseDemoData() ? demo.subscribeSubjects(uid, onData) : fs.subscribeSubjects(uid, onData);
}

export function subscribeDevices(uid: string, onData: (items: Device[]) => void) {
  return shouldUseDemoData() ? demo.subscribeDevices(uid, onData) : fs.subscribeDevices(uid, onData);
}

export function subscribeBindings(uid: string, onData: (items: DeviceBinding[]) => void) {
  return shouldUseDemoData() ? demo.subscribeBindings(uid, onData) : fs.subscribeBindings(uid, onData);
}

export function subscribeRules(uid: string, onData: (items: AlertRule[]) => void) {
  return shouldUseDemoData() ? demo.subscribeRules(uid, onData) : fs.subscribeRules(uid, onData);
}

export function subscribeAlerts(uid: string, onData: (items: AlertEvent[]) => void) {
  return shouldUseDemoData() ? demo.subscribeAlerts(uid, onData) : fs.subscribeAlerts(uid, onData);
}

export function subscribeNotifications(uid: string, onData: (items: Notification[]) => void) {
  return shouldUseDemoData() ? demo.subscribeNotifications(uid, onData) : fs.subscribeNotifications(uid, onData);
}

export function subscribeRecentSamples(uid: string, subjectId: string, limitCount: number, onData: (items: MetricSample[]) => void) {
  return shouldUseDemoData() ? demo.subscribeRecentSamples(uid, subjectId, limitCount, onData) : fs.subscribeRecentSamples(uid, subjectId, limitCount, onData);
}

export async function upsertRule(uid: string, rule: Omit<AlertRule, "id" | "createdAt"> & { id?: string }) {
  return shouldUseDemoData() ? demo.upsertRule(uid, rule) : fs.upsertRule(uid, rule);
}

export async function markNotificationRead(uid: string, id: string) {
  if (shouldUseDemoData()) return demo.markNotificationRead(uid, id);
  return fs.markNotificationRead(uid, id);
}

export async function setAlertStatus(uid: string, alertId: string, status: "open" | "closed") {
  if (shouldUseDemoData()) return demo.setAlertStatus(uid, alertId, status);
  return fs.setAlertStatus(uid, alertId, status);
}

export async function bindDevice(uid: string, deviceId: string, subjectId: string) {
  if (shouldUseDemoData()) return demo.bindDevice(uid, deviceId, subjectId);
  return fs.bindDevice(uid, deviceId, subjectId);
}

export async function updateDevice(uid: string, deviceId: string, patch: Partial<Device>) {
  if (shouldUseDemoData()) return demo.updateDevice(uid, deviceId, patch);
  return fs.updateDevice(uid, deviceId, patch);
}

export async function upsertFarm(uid: string, farm: Omit<Farm, "id" | "createdAt"> & { id?: string }) {
  if (shouldUseDemoData()) return demo.upsertFarm(uid, farm);
  return fs.upsertFarm(uid, farm);
}

export async function upsertHerd(uid: string, herd: Omit<Herd, "id" | "createdAt"> & { id?: string }) {
  if (shouldUseDemoData()) return demo.upsertHerd(uid, herd);
  return fs.upsertHerd(uid, herd);
}

export async function upsertGeofence(uid: string, geofence: Omit<Geofence, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  if (shouldUseDemoData()) return demo.upsertGeofence(uid, geofence);
  return fs.upsertGeofence(uid, geofence);
}

export async function deleteGeofence(uid: string, geofenceId: string) {
  if (shouldUseDemoData()) return demo.deleteGeofence(uid, geofenceId);
  return fs.deleteGeofence(uid, geofenceId);
}

export async function setSubjectHerd(uid: string, subjectId: string, herdId: string | null) {
  if (shouldUseDemoData()) return demo.setSubjectHerd(uid, subjectId, herdId);
  return fs.setSubjectHerd(uid, subjectId, herdId);
}

export async function ensureSeed(uid: string) {
  if (shouldUseDemoData()) return;
  return fs.ensureSeed(uid);
}

export async function upsertIntegrationConfig(
  uid: string,
  adapterType: string,
  config: { mappings: IntegrationMappingRow[]; pollingEnabled?: boolean; pollingExternalDeviceIds?: string[] }
) {
  if (shouldUseDemoData()) return;
  return fs.upsertIntegrationConfig(uid, adapterType, config);
}

export async function enqueueIngest(
  uid: string,
  item: { adapterType?: string; deviceId?: string; subjectId?: string; externalDeviceId?: string; payload: Record<string, unknown>; receivedAt?: number; source?: string }
) {
  if (shouldUseDemoData()) return;
  return fs.enqueueIngest(uid, item);
}

export async function importTelemetryBatch(
  uid: string,
  rows: Array<{ adapterType?: string; deviceId?: string; subjectId?: string; externalDeviceId?: string; payload: Record<string, unknown>; receivedAt?: number }>
) {
  if (shouldUseDemoData()) return;
  return fs.importTelemetryBatch(uid, rows);
}

export function subscribeSyncLogs(uid: string, cb: (rows: MsSyncLog[]) => void) {
  if (shouldUseDemoData()) {
    cb([]);
    return () => {};
  }
  return fs.subscribeSyncLogs(uid, cb);
}

export function subscribeDeadLetters(uid: string, cb: (rows: MsDeadLetter[]) => void) {
  if (shouldUseDemoData()) {
    cb([]);
    return () => {};
  }
  return fs.subscribeDeadLetters(uid, cb);
}

export function subscribeIngestQueue(uid: string, cb: (rows: MsQueueItem[]) => void) {
  if (shouldUseDemoData()) {
    cb([]);
    return () => {};
  }
  return fs.subscribeIngestQueue(uid, cb);
}

export function subscribeAuditLogs(uid: string, cb: (rows: MsAuditLog[]) => void) {
  if (shouldUseDemoData()) {
    cb([]);
    return () => {};
  }
  return fs.subscribeAuditLogs(uid, cb);
}

export async function simTick(uid: string, intensity: number) {
  if (shouldUseDemoData()) return;
  return fs.simTick(uid, intensity);
}

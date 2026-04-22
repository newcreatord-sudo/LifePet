import { demoId } from "@/lib/demoDb";
import type { AlertEvent, AlertRule, Device, DeviceBinding, MetricSample, Subject } from "@/multispecies/types";

export type AlertEngineResult = {
  nextAlerts: AlertEvent[];
  notificationsToCreate: Array<{ alertId: string; subjectId: string; title: string; body: string }>;
};

function toNumber(v: unknown): number | null {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
}

function compare(operator: AlertRule["operator"], a: unknown, b: unknown) {
  if (!operator) return false;
  if (operator === "==") return a === b;
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an === null || bn === null) return false;
  if (operator === ">") return an > bn;
  if (operator === ">=") return an >= bn;
  if (operator === "<") return an < bn;
  if (operator === "<=") return an <= bn;
  return false;
}

function evaluateTrend(rule: AlertRule, now: number, samples: MetricSample[]) {
  if (!rule.metricType || rule.threshold == null || !rule.operator) return false;
  const windowMs = Math.max(1, (rule.windowMinutes ?? 60) * 60 * 1000);
  const points = samples
    .filter((s) => s.metricType === rule.metricType && s.sourceTimestamp >= now - windowMs)
    .map((s) => ({ s, v: toNumber(s.value) }))
    .filter((x) => x.v !== null) as Array<{ s: MetricSample; v: number }>;
  if (points.length < 2) return false;
  points.sort((a, b) => a.s.sourceTimestamp - b.s.sourceTimestamp);
  const delta = points[points.length - 1].v - points[0].v;
  return compare(rule.operator, delta, rule.threshold);
}

function openAlertFromRule(args: {
  rule: AlertRule;
  subject: Subject;
  deviceId: string;
  triggeredAt: number;
  linkedMetrics?: Array<{ metricType: MetricSample["metricType"]; sampleId: string }>;
  description?: string;
  confidenceScore?: number;
}) {
  const title = args.rule.title || `${args.rule.metricType}`;
  const description = args.description || args.rule.description || "";
  const rec = args.rule.recommendedActions ?? [];
  const a: AlertEvent = {
    id: demoId(),
    ruleId: args.rule.id,
    subjectId: args.subject.id,
    deviceId: args.deviceId,
    severity: args.rule.severity,
    category: args.rule.category,
    title,
    description,
    recommendedActions: rec,
    triggeredAt: args.triggeredAt,
    source: `engine:${args.rule.type}`,
    confidenceScore: args.confidenceScore,
    linkedMetrics: args.linkedMetrics,
    status: "open",
  };
  return a;
}

function closeAlert(prev: AlertEvent, resolvedAt: number): AlertEvent {
  return { ...prev, status: "closed", resolvedAt };
}

function ruleApplies(rule: AlertRule, subject: Subject) {
  if (!rule.enabled) return false;
  if (rule.scope === "subject") return rule.subjectId === subject.id;
  if (rule.scope === "type") return rule.subjectType === subject.type;
  return false;
}

export function evaluateAlerts(args: {
  now: number;
  subjects: Subject[];
  devices: Device[];
  bindings: DeviceBinding[];
  rules: AlertRule[];
  samples: MetricSample[];
  existingAlerts: AlertEvent[];
}) : AlertEngineResult {
  const { now, subjects, devices, bindings, rules, samples, existingAlerts } = args;
  const next = existingAlerts.slice();
  const notificationsToCreate: AlertEngineResult["notificationsToCreate"] = [];

  const subjectsById = new Map(subjects.map((s) => [s.id, s] as const));

  const openAlertsByKey = new Map<string, AlertEvent>();
  for (const a of existingAlerts) {
    if (a.status !== "open") continue;
    openAlertsByKey.set(`${a.ruleId}:${a.subjectId}`, a);
  }

  const subjectIdByDeviceId = new Map<string, string>();
  for (const b of bindings) {
    if (b.unboundAt) continue;
    subjectIdByDeviceId.set(b.deviceId, b.subjectId);
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.type !== "threshold" && rule.type !== "anomaly" && rule.type !== "trend") continue;

    for (const subject of subjects) {
      if (!ruleApplies(rule, subject)) continue;
      const windowMs = Math.max(1, (rule.windowMinutes ?? 10) * 60 * 1000);
      const relevant = samples
        .filter((s) => s.subjectId === subject.id && s.metricType === rule.metricType && s.sourceTimestamp >= now - windowMs)
        .sort((a, b) => b.sourceTimestamp - a.sourceTimestamp);

      const existing = openAlertsByKey.get(`${rule.id}:${subject.id}`);
      if (rule.type === "threshold") {
        const triggered = relevant.some((s) => compare(rule.operator, s.value, rule.threshold));

        if (triggered && !existing) {
          const first = relevant.find((s) => compare(rule.operator, s.value, rule.threshold));
          const deviceId = first?.deviceId || devices.find((d) => d.id)?.id || "";
          const desc = rule.description || `${String(rule.metricType)} oltre soglia`;
          const opened = openAlertFromRule({
            rule,
            subject,
            deviceId,
            triggeredAt: now,
            linkedMetrics: first ? [{ metricType: first.metricType, sampleId: first.id }] : undefined,
            description: desc,
            confidenceScore: 0.72,
          });
          next.unshift(opened);
          openAlertsByKey.set(`${rule.id}:${subject.id}`, opened);
          notificationsToCreate.push({
            alertId: opened.id,
            subjectId: subject.id,
            title: opened.title,
            body: opened.description || opened.title,
          });
        }

        if (!triggered && existing) {
          const idx = next.findIndex((a) => a.id === existing.id);
          if (idx >= 0) next[idx] = closeAlert(existing, now);
          openAlertsByKey.delete(`${rule.id}:${subject.id}`);
        }
      }

      if (rule.type === "trend") {
        const triggered = evaluateTrend(rule, now, relevant);
        if (triggered && !existing) {
          const deviceId = relevant[0]?.deviceId || devices.find((d) => d.id)?.id || "";
          const opened = openAlertFromRule({
            rule,
            subject,
            deviceId,
            triggeredAt: now,
            linkedMetrics: relevant[0] ? [{ metricType: relevant[0].metricType, sampleId: relevant[0].id }] : undefined,
            description: rule.description || `Trend su ${rule.metricType}`,
            confidenceScore: 0.7,
          });
          next.unshift(opened);
          openAlertsByKey.set(`${rule.id}:${subject.id}`, opened);
          notificationsToCreate.push({ alertId: opened.id, subjectId: subject.id, title: opened.title, body: opened.description || opened.title });
        }
        if (!triggered && existing) {
          const idx = next.findIndex((a) => a.id === existing.id);
          if (idx >= 0) next[idx] = closeAlert(existing, now);
          openAlertsByKey.delete(`${rule.id}:${subject.id}`);
        }
      }

      if (rule.type === "anomaly") {
        const numbers = relevant.map((s) => ({ s, v: toNumber(s.value) })).filter((x) => x.v !== null) as Array<{ s: MetricSample; v: number }>;
        if (numbers.length < 8) {
          if (existing) {
            const idx = next.findIndex((a) => a.id === existing.id);
            if (idx >= 0) next[idx] = closeAlert(existing, now);
            openAlertsByKey.delete(`${rule.id}:${subject.id}`);
          }
          continue;
        }

        const vs = numbers.map((x) => x.v);
        const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
        const variance = vs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / Math.max(1, vs.length - 1);
        const std = Math.sqrt(variance) || 1;
        const latest = numbers[0];
        const z = Math.abs((latest.v - mean) / std);
        const triggered = z >= 2.8;

        if (triggered && !existing) {
          const deviceId = latest.s.deviceId;
          const opened = openAlertFromRule({
            rule,
            subject,
            deviceId,
            triggeredAt: now,
            linkedMetrics: [{ metricType: latest.s.metricType, sampleId: latest.s.id }],
            description: rule.description || `Anomalia su ${rule.metricType} (z=${z.toFixed(2)})`,
            confidenceScore: Math.min(0.95, 0.6 + z / 10),
          });
          next.unshift(opened);
          openAlertsByKey.set(`${rule.id}:${subject.id}`, opened);
          notificationsToCreate.push({ alertId: opened.id, subjectId: subject.id, title: opened.title, body: opened.description || opened.title });
        }
        if (!triggered && existing) {
          const idx = next.findIndex((a) => a.id === existing.id);
          if (idx >= 0) next[idx] = closeAlert(existing, now);
          openAlertsByKey.delete(`${rule.id}:${subject.id}`);
        }
      }
    }
  }

  for (const d of devices) {
    if (d.isOnline) continue;
    const sid = subjectIdByDeviceId.get(d.id);
    const subject = sid ? subjectsById.get(sid) : null;
    const offlineRuleId = `offline:${d.id}`;
    const existing = next.find((a) => a.status === "open" && a.ruleId === offlineRuleId);
    if (existing) continue;
    if (!subject) continue;

    const opened: AlertEvent = {
      id: demoId(),
      ruleId: offlineRuleId,
      subjectId: subject.id,
      deviceId: d.id,
      severity: "warning",
      category: "device",
      title: "Dispositivo offline",
      description: `${d.brand} ${d.model} non risponde.`,
      recommendedActions: ["Verifica batteria", "Verifica copertura", "Riprova sincronizzazione"],
      triggeredAt: now,
      source: "engine:device",
      confidenceScore: 0.8,
      status: "open",
    };
    next.unshift(opened);
    notificationsToCreate.push({ alertId: opened.id, subjectId: subject.id, title: opened.title, body: opened.description });
  }

  return { nextAlerts: next, notificationsToCreate };
}

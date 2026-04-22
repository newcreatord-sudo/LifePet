import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import {
  markNotificationRead,
  setAlertStatus,
  subscribeAlerts,
  subscribeNotifications,
  subscribeRules,
  subscribeSubjects,
  upsertRule,
} from "@/multispecies/data/msData";
import type { AlertEvent, AlertRule, Notification, Subject } from "@/multispecies/types";
import { RuleList } from "@/components/multispecies/RuleList";
import { RuleEditor } from "@/components/multispecies/RuleEditor";
import { AlertList } from "@/components/multispecies/AlertList";
import { AlertDetail } from "@/components/multispecies/AlertDetail";
import { NotificationInbox } from "@/components/multispecies/NotificationInbox";
import { useAuthStore } from "@/stores/authStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";

export default function PlatformAlerts() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const location = useLocation();
  const inFarmArea = location.pathname.startsWith("/app/farm");
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeRules(uid, setRules), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);
  useEffect(() => subscribeNotifications(uid, setNotifications), [uid]);

  const visibleSubjects = useMemo(() => {
    if (inFarmArea) return subjects.filter((s) => s.type !== "pet").filter((s) => (activeFarmId ? s.farmId === activeFarmId : true));
    return subjects.filter((s) => s.type === "pet");
  }, [activeFarmId, inFarmArea, subjects]);

  const visibleSubjectIds = useMemo(() => new Set(visibleSubjects.map((s) => s.id)), [visibleSubjects]);

  const visibleRules = useMemo(() => {
    if (!inFarmArea) return rules;
    return rules.filter((r) => {
      if (r.scope === "type") return r.subjectType === "livestock";
      if (r.scope === "subject") return r.subjectId ? visibleSubjectIds.has(r.subjectId) : false;
      return true;
    });
  }, [inFarmArea, rules, visibleSubjectIds]);

  const visibleAlerts = useMemo(() => {
    if (!inFarmArea) return alerts;
    return alerts.filter((a) => visibleSubjectIds.has(a.subjectId));
  }, [alerts, inFarmArea, visibleSubjectIds]);

  const visibleNotifications = useMemo(() => {
    if (!inFarmArea) return notifications;
    return notifications.filter((n) => visibleSubjectIds.has(n.subjectId));
  }, [inFarmArea, notifications, visibleSubjectIds]);

  const selectedRule = useMemo(() => visibleRules.find((r) => r.id === selectedRuleId) ?? null, [visibleRules, selectedRuleId]);
  const selectedAlert = useMemo(() => visibleAlerts.find((a) => a.id === selectedAlertId) ?? null, [visibleAlerts, selectedAlertId]);

  const [draft, setDraft] = useState<Partial<AlertRule>>({
    type: "threshold",
    enabled: true,
    scope: "type",
    subjectType: "pet",
    metricType: "body_temperature",
    operator: ">=",
    threshold: 39.2,
    windowMinutes: 10,
    severity: "warning",
    category: "health",
    title: "Soglia",
    description: "",
    recommendedActions: ["Verifica"],
  });

  useEffect(() => {
    setDraft((d) => ({ ...d, scope: "type", subjectType: inFarmArea ? "livestock" : "pet" }));
  }, [inFarmArea]);

  useEffect(() => {
    if (!selectedRule) return;
    setDraft(selectedRule);
  }, [selectedRule]);

  const subjectNameById = useMemo(() => new Map(visibleSubjects.map((s) => [s.id, s.displayName] as const)), [visibleSubjects]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Alert Center", en: "Alert Center" }}
        description={{ it: "Regole threshold/anomaly, alert e notifiche in-app.", en: "Threshold/anomaly rules, alerts and in-app notifications." }}
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <RuleList
            rules={visibleRules}
            selectedRuleId={selectedRuleId}
            onSelectRuleId={setSelectedRuleId}
            onNew={() => {
              setSelectedRuleId(null);
              setDraft({
                type: "threshold",
                enabled: true,
                scope: "type",
                subjectType: inFarmArea ? "livestock" : "pet",
                metricType: "body_temperature",
                operator: ">=",
                threshold: 39.2,
                windowMinutes: 10,
                severity: "warning",
                category: "health",
                title: "Nuova regola",
                description: "",
                recommendedActions: ["Verifica"],
              });
            }}
          />
          <RuleEditor
            draft={draft}
            subjects={visibleSubjects}
            onChange={setDraft}
            onSave={() => {
              const base: Omit<AlertRule, "id" | "createdAt"> & { id?: string } = {
                id: typeof draft.id === "string" ? draft.id : undefined,
                type: draft.type === "anomaly" ? "anomaly" : draft.type === "trend" ? "trend" : "threshold",
                enabled: Boolean(draft.enabled),
                scope: draft.scope === "subject" ? "subject" : "type",
                subjectType: draft.scope === "type" ? (draft.subjectType === "livestock" ? "livestock" : draft.subjectType === "bovine" ? "bovine" : "pet") : undefined,
                subjectId: draft.scope === "subject" && typeof draft.subjectId === "string" ? draft.subjectId : undefined,
                metricType: (draft.metricType as AlertRule["metricType"]) ?? "body_temperature",
                operator: undefined,
                threshold: undefined,
                windowMinutes: typeof draft.windowMinutes === "number" ? draft.windowMinutes : 10,
                severity: draft.severity === "critical" ? "critical" : draft.severity === "info" ? "info" : "warning",
                category:
                  draft.category === "reproductive"
                    ? "reproductive"
                    : draft.category === "safety"
                      ? "safety"
                      : draft.category === "device"
                        ? "device"
                        : draft.category === "farm"
                          ? "farm"
                          : "health",
                title: String(draft.title ?? "Regola"),
                description: String(draft.description ?? ""),
                recommendedActions: Array.isArray(draft.recommendedActions) ? draft.recommendedActions : ["Verifica"],
              };

              if (base.type === "threshold" || base.type === "trend") {
                base.operator = draft.operator === ">" || draft.operator === ">=" || draft.operator === "<" || draft.operator === "<=" || draft.operator === "==" ? draft.operator : ">=";
                base.threshold = draft.threshold ?? 0;
              }

              void (async () => {
                const id = await upsertRule(uid, base);
                setSelectedRuleId(id);
              })();
            }}
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <AlertList alerts={visibleAlerts} selectedAlertId={selectedAlertId} subjectNameById={subjectNameById} onSelectAlertId={setSelectedAlertId} />
          <AlertDetail
            alert={selectedAlert}
            subjectNameById={subjectNameById}
            onSetStatus={(alertId, status) => {
              void setAlertStatus(uid, alertId, status);
            }}
          />
        </div>

        <div className="lg:col-span-3">
          <NotificationInbox
            notifications={visibleNotifications}
            onMarkRead={(id) => {
              void markNotificationRead(uid, id);
            }}
          />
        </div>
      </div>
    </div>
  );
}

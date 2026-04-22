import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, AlertTriangle, ClipboardList, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { subscribeAlerts, subscribeBindings, subscribeDevices, subscribeHerds, subscribeSubjects } from "@/multispecies/data/msData";
import { subjectStatusFromAlerts } from "@/multispecies/lib/msDerived";
import { useAuthStore } from "@/stores/authStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import type { AlertEvent, Device, DeviceBinding, Herd, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";

function severityDot(sev: AlertEvent["severity"]) {
  if (sev === "critical") return "bg-rose-500";
  if (sev === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export default function FarmHerdDashboard() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);
  const { herdId } = useParams();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);

  const herd = useMemo(() => (herdId ? herds.find((h) => h.id === herdId) ?? null : null), [herdId, herds]);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);

  const members = useMemo(() => {
    if (!herdId) return [];
    return subjects
      .filter((s) => s.type !== "pet")
      .filter((s) => (activeFarmId ? s.farmId === activeFarmId : true))
      .filter((s) => s.herdId === herdId);
  }, [activeFarmId, herdId, subjects]);

  const subjectIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const herdAlerts = useMemo(() => openAlerts.filter((a) => subjectIds.has(a.subjectId)), [openAlerts, subjectIds]);
  const criticalCount = useMemo(() => herdAlerts.filter((a) => a.severity === "critical").length, [herdAlerts]);
  const warningCount = useMemo(() => herdAlerts.filter((a) => a.severity === "warning").length, [herdAlerts]);

  const onlineDevices = useMemo(() => devices.filter((d) => d.isOnline), [devices]);
  const deviceCount = useMemo(() => {
    const s = new Set<string>();
    for (const b of bindings) {
      if (b.unboundAt) continue;
      if (!subjectIds.has(b.subjectId)) continue;
      s.add(b.deviceId);
    }
    return s.size;
  }, [bindings, subjectIds]);

  const worst = useMemo(() => {
    const rows = members
      .map((s) => ({
        subject: s,
        status: subjectStatusFromAlerts(s, openAlerts, devices, bindings),
        openCount: openAlerts.filter((a) => a.subjectId === s.id).length,
      }))
      .sort((a, b) => {
        const rank = (st: string) => (st === "critical" ? 4 : st === "warning" ? 3 : st === "attention" ? 2 : st === "offline" ? 1 : 0);
        const r = rank(b.status) - rank(a.status);
        if (r !== 0) return r;
        return b.openCount - a.openCount;
      });
    return rows.slice(0, 12);
  }, [bindings, devices, members, openAlerts]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: herd ? herd.name : "Mandria", en: herd ? herd.name : "Herd" }}
        description={{ it: "Dashboard mandria: KPI, alert e capi prioritizzati.", en: "Herd dashboard: KPIs, alerts and prioritized animals." }}
        showImage={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="lp-btn-secondary" to="/app/farm/herds">Mandrie</Link>
            <Link className="lp-btn-secondary" to="/app/farm/alerts">Alert</Link>
            <Link className="lp-btn-secondary" to="/app/farm/reports">Report</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Capi</CardTitle>
                <CardDescription>Totale in mandria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{members.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alert</CardTitle>
                <CardDescription>Open (mandria)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Tot</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{herdAlerts.length}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Crit</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{criticalCount}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Warn</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{warningCount}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" />Device</CardTitle>
                <CardDescription>Collegati e online</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Binding</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{deviceCount}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Online</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{onlineDevices.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Capi a rischio</CardTitle>
              <CardDescription>Ordinati per severità e numero alert.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {worst.map((row) => (
                  <div key={row.subject.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/app/farm/subjects/${row.subject.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {row.subject.displayName}
                      </Link>
                      <div className="text-xs lp-muted truncate">{row.subject.species}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          row.status === "critical"
                            ? "bg-rose-500/15 text-rose-700"
                            : row.status === "warning"
                              ? "bg-amber-500/15 text-amber-700"
                              : row.status === "attention"
                                ? "bg-sky-500/15 text-sky-700"
                                : row.status === "offline"
                                  ? "bg-slate-500/15 text-slate-700"
                                  : "bg-emerald-500/15 text-emerald-700"
                        )}
                      >
                        {row.status}
                      </div>
                      <div className="text-xs lp-muted">{row.openCount}</div>
                    </div>
                  </div>
                ))}
              </div>
              {members.length === 0 ? <div className="text-sm lp-muted">Nessun capo in mandria.</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alert recenti</CardTitle>
              <CardDescription>Ultimi eventi open della mandria.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {herdAlerts.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <div className={cn("mt-1 w-2 h-2 rounded-full", severityDot(a.severity))} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{a.title}</div>
                      <div className="text-xs lp-muted truncate">{a.description || a.category}</div>
                    </div>
                  </div>
                ))}
                {herdAlerts.length === 0 ? <div className="text-sm lp-muted">Nessun alert.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


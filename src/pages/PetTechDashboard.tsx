import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Cpu, Siren } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsUiStore } from "@/multispecies/stores/msUiStore";
import { subscribeAlerts, subscribeBindings, subscribeDevices, subscribeNotifications, subscribeSubjects } from "@/multispecies/data/msData";
import { subjectStatusFromAlerts } from "@/multispecies/lib/msDerived";
import { useAuthStore } from "@/stores/authStore";
import type { AlertEvent, Device, DeviceBinding, Notification, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";

function severityDot(sev: AlertEvent["severity"]) {
  if (sev === "critical") return "bg-rose-500";
  if (sev === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export default function PetTechDashboard() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const setMode = useMsUiStore((s) => s.setMode);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setMode("pet");
  }, [setMode]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);
  useEffect(() => subscribeNotifications(uid, setNotifications), [uid]);

  const pets = useMemo(() => subjects.filter((s) => s.type === "pet"), [subjects]);
  const petIds = useMemo(() => new Set(pets.map((p) => p.id)), [pets]);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open" && petIds.has(a.subjectId)), [alerts, petIds]);
  const onlineDevices = useMemo(() => devices.filter((d) => d.isOnline), [devices]);

  const worstList = useMemo(() => {
    const rows = pets
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
    return rows.slice(0, 8);
  }, [bindings, devices, openAlerts, pets]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Tecnologia Pet", en: "Pet Tech" }}
        description={{ it: "Dispositivi, telemetria, alert e diagnostica per animali domestici.", en: "Devices, telemetry, alerts and diagnostics for pets." }}
        showImage={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="lp-btn-primary" to="/app/tech/devices">Dispositivi</Link>
            <Link className="lp-btn-secondary" to="/app/tech/alerts">Alert</Link>
            <Link className="lp-btn-secondary" to="/app/tech/integrations">Integrazioni</Link>
            <Link className="lp-btn-secondary" to="/app/tech/diagnostics">Diagnostica</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Cpu className="w-4 h-4" />KPI</CardTitle>
                <CardDescription>Vista pet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Pet</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{pets.length}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Device online</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{onlineDevices.length}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Alert aperti</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{openAlerts.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Siren className="w-4 h-4" />Alert recenti</CardTitle>
                <CardDescription>Open</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {openAlerts.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <div className={cn("mt-1 w-2 h-2 rounded-full", severityDot(a.severity))} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{a.title}</div>
                        <div className="text-xs lp-muted truncate">{a.description || a.category}</div>
                      </div>
                    </div>
                  ))}
                  {openAlerts.length === 0 ? <div className="text-sm lp-muted">Nessun alert.</div> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4" />Notifiche</CardTitle>
                <CardDescription>Inbox</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {notifications.slice(0, 4).map((n) => (
                    <div key={n.id} className="flex items-start gap-2">
                      <div className={cn("mt-1 w-2 h-2 rounded-full", n.readAt ? "bg-slate-300" : "bg-sky-500")} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{n.title}</div>
                        <div className="text-xs lp-muted truncate">{n.body}</div>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 ? <div className="text-sm lp-muted">Nessuna notifica.</div> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Pet a rischio</CardTitle>
              <CardDescription>Prioritizzazione per severità e numero alert.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {worstList.map((row) => (
                  <div key={row.subject.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{row.subject.displayName}</div>
                      <div className="text-xs lp-muted truncate">{row.subject.species}</div>
                    </div>
                    <div className="text-xs lp-muted">{row.openCount}</div>
                  </div>
                ))}
              </div>
              {pets.length === 0 ? <div className="text-sm lp-muted">Nessun pet.</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Azioni</CardTitle>
              <CardDescription>Vai alle sezioni operative.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Link className="lp-btn-secondary" to="/app/tech/devices">Dispositivi</Link>
                <Link className="lp-btn-secondary" to="/app/tech/alerts">Alert</Link>
                <Link className="lp-btn-secondary" to="/app/tech/integrations">Integrazioni</Link>
                <Link className="lp-btn-secondary" to="/app/tech/marketplace">Compatibilità</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


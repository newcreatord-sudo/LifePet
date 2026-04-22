import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, PawPrint, Users, Play, Pause, Siren, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsUiStore } from "@/multispecies/stores/msUiStore";
import { subscribeAlerts, subscribeBindings, subscribeDevices, subscribeNotifications, subscribeSubjects } from "@/multispecies/data/msData";
import { subjectStatusFromAlerts } from "@/multispecies/lib/msDerived";
import type { AlertEvent, Device, DeviceBinding, Notification, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

function severityDot(sev: AlertEvent["severity"]) {
  if (sev === "critical") return "bg-rose-500";
  if (sev === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export default function PlatformDashboard() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";

  const mode = useMsUiStore((s) => s.mode);
  const setMode = useMsUiStore((s) => s.setMode);
  const simRunning = useMsUiStore((s) => s.simRunning);
  const setSimRunning = useMsUiStore((s) => s.setSimRunning);
  const simIntensity = useMsUiStore((s) => s.simIntensity);
  const setSimIntensity = useMsUiStore((s) => s.setSimIntensity);

  const location = useLocation();
  const inFarmArea = location.pathname.startsWith("/app/farm");

  useEffect(() => {
    if (!inFarmArea) return;
    setMode("farm");
  }, [inFarmArea, setMode]);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);
  useEffect(() => subscribeNotifications(uid, setNotifications), [uid]);

  const filteredSubjects = useMemo(() => subjects.filter((s) => (mode === "pet" ? s.type === "pet" : s.type !== "pet")), [mode, subjects]);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const onlineDevices = useMemo(() => devices.filter((d) => d.isOnline), [devices]);

  const worstList = useMemo(() => {
    const rows = filteredSubjects
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
  }, [bindings, devices, filteredSubjects, openAlerts]);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {!inFarmArea ? (
        <div className="inline-flex rounded-full p-1 lp-panel">
          <button
            type="button"
            className={cn("px-3 py-1.5 rounded-full text-sm", mode === "pet" ? "lp-btn-primary" : "lp-btn-secondary")}
            onClick={() => setMode("pet")}
          >
            <span className="inline-flex items-center gap-2">
              <PawPrint className="w-4 h-4" />
              Pet
            </span>
          </button>
          <button
            type="button"
            className={cn("px-3 py-1.5 rounded-full text-sm", mode === "farm" ? "lp-btn-primary" : "lp-btn-secondary")}
            onClick={() => setMode("farm")}
          >
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4" />
              Farm
            </span>
          </button>
        </div>
      ) : null}

      <button type="button" className="lp-btn-secondary" onClick={() => setSimRunning(!simRunning)}>
        <span className="inline-flex items-center gap-2">
          {simRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {simRunning ? "Pausa demo" : "Avvia demo"}
        </span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Piattaforma Multi‑Specie", en: "Multi‑species Platform" }}
        description={{ it: "Telemetria normalizzata, stato device, alert e notifiche (demo mock).", en: "Unified telemetry, device status, alerts and notifications (mock demo)." }}
        actions={headerActions}
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  KPI
                </CardTitle>
                <CardDescription>{mode === "pet" ? "Vista pet domestici" : "Vista allevamento"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Soggetti</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{filteredSubjects.length}</div>
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
                <CardTitle className="flex items-center gap-2">
                  <Siren className="w-4 h-4" />
                  Alert recenti
                </CardTitle>
                <CardDescription>Ultimi eventi in stato aperto.</CardDescription>
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
                  {openAlerts.length === 0 ? <div className="text-sm lp-muted">Nessun alert aperto.</div> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifiche
                </CardTitle>
                <CardDescription>In‑app inbox.</CardDescription>
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
              <CardTitle>{mode === "pet" ? "Stato pet" : "Capi a rischio"}</CardTitle>
              <CardDescription>{mode === "pet" ? "Sintesi stato e alert per soggetto." : "Prioritizzazione per severità e numero alert."}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {worstList.map((row) => (
                  <div key={row.subject.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`${inFarmArea ? "/app/farm" : "/app/tech"}/subjects/${row.subject.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {row.subject.displayName}
                      </Link>
                      <div className="text-xs lp-muted truncate">{row.subject.type} · {row.subject.species}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        row.status === "critical" ? "bg-rose-500/15 text-rose-700" :
                        row.status === "warning" ? "bg-amber-500/15 text-amber-700" :
                        row.status === "attention" ? "bg-sky-500/15 text-sky-700" :
                        row.status === "offline" ? "bg-slate-500/15 text-slate-700" :
                        "bg-emerald-500/15 text-emerald-700"
                      )}>
                        {row.status}
                      </div>
                      <div className="text-xs lp-muted">{row.openCount}</div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredSubjects.length === 0 ? <div className="text-sm lp-muted">Nessun soggetto.</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Azioni rapide</CardTitle>
              <CardDescription>Apri subito le funzioni nuove della piattaforma.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {inFarmArea ? (
                  <>
                    <Link className="lp-btn-primary" to="/app/farm/subjects">Animali</Link>
                    <Link className="lp-btn-secondary" to="/app/farm/devices">Dispositivi</Link>
                    <Link className="lp-btn-secondary" to="/app/farm/alerts">Alert</Link>
                    <Link className="lp-btn-secondary" to="/app/farm/herds">Mandrie</Link>
                    <Link className="lp-btn-secondary" to="/app/farm/geofences">Recinti</Link>
                    <Link className="lp-btn-secondary" to="/app/farm/diagnostics">Diagnostica</Link>
                  </>
                ) : (
                  <>
                    <Link className="lp-btn-primary" to="/app/tech/devices">Dispositivi</Link>
                    <Link className="lp-btn-secondary" to="/app/tech/alerts">Alert</Link>
                    <Link className="lp-btn-secondary" to="/app/tech/integrations">Integrazioni</Link>
                    <Link className="lp-btn-secondary" to="/app/tech/import">Import CSV</Link>
                    <Link className="lp-btn-secondary" to="/app/tech/diagnostics">Diagnostica</Link>
                    <Link className="lp-btn-secondary" to="/app/tech/marketplace">Compatibilità</Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Demo simulator</CardTitle>
              <CardDescription>Genera telemetria e trigger alert.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Stato</div>
                    <div className="text-xs lp-muted">{simRunning ? "In esecuzione" : "Fermo"}</div>
                  </div>
                  <button type="button" className="lp-btn-primary" onClick={() => setSimRunning(!simRunning)}>
                    <span className="inline-flex items-center gap-2">
                      {simRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {simRunning ? "Pausa" : "Avvia"}
                    </span>
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Intensità</div>
                    <div className="text-xs lp-muted">{Math.round(simIntensity * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={simIntensity}
                    onChange={(e) => setSimIntensity(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="text-xs lp-muted">
                  In produzione: ingestion via webhook/polling, normalizzazione su backend, alert engine server-side.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

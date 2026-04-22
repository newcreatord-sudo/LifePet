import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Activity, AlertTriangle, Fence, HeartPulse, LayoutDashboard, Map as MapIcon, MapPin, Siren, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsUiStore } from "@/multispecies/stores/msUiStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import { subscribeAlerts, subscribeBindings, subscribeDevices, subscribeGeofences, subscribeHerds, subscribeRecentSamples, subscribeSubjects } from "@/multispecies/data/msData";
import { subjectStatusFromAlerts } from "@/multispecies/lib/msDerived";
import { useAuthStore } from "@/stores/authStore";
import type { AlertEvent, Device, DeviceBinding, Geofence, Herd, MetricSample, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";

type SubjectLocation = { subjectId: string; lat: number; lng: number; at: number };

function badgeIcon(label: string, color: string) {
  const html = `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.95);box-shadow:0 10px 24px rgba(15,23,42,0.20);display:flex;align-items:center;justify-content:center;color:#0b1220;font-weight:700;font-size:11px;">${label}</div>`;
  return L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -13] });
}

function FitBounds(props: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!props.bounds) return;
    map.fitBounds(props.bounds, { padding: [20, 20] });
  }, [map, props.bounds]);
  return null;
}

function severityDot(sev: AlertEvent["severity"]) {
  if (sev === "critical") return "bg-rose-500";
  if (sev === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export default function FarmDashboard() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const setMode = useMsUiStore((s) => s.setMode);
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [viewHerdId, setViewHerdId] = useState<string>("");
  const [tiles, setTiles] = useState<"carto_light" | "osm">("carto_light");
  const [locations, setLocations] = useState<Record<string, SubjectLocation>>({});

  useEffect(() => {
    setMode("farm");
  }, [setMode]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeGeofences(uid, setGeofences), [uid]);

  const livestock = useMemo(
    () => subjects.filter((s) => s.type !== "pet").filter((s) => (activeFarmId ? s.farmId === activeFarmId : true)),
    [activeFarmId, subjects]
  );

  const visibleLivestock = useMemo(() => livestock.filter((s) => (viewHerdId ? s.herdId === viewHerdId : true)), [livestock, viewHerdId]);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const onlineDevices = useMemo(() => devices.filter((d) => d.isOnline), [devices]);
  const criticalAlerts = useMemo(() => openAlerts.filter((a) => a.severity === "critical"), [openAlerts]);
  const geofenceOutside = useMemo(() => {
    return openAlerts.filter((a) => {
      const has = (a.linkedMetrics ?? []).some((m) => m.metricType === "geofence_status");
      if (!has) return false;
      const t = (a.title || "").toLowerCase();
      return t.includes("recinto") || t.includes("geofence");
    });
  }, [openAlerts]);

  const herdNameById = useMemo(() => new globalThis.Map(herds.map((h) => [h.id, h.name] as const)), [herds]);

  const herdsForFarm = useMemo(() => {
    return herds.filter((h) => (activeFarmId ? h.farmId === activeFarmId : true));
  }, [activeFarmId, herds]);

  const fencesForFarm = useMemo(() => {
    return geofences.filter((g) => (activeFarmId ? g.farmId === activeFarmId : true));
  }, [activeFarmId, geofences]);

  const gpsSubjectIds = useMemo(() => {
    const deviceById = new globalThis.Map(devices.map((d) => [d.id, d] as const));
    const activeBindings = bindings.filter((b) => !b.unboundAt);
    const ids = new Set<string>();
    for (const b of activeBindings) {
      const s = visibleLivestock.find((x) => x.id === b.subjectId);
      if (!s) continue;
      const d = deviceById.get(b.deviceId);
      if (!d) continue;
      const sup = Array.isArray(d.supportedMetrics) ? d.supportedMetrics : [];
      if (sup.includes("location_lat") && sup.includes("location_lng")) ids.add(b.subjectId);
    }
    return Array.from(ids).slice(0, 40);
  }, [bindings, devices, visibleLivestock]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    setLocations({});

    for (const subjectId of gpsSubjectIds) {
      const unsub = subscribeRecentSamples(uid, subjectId, 40, (samples: MetricSample[]) => {
        let lat: number | null = null;
        let lng: number | null = null;
        let at = 0;
        for (const s of samples) {
          if (s.metricType === "location_lat") {
            const v = Number(s.value);
            if (Number.isFinite(v)) {
              lat = v;
              at = Math.max(at, s.sourceTimestamp || s.receivedAt || 0);
            }
          }
          if (s.metricType === "location_lng") {
            const v = Number(s.value);
            if (Number.isFinite(v)) {
              lng = v;
              at = Math.max(at, s.sourceTimestamp || s.receivedAt || 0);
            }
          }
        }
        if (lat === null || lng === null) return;
        setLocations((prev) => ({ ...prev, [subjectId]: { subjectId, lat, lng, at } }));
      });
      unsubs.push(unsub);
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [gpsSubjectIds, uid]);

  const mapCenter = useMemo(() => {
    const firstFence = fencesForFarm[0];
    if (firstFence) return firstFence.center;
    const firstLoc = Object.values(locations)[0];
    if (firstLoc) return { lat: firstLoc.lat, lng: firstLoc.lng };
    return { lat: 41.9028, lng: 12.4964 };
  }, [fencesForFarm, locations]);

  const mapBounds = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (const l of Object.values(locations)) pts.push([l.lat, l.lng]);
    for (const f of fencesForFarm) pts.push([f.center.lat, f.center.lng]);
    if (!pts.length) return null;
    return L.latLngBounds(pts.map(([lat, lng]) => L.latLng(lat, lng)));
  }, [fencesForFarm, locations]);

  const herdRows = useMemo(() => {
    return herdsForFarm
      .map((h) => {
        const memberIds = livestock.filter((s) => s.herdId === h.id).map((s) => s.id);
        const set = new Set(memberIds);
        const open = openAlerts.filter((a) => set.has(a.subjectId));
        const critical = open.filter((a) => a.severity === "critical").length;
        return { herd: h, members: memberIds.length, open: open.length, critical };
      })
      .sort((a, b) => {
        if (b.critical !== a.critical) return b.critical - a.critical;
        if (b.open !== a.open) return b.open - a.open;
        return b.members - a.members;
      })
      .slice(0, 8);
  }, [herdsForFarm, livestock, openAlerts]);

  const worstList = useMemo(() => {
    const rows = livestock
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
  }, [bindings, devices, livestock, openAlerts]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Reparto Farm", en: "Farm" }}
        description={{ it: "Gestione allevamento: capi, mandrie, recinti digitali, dispositivi, alert.", en: "Livestock management: animals, herds, digital fences, devices, alerts." }}
        showImage={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="lp-btn-primary" to="/app/farm/subjects">Animali</Link>
            <Link className="lp-btn-secondary" to="/app/farm/map">Mappa</Link>
            <Link className="lp-btn-secondary" to="/app/farm/herds">Mandrie</Link>
            <Link className="lp-btn-secondary" to="/app/farm/geofences">Recinti</Link>
            <Link className="lp-btn-secondary" to="/app/farm/alerts">Alert</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapIcon className="w-4 h-4" />Mappa (Farm)</CardTitle>
              <CardDescription>Posizione capi (GPS) + recinti digitali. Per creare/modificare recinti usa “Mappa completa”.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2 pb-3">
                <div>
                  <div className="text-xs lp-muted">Mandria</div>
                  <select className="lp-input mt-1" value={viewHerdId} onChange={(e) => setViewHerdId(e.target.value)}>
                    <option value="">(tutte)</option>
                    {herdsForFarm.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs lp-muted">Tiles</div>
                  <select className="lp-input mt-1" value={tiles} onChange={(e) => setTiles(e.target.value as "carto_light" | "osm")}>
                    <option value="carto_light">Carto Light</option>
                    <option value="osm">OSM Standard</option>
                  </select>
                </div>
                <div className="flex-1" />
                <Link className="lp-btn-secondary" to="/app/farm/map">
                  <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" />Mappa completa</span>
                </Link>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <MapContainer center={mapCenter} zoom={13} style={{ height: 420, width: "100%" }}>
                  {tiles === "carto_light" ? (
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    />
                  ) : (
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                  )}
                  <FitBounds bounds={mapBounds} />

                  {fencesForFarm.map((f) => (
                    <Circle
                      key={f.id}
                      center={f.center}
                      radius={f.radiusM}
                      pathOptions={{ color: "#22c55e", fillOpacity: 0.10 }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{f.name}</div>
                          <div className="text-xs">r={Math.round(f.radiusM)}m {f.herdId ? `· ${herdNameById.get(f.herdId) ?? f.herdId}` : ""}</div>
                        </div>
                      </Popup>
                    </Circle>
                  ))}

                  {Object.values(locations).map((l) => {
                    const s = visibleLivestock.find((x) => x.id === l.subjectId);
                    if (!s) return null;
                    const label = (s.displayName || "?").slice(0, 2).toUpperCase();
                    return (
                      <Marker
                        key={l.subjectId}
                        position={{ lat: l.lat, lng: l.lng }}
                        icon={badgeIcon(label, "rgb(var(--lp-accent))")}
                      >
                        <Popup>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold">{s.displayName}</div>
                            <div className="text-xs">{s.species}{s.herdId ? ` · ${herdNameById.get(s.herdId) ?? s.herdId}` : ""}</div>
                            <div className="text-xs">{new Date(l.at || Date.now()).toLocaleString()}</div>
                            <Link className="lp-btn-secondary mt-2" to={`/app/farm/subjects/${s.id}`}>Apri scheda</Link>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <div className="lp-panel px-3 py-2 text-sm">GPS: <span className="font-semibold">{Object.keys(locations).length}</span></div>
                <div className="lp-panel px-3 py-2 text-sm">Critici: <span className="font-semibold">{criticalAlerts.length}</span></div>
                <div className="lp-panel px-3 py-2 text-sm">Fuori recinto: <span className="font-semibold">{geofenceOutside.length}</span></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" />KPI</CardTitle>
                <CardDescription>Vista allevamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Animali</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{livestock.length}</div>
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
                <CardTitle className="flex items-center gap-2"><Siren className="w-4 h-4" />Critici</CardTitle>
                <CardDescription>Da intervenire subito.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{criticalAlerts.length}</div>
                <div className="mt-1 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Comprende salute, sicurezza e device offline.</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Fence className="w-4 h-4" />Recinti</CardTitle>
                <CardDescription>Monitoraggio geofence.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Geofence</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{geofences.length}</div>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Fuori area</div>
                    <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{geofenceOutside.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Capi a rischio</CardTitle>
              <CardDescription>Prioritizzazione per severità e numero alert.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {worstList.map((row) => (
                  <div key={row.subject.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/app/farm/subjects/${row.subject.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {row.subject.displayName}
                      </Link>
                      <div className="text-xs lp-muted truncate">
                        {row.subject.species}{row.subject.herdId ? ` · ${herdNameById.get(row.subject.herdId) ?? row.subject.herdId}` : ""}
                      </div>
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
              {livestock.length === 0 ? <div className="text-sm lp-muted">Nessun animale.</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alert recenti</CardTitle>
              <CardDescription>Ultimi eventi aperti.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openAlerts.slice(0, 8).map((a) => (
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
              <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Mandrie</CardTitle>
              <CardDescription>Top mandrie per alert e dimensione.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {herdRows.map((r) => (
                  <div key={r.herd.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/app/farm/herds/${r.herd.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {r.herd.name}
                      </Link>
                      <div className="text-xs lp-muted truncate">{r.members} capi · {r.open} alert</div>
                    </div>
                    <div className={cn("text-xs px-2 py-1 rounded-full", r.critical ? "bg-rose-500/15 text-rose-700" : "bg-slate-500/15 text-slate-700")}>
                      {r.critical ? `crit ${r.critical}` : "ok"}
                    </div>
                  </div>
                ))}
                {herdsForFarm.length === 0 ? <div className="text-sm lp-muted">Nessuna mandria.</div> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartPulse className="w-4 h-4" />Azioni</CardTitle>
              <CardDescription>Operatività e gestione dati.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Link className="lp-btn-secondary" to="/app/farm/devices">Dispositivi</Link>
                <Link className="lp-btn-secondary" to="/app/farm/integrations">Integrazioni</Link>
                <Link className="lp-btn-secondary" to="/app/farm/import">Import CSV</Link>
                <Link className="lp-btn-secondary" to="/app/farm/diagnostics">Diagnostica</Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" />Note operative</CardTitle>
              <CardDescription>Come usare al meglio il reparto.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Recinti digitali</div>
                  <div className="mt-1">Crea geofence e invia GPS: il sistema calcola inside/outside e apre alert.</div>
                </div>
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Telemetria</div>
                  <div className="mt-1">Usa mapping per-vendor in Integrazioni per normalizzare i payload.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

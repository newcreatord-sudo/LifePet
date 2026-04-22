import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Fence, LocateFixed, MapPin, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { deleteGeofence, subscribeBindings, subscribeDevices, subscribeGeofences, subscribeHerds, subscribeRecentSamples, subscribeSubjects, upsertGeofence } from "@/multispecies/data/msData";
import { useAuthStore } from "@/stores/authStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import type { Device, DeviceBinding, Geofence, Herd, MetricSample, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";

const FALLBACK_CENTER = { lat: 41.9028, lng: 12.4964 };

function badgeIcon(label: string, color: string) {
  const html = `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.95);box-shadow:0 10px 24px rgba(15,23,42,0.20);display:flex;align-items:center;justify-content:center;color:#0b1220;font-weight:700;font-size:12px;">${label}</div>`;
  return L.divIcon({ className: "", html, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

function FitBounds(props: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!props.bounds) return;
    map.fitBounds(props.bounds, { padding: [24, 24] });
  }, [map, props.bounds]);
  return null;
}

function MapClick(props: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      props.onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

type SubjectLocation = { subjectId: string; lat: number; lng: number; at: number };

export default function FarmMap() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  const [locations, setLocations] = useState<Record<string, SubjectLocation>>({});
  const [mapReady, setMapReady] = useState(false);

  const [tiles, setTiles] = useState<"carto_light" | "osm">("carto_light");

  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string>("");
  const [draftName, setDraftName] = useState("Recinto digitale");
  const [draftHerdId, setDraftHerdId] = useState<string>("");
  const [draftRadiusM, setDraftRadiusM] = useState("250");
  const [draftCenter, setDraftCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [viewHerdId, setViewHerdId] = useState<string>("");

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeGeofences(uid, setGeofences), [uid]);

  const livestock = useMemo(() => {
    return subjects
      .filter((s) => s.type !== "pet")
      .filter((s) => (activeFarmId ? s.farmId === activeFarmId : true));
  }, [activeFarmId, subjects]);

  const visibleLivestock = useMemo(() => {
    return livestock.filter((s) => (viewHerdId ? s.herdId === viewHerdId : true));
  }, [livestock, viewHerdId]);

  const herdsForFarm = useMemo(() => herds.filter((h) => (activeFarmId ? h.farmId === activeFarmId : true)), [activeFarmId, herds]);
  const fencesForFarm = useMemo(() => geofences.filter((g) => (activeFarmId ? g.farmId === activeFarmId : true)), [activeFarmId, geofences]);

  const gpsSubjectIds = useMemo(() => {
    const deviceById = new Map(devices.map((d) => [d.id, d] as const));
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
    return Array.from(ids).slice(0, 60);
  }, [bindings, devices, visibleLivestock]);

  const draftRadius = useMemo(() => {
    const r = Number(draftRadiusM);
    if (!Number.isFinite(r) || r <= 0) return 250;
    return Math.min(200_000, Math.max(20, Math.round(r)));
  }, [draftRadiusM]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const next: Record<string, SubjectLocation> = {};
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

    setLocations(next);
    return () => {
      for (const u of unsubs) u();
    };
  }, [gpsSubjectIds, uid]);

  const center = useMemo(() => {
    if (draftCenter) return draftCenter;
    const firstFence = fencesForFarm[0];
    if (firstFence) return firstFence.center;
    const firstLoc = Object.values(locations)[0];
    if (firstLoc) return { lat: firstLoc.lat, lng: firstLoc.lng };
    return FALLBACK_CENTER;
  }, [draftCenter, fencesForFarm, locations]);

  const bounds = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (const l of Object.values(locations)) pts.push([l.lat, l.lng]);
    for (const f of fencesForFarm) pts.push([f.center.lat, f.center.lng]);
    if (!pts.length) return null;
    return L.latLngBounds(pts.map(([lat, lng]) => L.latLng(lat, lng)));
  }, [fencesForFarm, locations]);

  const herdNameById = useMemo(() => new Map(herds.map((h) => [h.id, h.name] as const)), [herds]);

  const selectedGeofence = useMemo(() => fencesForFarm.find((g) => g.id === selectedGeofenceId) ?? null, [fencesForFarm, selectedGeofenceId]);

  useEffect(() => {
    if (!selectedGeofence) return;
    setDraftName(selectedGeofence.name);
    setDraftHerdId(selectedGeofence.herdId ?? "");
    setDraftRadiusM(String(Math.round(selectedGeofence.radiusM)));
    setDraftCenter(selectedGeofence.center);
  }, [selectedGeofence]);

  async function saveFence() {
    if (!activeFarmId) return;
    const r = Number(draftRadiusM);
    if (!draftCenter) return;
    if (!Number.isFinite(r) || r < 20 || r > 200000) return;
    await upsertGeofence(uid, {
      id: selectedGeofenceId || undefined,
      farmId: activeFarmId,
      herdId: draftHerdId || undefined,
      name: draftName || "Geofence",
      shape: "circle",
      center: draftCenter,
      radiusM: r,
    });
    setSelectedGeofenceId("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Mappa Farm", en: "Farm Map" }}
        description={{ it: "Controlla i capi su mappa e crea/gestisci recinti digitali.", en: "Track livestock on map and manage digital fences." }}
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" />Mappa</CardTitle>
              <CardDescription>Clicca sulla mappa per impostare il centro del recinto. Se vedi “service is unavailable”, cambia tiles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2 pb-3">
                <div>
                  <div className="text-xs lp-muted">Tiles</div>
                  <select className="lp-input mt-1" value={tiles} onChange={(e) => setTiles(e.target.value as "carto_light" | "osm")}>
                    <option value="carto_light">Carto Light</option>
                    <option value="osm">OSM Standard</option>
                  </select>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <MapContainer
                  center={center}
                  zoom={13}
                  style={{ height: 520, width: "100%" }}
                  whenReady={() => setMapReady(true)}
                >
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
                  <FitBounds bounds={mapReady ? bounds : null} />
                  <MapClick onPick={setDraftCenter} />

                  {fencesForFarm.map((f) => (
                    <Circle
                      key={f.id}
                      center={f.center}
                      radius={f.radiusM}
                      pathOptions={{ color: f.id === selectedGeofenceId ? "#0ea5e9" : "#22c55e", fillOpacity: 0.12 }}
                      eventHandlers={{ click: () => setSelectedGeofenceId(f.id) }}
                    >
                      <Popup>
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">{f.name}</div>
                          <div className="text-xs">r={Math.round(f.radiusM)}m {f.herdId ? `· ${herdNameById.get(f.herdId) ?? f.herdId}` : ""}</div>
                          <div className="flex gap-2">
                            <button type="button" className="lp-btn-secondary" onClick={() => setSelectedGeofenceId(f.id)}>Modifica</button>
                            <button type="button" className="lp-btn-secondary" onClick={() => void deleteGeofence(uid, f.id)}>
                              <span className="inline-flex items-center gap-2"><Trash2 className="w-4 h-4" />Elimina</span>
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Circle>
                  ))}

                  {draftCenter ? (
                    <>
                      <Circle
                        center={draftCenter}
                        radius={draftRadius}
                        pathOptions={{ color: "#0ea5e9", fillOpacity: 0.08, dashArray: "6 6" }}
                      />
                      <Marker
                        position={draftCenter}
                        draggable
                        icon={badgeIcon("+", "rgb(var(--lp-accent-2))")}
                        eventHandlers={{
                          dragend: (e) => {
                            const ll = (e.target as L.Marker).getLatLng();
                            setDraftCenter({ lat: ll.lat, lng: ll.lng });
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-sm">Centro recinto: {draftCenter.lat.toFixed(5)}, {draftCenter.lng.toFixed(5)}</div>
                        </Popup>
                      </Marker>
                    </>
                  ) : null}

                  {Object.values(locations).map((l) => {
                    const s = visibleLivestock.find((x) => x.id === l.subjectId);
                    if (!s) return null;
                    const label = (s.displayName || "?").slice(0, 2).toUpperCase();
                    const color = "rgb(var(--lp-accent))";
                    return (
                      <Marker key={l.subjectId} position={{ lat: l.lat, lng: l.lng }} icon={badgeIcon(label, color)}>
                        <Popup>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold">{s.displayName}</div>
                            <div className="text-xs">{s.species}{s.herdId ? ` · ${herdNameById.get(s.herdId) ?? s.herdId}` : ""}</div>
                            <div className="text-xs">{new Date(l.at || Date.now()).toLocaleString()}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              <div className="mt-3 text-xs lp-muted">
                Mostrati {Object.keys(locations).length}/{gpsSubjectIds.length} capi con GPS (max 60).
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
              <CardDescription>Riduci mappa a una singola mandria.</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <div className="text-xs lp-muted">Mandria</div>
                <select className="lp-input w-full mt-1" value={viewHerdId} onChange={(e) => setViewHerdId(e.target.value)}>
                  <option value="">(tutte)</option>
                  {herdsForFarm.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Fence className="w-4 h-4" />Recinti digitali</CardTitle>
              <CardDescription>Seleziona un recinto oppure crea un nuovo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn("lp-btn-secondary flex-1", !selectedGeofenceId ? "ring-2 ring-sky-500/30" : "")}
                    onClick={() => {
                      setSelectedGeofenceId("");
                      setDraftName("Recinto digitale");
                      setDraftHerdId("");
                      setDraftRadiusM("250");
                      setDraftCenter(null);
                    }}
                  >
                    Nuovo
                  </button>
                  <button
                    type="button"
                    className={cn("lp-btn-secondary flex-1", selectedGeofenceId ? "ring-2 ring-sky-500/30" : "")}
                    disabled={!selectedGeofenceId}
                    onClick={() => {
                      if (!selectedGeofenceId) return;
                      setDraftCenter(selectedGeofence?.center ?? null);
                    }}
                  >
                    Modifica
                  </button>
                </div>

                <div>
                  <div className="text-xs lp-muted">Nome</div>
                  <input className="lp-input w-full mt-1" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                </div>

                <div>
                  <div className="text-xs lp-muted">Mandria (opzionale)</div>
                  <select className="lp-input w-full mt-1" value={draftHerdId} onChange={(e) => setDraftHerdId(e.target.value)}>
                    <option value="">(tutta la farm)</option>
                    {herdsForFarm.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs lp-muted">Raggio (m)</div>
                  <input className="lp-input w-full mt-1" value={draftRadiusM} onChange={(e) => setDraftRadiusM(e.target.value)} inputMode="decimal" />
                </div>

                <div>
                  <div className="text-xs lp-muted">Centro</div>
                  <div className="mt-1 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
                    {draftCenter ? `${draftCenter.lat.toFixed(5)}, ${draftCenter.lng.toFixed(5)}` : "Clicca sulla mappa"}
                  </div>
                </div>

                <button
                  type="button"
                  className="lp-btn-primary w-full"
                  disabled={!activeFarmId || !draftCenter}
                  onClick={() => void saveFence()}
                >
                  <span className="inline-flex items-center gap-2"><Save className="w-4 h-4" />Salva recinto</span>
                </button>

                <button
                  type="button"
                  className="lp-btn-secondary w-full"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => setDraftCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      () => setDraftCenter(null),
                      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30_000 }
                    );
                  }}
                >
                  <span className="inline-flex items-center gap-2"><LocateFixed className="w-4 h-4" />Usa mia posizione</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recinti</CardTitle>
              <CardDescription>Lista recinti (farm attiva).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {fencesForFarm.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn("w-full text-left lp-panel px-3 py-2", f.id === selectedGeofenceId ? "ring-2 ring-sky-500/30" : "")}
                    onClick={() => setSelectedGeofenceId(f.id)}
                  >
                    <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{f.name}</div>
                    <div className="text-xs lp-muted truncate">r={Math.round(f.radiusM)}m {f.herdId ? `· ${herdNameById.get(f.herdId) ?? f.herdId}` : ""}</div>
                  </button>
                ))}
                {fencesForFarm.length === 0 ? <div className="text-sm lp-muted">Nessun recinto.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

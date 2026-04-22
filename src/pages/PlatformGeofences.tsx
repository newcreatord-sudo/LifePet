import { useEffect, useMemo, useState } from "react";
import { Fence, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Link, useLocation } from "react-router-dom";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { deleteGeofence, subscribeFarms, subscribeGeofences, subscribeHerds, upsertGeofence } from "@/multispecies/data/msData";
import { useAuthStore } from "@/stores/authStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import type { Farm, Geofence, Herd } from "@/multispecies/types";

export default function PlatformGeofences() {
  useMultiSpeciesDemo();

  const location = useLocation();
  const inFarmArea = location.pathname.startsWith("/app/farm");

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);
  const setActiveFarmId = useMsFarmStore((s) => s.setActiveFarmId);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  const [farmId, setFarmId] = useState<string>("");
  const [herdId, setHerdId] = useState<string>("");

  const [name, setName] = useState("Recinto digitale");
  const [lat, setLat] = useState("45.4642");
  const [lng, setLng] = useState("9.19");
  const [radiusM, setRadiusM] = useState("250");

  useEffect(() => subscribeFarms(uid, setFarms), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeGeofences(uid, setGeofences), [uid]);

  useEffect(() => {
    if (farmId) return;
    if (activeFarmId) {
      setFarmId(activeFarmId);
      return;
    }
    if (farms[0]?.id) {
      setFarmId(farms[0].id);
      setActiveFarmId(farms[0].id);
    }
  }, [activeFarmId, farmId, farms, setActiveFarmId]);

  const herdsForFarm = useMemo(() => herds.filter((h) => (farmId ? h.farmId === farmId : true)), [farmId, herds]);
  const fencesForFarm = useMemo(() => geofences.filter((g) => (farmId ? g.farmId === farmId : true)), [farmId, geofences]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Recinti digitali", en: "Digital fences" }}
        description={{ it: "Geofence circle (base) per farm/mandria. Il backend calcola inside/outside e genera alert.", en: "Circle geofences for farm/herd. Backend computes inside/outside and triggers alerts." }}
        showImage={false}
        actions={inFarmArea ? <Link className="lp-btn-secondary" to="/app/farm/map">Apri mappa</Link> : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Fence className="w-4 h-4" />Crea geofence</CardTitle>
              <CardDescription>Associala alla farm o a una mandria specifica.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-xs lp-muted">Farm</div>
                  <select
                    className="w-full lp-input mt-1"
                    value={farmId}
                    onChange={(e) => {
                      setFarmId(e.target.value);
                      setActiveFarmId(e.target.value);
                      setHerdId("");
                    }}
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs lp-muted">Mandria (opzionale)</div>
                  <select className="w-full lp-input mt-1" value={herdId} onChange={(e) => setHerdId(e.target.value)}>
                    <option value="">(tutta la farm)</option>
                    {herdsForFarm.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs lp-muted">Nome</div>
                  <input className="w-full lp-input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs lp-muted">Lat</div>
                    <input className="w-full lp-input mt-1" value={lat} onChange={(e) => setLat(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Lng</div>
                    <input className="w-full lp-input mt-1" value={lng} onChange={(e) => setLng(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Raggio (m)</div>
                    <input className="w-full lp-input mt-1" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} />
                  </div>
                </div>

                <button
                  type="button"
                  className="lp-btn-primary w-full"
                  disabled={!farmId}
                  onClick={() => {
                    if (!farmId) return;
                    const nLat = Number(lat);
                    const nLng = Number(lng);
                    const nR = Number(radiusM);
                    if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || !Number.isFinite(nR)) return;
                    void upsertGeofence(uid, {
                      farmId,
                      herdId: herdId || undefined,
                      name: name || "Geofence",
                      shape: "circle",
                      center: { lat: nLat, lng: nLng },
                      radiusM: nR,
                    });
                  }}
                >
                  <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" />Crea</span>
                </button>
                <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>
                  Il backend scrive `geofence_status=inside/outside` quando riceve `location_lat/lng`.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Geofence attive</CardTitle>
              <CardDescription>Lista per farm selezionata.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[680px] overflow-y-auto">
                {fencesForFarm.map((g) => (
                  <div key={g.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{g.name}</div>
                      <div className="text-xs lp-muted truncate">{g.shape} · r={Math.round(g.radiusM)}m · ({g.center.lat.toFixed(4)},{g.center.lng.toFixed(4)}){g.herdId ? ` · herd ${g.herdId}` : ""}</div>
                    </div>
                    <button type="button" className="lp-btn-secondary" onClick={() => void deleteGeofence(uid, g.id)}>
                      <span className="inline-flex items-center gap-2"><Trash2 className="w-4 h-4" />Elimina</span>
                    </button>
                  </div>
                ))}
                {fencesForFarm.length === 0 ? <div className="text-sm lp-muted">Nessun geofence.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

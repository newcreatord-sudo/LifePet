import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { ExternalLink, LocateFixed, MapPinned, Search } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { getApiBase } from "@/lib/apiBase";

type Category = "veterinary" | "grooming" | "boarding" | "pet_store";

type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  tags?: Record<string, string>;
  distanceM?: number;
};

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lon - a.lon) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function apiBase() {
  return getApiBase();
}

function placeIcon() {
  const html = `<div style="width:28px;height:28px;border-radius:9999px;background:rgb(var(--lp-primary));border:2px solid rgba(255,255,255,0.95);box-shadow:0 10px 24px rgba(15,23,42,0.20);display:flex;align-items:center;justify-content:center;color:#0b1220;font-weight:800;font-size:12px;">+</div>`;
  return L.divIcon({ className: "", html, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

function labelCategory(c: Category) {
  if (c === "veterinary") return "Veterinari";
  if (c === "grooming") return "Toelettatura";
  if (c === "boarding") return "Pensioni / Dog sitter";
  return "Pet shop";
}

export function NearbyPanel({ mapMode }: { mapMode: "inline" | "modal" }) {
  const pushToast = useToastStore((s) => s.push);
  const [mapOpen, setMapOpen] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState<Category>("veterinary");
  const [radiusKm, setRadiusKm] = useState("3");
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  function MapBinder() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }

  const radiusNum = useMemo(() => {
    const r = Number(radiusKm);
    if (!Number.isFinite(r)) return 3;
    return Math.min(25, Math.max(0.5, r));
  }, [radiusKm]);

  const visible = useMemo(() => {
    const c = center;
    if (!c) return places;
    return places
      .map((p) => ({ ...p, distanceM: distanceMeters(c, { lat: p.lat, lon: p.lon }) }))
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  }, [center, places]);

  const selected = useMemo(() => {
    const id = selectedId || visible[0]?.id || null;
    if (!id) return null;
    return visible.find((x) => x.id === id) ?? null;
  }, [selectedId, visible]);

  async function searchNearby(lat: number, lon: number) {
    setBusy(true);
    try {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      const r = await fetch(`${apiBase()}/api/osm-nearby`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat, lon, radiusKm: radiusNum, category }),
        signal: ctrl.signal,
      });
      if (r.status === 429) {
        const retry = r.headers.get("retry-after") || "";
        pushToast({ type: "info", title: "Limite richieste", message: retry ? `Riprova tra ${retry}s.` : "Riprova tra poco." });
        return;
      }
      const json = (await r.json().catch(() => null)) as null | {
        elements?: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;
      };
      const els = Array.isArray(json?.elements) ? json!.elements : [];
      const items: Place[] = els
        .map((e) => {
          const pos = typeof e.lat === "number" && typeof e.lon === "number" ? { lat: e.lat, lon: e.lon } : e.center;
          if (!pos) return null;
          const tags = e.tags || {};
          const name = String(tags.name || tags.brand || "Senza nome");
          const parts = [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean);
          const address = parts.length ? parts.join(" ") : undefined;
          return { id: `${e.type}:${e.id}`, name, lat: pos.lat, lon: pos.lon, address, tags };
        })
        .filter(Boolean) as Place[];
      setPlaces(items);
      setSelectedId(items[0]?.id ?? null);
      if (!items.length) pushToast({ type: "info", title: "Risultati", message: "Nessun risultato nel raggio selezionato." });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted) return;
      pushToast({ type: "error", title: "Ricerca", message: e instanceof Error ? e.message : "Ricerca fallita" });
    } finally {
      setBusy(false);
    }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      pushToast({ type: "error", title: "GPS", message: "Geolocalizzazione non disponibile." });
      return;
    }
    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setCenter(c);
      await searchNearby(c.lat, c.lon);
    } catch {
      pushToast({ type: "error", title: "GPS", message: "Permesso GPS negato o timeout." });
      setBusy(false);
    }
  }

  async function geocodeAndSearch() {
    const q = queryText.trim();
    if (!q) return;
    setBusy(true);
    try {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      const r = await fetch(`${apiBase()}/api/osm-geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (r.status === 429) {
        const retry = r.headers.get("retry-after") || "";
        pushToast({ type: "info", title: "Limite richieste", message: retry ? `Riprova tra ${retry}s.` : "Riprova tra poco." });
        return;
      }
      const items = (await r.json().catch(() => null)) as null | Array<{ lat: string; lon: string; display_name?: string }>;
      const top = Array.isArray(items) ? items[0] : null;
      const lat = top ? Number(top.lat) : NaN;
      const lon = top ? Number(top.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        pushToast({ type: "error", title: "Cerca", message: "Località non trovata." });
        return;
      }
      setCenter({ lat, lon });
      await searchNearby(lat, lon);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted) return;
      pushToast({ type: "error", title: "Cerca", message: e instanceof Error ? e.message : "Ricerca fallita" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={mapMode === "inline" ? "grid grid-cols-1 lg:grid-cols-12 gap-4" : "space-y-4"}>
        <div className={mapMode === "inline" ? "lg:col-span-5" : ""}>
          <Card className="p-4 relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Località (es. Milano, Roma, 'Via …')</div>
                <div className="flex gap-2">
                  <input className="lp-input" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Cerca una città o indirizzo" />
                  <button type="button" className="lp-btn-secondary" onClick={geocodeAndSearch} disabled={busy || !queryText.trim()}>
                    <Search className="w-4 h-4" />
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={useMyLocation} disabled={busy}>
                    <LocateFixed className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-600 mb-1">Categoria</div>
                <select className="lp-input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  <option value="veterinary">Veterinari</option>
                  <option value="grooming">Toelettatura</option>
                  <option value="boarding">Pensioni / Dog sitter</option>
                  <option value="pet_store">Pet shop</option>
                </select>
              </div>

              <div>
                <div className="text-xs text-slate-600 mb-1">Raggio (km)</div>
                <input className="lp-input" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="lp-btn-primary"
                onClick={() => {
                  if (!center) {
                    pushToast({ type: "error", title: "Posizione", message: "Seleziona una località o usa il GPS." });
                    return;
                  }
                  void searchNearby(center.lat, center.lon);
                }}
                disabled={busy}
              >
                Cerca {labelCategory(category)}
              </button>
              <div className="text-xs text-slate-600">Fonte dati: OpenStreetMap</div>
              {mapMode === "modal" ? <div className="flex-1" /> : null}
              {mapMode === "modal" ? (
                <button type="button" className="lp-btn-secondary inline-flex items-center gap-2" onClick={() => setMapOpen(true)}>
                  <MapPinned className="w-4 h-4" /> Apri mappa
                </button>
              ) : null}
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Risultati</CardTitle>
                <div className="lp-mini-ill" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={mapMode === "inline" ? "space-y-2 max-h-[520px] overflow-auto pr-1" : "space-y-2"}>
                {visible.slice(0, 40).map((p) => {
                  const active = p.id === (selected?.id ?? null);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={active ? "w-full text-left lp-panel lp-primary-soft p-3" : "w-full text-left lp-panel p-3"}
                      onClick={() => {
                        setSelectedId(p.id);
                        mapRef.current?.setView([p.lat, p.lon], 15, { animate: true });
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{p.name}</div>
                          {p.address ? <div className="text-xs text-slate-700 mt-1 truncate">{p.address}</div> : null}
                          {center && typeof p.distanceM === "number" ? <div className="text-xs text-slate-600 mt-1">{Math.round(p.distanceM)} m</div> : null}
                        </div>
                        <button
                          type="button"
                          className="lp-btn-icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedId(p.id);
                            setDetailOpen(true);
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </button>
                  );
                })}
                {!visible.length ? <div className="text-sm text-slate-600">Nessun risultato.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {mapMode === "inline" ? (
          <div className="lg:col-span-7">
            <Card className="overflow-hidden relative">
              <div className="lp-card-accent" aria-hidden="true" />
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Mappa</CardTitle>
                  <div className="lp-mini-ill" aria-hidden="true" />
                  {center ? <div className="text-xs text-slate-600">Raggio: {radiusNum} km</div> : null}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[560px] w-full rounded-2xl overflow-hidden border border-slate-200/70 bg-white/60">
                  <MapContainer
                    center={center ? [center.lat, center.lon] : [41.9028, 12.4964]}
                    zoom={center ? 13 : 6}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapBinder />
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {visible.map((p) => (
                      <Marker
                        key={p.id}
                        position={[p.lat, p.lon]}
                        icon={placeIcon()}
                        eventHandlers={{
                          click: () => {
                            setSelectedId(p.id);
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-sm font-semibold">{p.name}</div>
                          {p.address ? <div className="text-xs text-slate-700 mt-1">{p.address}</div> : null}
                          {center && typeof p.distanceM === "number" ? <div className="text-xs text-slate-700 mt-1">{Math.round(p.distanceM)} m</div> : null}
                          <a
                            className="inline-flex items-center gap-1 text-xs mt-2 underline"
                            href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Apri su OSM <ExternalLink className="w-3 h-3" />
                          </a>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Modal
        open={mapMode === "modal" && mapOpen}
        title="Mappa servizi"
        description="Visualizza i risultati sulla mappa."
        onClose={() => setMapOpen(false)}
        panelClassName="max-w-6xl"
      >
        <div className="h-[70vh] w-full rounded-2xl overflow-hidden border border-slate-200/70 bg-white/60">
          <MapContainer center={center ? [center.lat, center.lon] : [41.9028, 12.4964]} zoom={center ? 13 : 6} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visible.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lon]} icon={placeIcon()}>
                <Popup>
                  <div className="text-sm font-semibold">{p.name}</div>
                  {p.address ? <div className="text-xs text-slate-700 mt-1">{p.address}</div> : null}
                  {center && typeof p.distanceM === "number" ? <div className="text-xs text-slate-700 mt-1">{Math.round(p.distanceM)} m</div> : null}
                  <a
                    className="inline-flex items-center gap-1 text-xs mt-2 underline"
                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apri su OSM <ExternalLink className="w-3 h-3" />
                  </a>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        title={selected?.name || "Dettaglio"}
        description={selected?.address ? selected.address : "Dettaglio luogo"}
        onClose={() => setDetailOpen(false)}
        panelClassName="max-w-lg"
      >
        {!selected ? (
          <div className="text-sm text-slate-600">Nessun elemento selezionato.</div>
        ) : (
          <div className="space-y-3">
            {center && typeof selected.distanceM === "number" ? (
              <div className="lp-panel p-3">
                <div className="text-xs text-slate-600">Distanza stimata</div>
                <div className="text-sm font-semibold mt-1">{Math.round(selected.distanceM)} m</div>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                className="lp-btn-primary inline-flex items-center justify-center gap-2"
                href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=17/${selected.lat}/${selected.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Apri su OSM
              </a>
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  mapRef.current?.setView([selected.lat, selected.lon], 16, { animate: true });
                  setDetailOpen(false);
                }}
              >
                Centra in mappa
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

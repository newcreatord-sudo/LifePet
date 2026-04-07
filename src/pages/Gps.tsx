import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { clearGpsHistory, createGpsPoint, deleteGpsPoint, subscribeGpsHistory, subscribeLatestGpsPoint } from "@/data/gps";
import { updatePet } from "@/data/pets";
import type { GpsPoint } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExternalLink, Trash2 } from "lucide-react";
import { subscribeUserProfile } from "@/data/users";
import { Link } from "react-router-dom";

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export default function Gps() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [latest, setLatest] = useState<GpsPoint | null>(null);
  const [history, setHistory] = useState<GpsPoint[]>([]);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [tracking, setTracking] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAllowed, setGpsAllowed] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const [geofenceEnabled, setGeofenceEnabled] = useState(activePet?.geofence?.enabled ?? false);
  const [radiusM, setRadiusM] = useState(String(activePet?.geofence?.radiusM ?? 300));

  useEffect(() => {
    setGeofenceEnabled(activePet?.geofence?.enabled ?? false);
    setRadiusM(String(activePet?.geofence?.radiusM ?? 300));
  }, [activePet?.geofence?.enabled, activePet?.geofence?.radiusM]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub1 = subscribeLatestGpsPoint(activePetId, setLatest);
    const unsub2 = subscribeGpsHistory(activePetId, historyLimit, setHistory);
    return () => {
      unsub1();
      unsub2();
    };
  }, [activePetId, historyLimit]);

  useEffect(() => {
    if (!user || user.isDemo) {
      setGpsAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setGpsAllowed(p?.preferences?.gpsEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  async function saveGeofence() {
    if (!activePetId) return;
    const r = Number(radiusM);
    if (!latest) {
      setError("Registra prima un punto GPS.");
      return;
    }
    if (!Number.isFinite(r) || r < 20 || r > 5000) {
      setError("Il raggio deve essere tra 20 e 5000 metri.");
      return;
    }
    setError(null);
    await updatePet(activePetId, {
      geofence: {
        enabled: geofenceEnabled,
        centerLat: latest.lat,
        centerLng: latest.lng,
        radiusM: r,
      },
    });
  }

  async function recordOnce() {
    if (!user || !activePetId) return;
    setTracking(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      await createGpsPoint(activePetId, {
        petId: activePetId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        recordedAt: Date.now(),
        createdAt: Date.now(),
        createdBy: user.uid,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile leggere la posizione GPS");
    } finally {
      setTracking(false);
    }
  }

  async function startTracking() {
    if (!user || !activePetId) return;
    if (!navigator.geolocation) {
      setError("Geolocalizzazione non supportata.");
      return;
    }
    setError(null);
    setWatching(true);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const now = Date.now();
        const last = lastSavedRef.current;
        const moved = !last ? Infinity : distanceMeters({ lat: last.lat, lng: last.lng }, p);
        const elapsed = !last ? Infinity : now - last.at;
        if (moved < 12 && elapsed < 45_000) return;
        lastSavedRef.current = { lat: p.lat, lng: p.lng, at: now };
        await createGpsPoint(activePetId, {
          petId: activePetId,
          lat: p.lat,
          lng: p.lng,
          accuracyM: pos.coords.accuracy,
          recordedAt: now,
          createdAt: now,
          createdBy: user.uid,
        });
      },
      (e) => {
        setError(e.message || "Impossibile leggere la posizione GPS");
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    watchIdRef.current = id;
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const geofenceStatus = useMemo(() => {
    if (!activePet?.geofence?.enabled || !latest) return null;
    const c = { lat: activePet.geofence.centerLat, lng: activePet.geofence.centerLng };
    const p = { lat: latest.lat, lng: latest.lng };
    const d = distanceMeters(c, p);
    return { distanceM: d, outside: d > activePet.geofence.radiusM };
  }, [activePet?.geofence?.centerLat, activePet?.geofence?.centerLng, activePet?.geofence?.enabled, activePet?.geofence?.radiusM, latest]);

  const trackSpark = useMemo(() => {
    if (history.length < 2) return null;
    const pts = history
      .slice()
      .sort((a, b) => a.recordedAt - b.recordedAt)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    const minLat = Math.min(...pts.map((p) => p.lat));
    const maxLat = Math.max(...pts.map((p) => p.lat));
    const minLng = Math.min(...pts.map((p) => p.lng));
    const maxLng = Math.max(...pts.map((p) => p.lng));
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    const w = 320;
    const h = 120;
    const pad = 8;
    const d = pts
      .map((p, i) => {
        const x = pad + ((p.lng - minLng) / spanLng) * (w - pad * 2);
        const y = pad + (1 - (p.lat - minLat) / spanLat) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { d, w, h };
  }, [history]);

  return (
    <div className="space-y-6">
      <PageHeader title="GPS" description="Tracking, storico e zona sicura (geofence)." />

      {!gpsAllowed ? (
        <EmptyState
          title="GPS disattivato"
          description="Riattivalo in Impostazioni → Preferenze per usare tracking e geofence."
          action={
            <Link to="/app/settings" className="lp-btn-secondary inline-flex items-center justify-center">
              Vai a Impostazioni
            </Link>
          }
        />
      ) : (
        <>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Live</CardTitle>
              <CardDescription>Usa i permessi posizione del browser.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {watching ? (
                <button onClick={stopTracking} className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-medium hover:bg-rose-400">
                  Ferma tracking
                </button>
              ) : (
                <button onClick={startTracking} disabled={!activePetId || !gpsAllowed} className="lp-btn-primary">
                  Avvia tracking
                </button>
              )}

              <button onClick={recordOnce} disabled={!activePetId || tracking || !gpsAllowed} className="lp-btn-secondary">
                {tracking ? "Registrazione…" : "Registra punto"}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>

        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare il GPS." />
        ) : latest ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="lp-panel p-3">
              <div className="text-xs text-slate-600">Lat</div>
              <div className="text-sm font-medium">{latest.lat.toFixed(6)}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs text-slate-600">Lng</div>
              <div className="text-sm font-medium">{latest.lng.toFixed(6)}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs text-slate-600">Accuratezza</div>
              <div className="text-sm font-medium">{latest.accuracyM ? `${Math.round(latest.accuracyM)} m` : "—"}</div>
            </div>
            <div className="md:col-span-3">
              <a
                href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latest.lat))}&mlon=${encodeURIComponent(String(latest.lng))}#map=16/${encodeURIComponent(String(latest.lat))}/${encodeURIComponent(String(latest.lng))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn-icon inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Apri su OpenStreetMap
              </a>
            </div>

            {trackSpark ? (
              <div className="md:col-span-3 lp-panel p-3">
                <div className="text-xs text-slate-600">Traccia (ultimi punti)</div>
                <svg width={trackSpark.w} height={trackSpark.h} className="mt-2">
                  <path d={trackSpark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-fuchsia-600" />
                </svg>
              </div>
            ) : null}

            <div className="md:col-span-3 lp-panel p-3">
              <div className="text-xs text-slate-600">Mappa</div>
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-200/70">
                <iframe
                  title="Mappa GPS"
                  className="w-full h-[320px]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={(() => {
                    const d = 0.01;
                    const left = latest.lng - d;
                    const right = latest.lng + d;
                    const top = latest.lat + d;
                    const bottom = latest.lat - d;
                    const bbox = `${left},${bottom},${right},${top}`;
                    const marker = `${latest.lat},${latest.lng}`;
                    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
                  })()}
                />
              </div>
              <div className="mt-2 text-xs text-slate-600">Vista indicativa: usa “Apri su OpenStreetMap” per zoom e dettagli.</div>
            </div>
          </div>
        ) : (
          <EmptyState title="Nessun punto ancora" description="Premi “Registra punto” per salvare la posizione." />
        )}

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zona sicura (geofence)</CardTitle>
          <CardDescription>Centro = ultimo punto registrato.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per configurare la zona sicura." />
        ) : (
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={geofenceEnabled}
                onChange={(e) => setGeofenceEnabled(e.target.checked)}
              />
              Attiva zona sicura
            </label>
            <div className="grid grid-cols-1 md:grid-cols-[220px_140px] gap-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Raggio (metri)</div>
                <input
                  value={radiusM}
                  onChange={(e) => setRadiusM(e.target.value)}
                className="lp-input"
                />
              </label>
              <button
                onClick={saveGeofence}
              className="lp-btn-secondary"
              >
                Salva
              </button>
            </div>
            {geofenceStatus ? (
              <div
                className={
                  geofenceStatus.outside
                    ? "rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                    : "rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-800"
                }
              >
                {geofenceStatus.outside
                  ? `Fuori zona sicura (${Math.round(geofenceStatus.distanceM)} m)`
                  : `Dentro zona sicura (${Math.round(geofenceStatus.distanceM)} m)`}
              </div>
            ) : (
              <div className="text-sm text-slate-400">Attiva la zona e registra un punto per vedere lo stato.</div>
            )}
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Storico</CardTitle>
              <CardDescription>Ultimi punti registrati.</CardDescription>
            </div>
            {activePetId && history.length > 0 ? (
              <button
                onClick={async () => {
                  if (!confirm("Eliminare gli ultimi punti dallo storico?")) return;
                  await clearGpsHistory(activePetId, 50);
                }}
                className="lp-btn-secondary"
              >
                Svuota
              </button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere lo storico." />
        ) : history.length === 0 ? (
          <EmptyState title="Nessuno storico" description="Registra un punto per iniziare." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">Mostrati: {history.length} punti</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setHistoryLimit(20)} className={historyLimit === 20 ? "lp-btn-primary" : "lp-btn-secondary"}>
                  20
                </button>
                <button onClick={() => setHistoryLimit(50)} className={historyLimit === 50 ? "lp-btn-primary" : "lp-btn-secondary"}>
                  50
                </button>
                <button onClick={() => setHistoryLimit(200)} className={historyLimit === 200 ? "lp-btn-primary" : "lp-btn-secondary"}>
                  200
                </button>
              </div>
            </div>
            {history.map((p) => (
              <div key={p.id} className="lp-panel px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-600">{new Date(p.recordedAt).toLocaleString()}</div>
                    {activePetId ? (
                      <button
                        onClick={async () => {
                          await deleteGpsPoint(activePetId, p.id);
                        }}
                        className="lp-btn-icon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-slate-600">Accuratezza: {p.accuracyM ? `${Math.round(p.accuracyM)} m` : "—"}</div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}

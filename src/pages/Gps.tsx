import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createGpsPoint, subscribeGpsHistory, subscribeLatestGpsPoint } from "@/data/gps";
import { updatePet } from "@/data/pets";
import type { GpsPoint } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [geofenceEnabled, setGeofenceEnabled] = useState(activePet?.geofence?.enabled ?? false);
  const [radiusM, setRadiusM] = useState(String(activePet?.geofence?.radiusM ?? 300));

  useEffect(() => {
    setGeofenceEnabled(activePet?.geofence?.enabled ?? false);
    setRadiusM(String(activePet?.geofence?.radiusM ?? 300));
  }, [activePet?.geofence?.enabled, activePet?.geofence?.radiusM]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub1 = subscribeLatestGpsPoint(activePetId, setLatest);
    const unsub2 = subscribeGpsHistory(activePetId, 20, setHistory);
    return () => {
      unsub1();
      unsub2();
    };
  }, [activePetId]);

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

  const geofenceStatus = useMemo(() => {
    if (!activePet?.geofence?.enabled || !latest) return null;
    const c = { lat: activePet.geofence.centerLat, lng: activePet.geofence.centerLng };
    const p = { lat: latest.lat, lng: latest.lng };
    const d = distanceMeters(c, p);
    return { distanceM: d, outside: d > activePet.geofence.radiusM };
  }, [activePet?.geofence?.centerLat, activePet?.geofence?.centerLng, activePet?.geofence?.enabled, activePet?.geofence?.radiusM, latest]);

  return (
    <div className="space-y-6">
      <PageHeader title="GPS" description="Registra punti posizione e configura una zona sicura (geofence)." />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Live</CardTitle>
              <CardDescription>Usa i permessi posizione del browser.</CardDescription>
            </div>
          <button
            onClick={recordOnce}
            disabled={!activePetId || tracking}
            className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
          >
            {tracking ? "Registrazione…" : "Registra punto"}
          </button>
          </div>
        </CardHeader>
        <CardContent>

        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare il GPS." />
        ) : latest ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-500">Lat</div>
              <div className="text-sm font-medium">{latest.lat.toFixed(6)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-500">Lng</div>
              <div className="text-sm font-medium">{latest.lng.toFixed(6)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-500">Accuratezza</div>
              <div className="text-sm font-medium">{latest.accuracyM ? `${Math.round(latest.accuracyM)} m` : "—"}</div>
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
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <button
                onClick={saveGeofence}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm hover:bg-slate-900"
              >
                Salva
              </button>
            </div>
            {geofenceStatus ? (
              <div
                className={
                  geofenceStatus.outside
                    ? "rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                    : "rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
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
          <CardTitle>Storico</CardTitle>
          <CardDescription>Ultimi punti registrati.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere lo storico." />
        ) : history.length === 0 ? (
          <EmptyState title="Nessuno storico" description="Registra un punto per iniziare." />
        ) : (
          <div className="space-y-2">
            {history.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</div>
                  <div className="text-xs text-slate-500">{new Date(p.recordedAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-slate-500">Accuratezza: {p.accuracyM ? `${Math.round(p.accuracyM)} m` : "—"}</div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import {
  clearGpsHistory,
  createGpsDevice,
  createGpsPoint,
  deleteGpsDevice,
  deleteGpsPoint,
  subscribeGpsDevices,
  subscribeGpsHistory,
  subscribeLatestGpsPoint,
  updateGpsDevice,
} from "@/data/gps";
import { updatePet } from "@/data/pets";
import type { GpsDevice, GpsPoint } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExternalLink, KeyRound, Plus, Trash2 } from "lucide-react";
import { subscribeUserProfile } from "@/data/users";
import { Link } from "react-router-dom";
import { useToastStore } from "@/stores/toastStore";
import { deleteField } from "firebase/firestore";
import { WalksSocialMap } from "@/components/WalksSocialMap";
import { useConfirmDialog } from "@/components/confirm";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { randomHexToken, sha256Hex } from "@/lib/crypto";

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
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [latest, setLatest] = useState<GpsPoint | null>(null);
  const [history, setHistory] = useState<GpsPoint[]>([]);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [tracking, setTracking] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAllowed, setGpsAllowed] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tab, setTab] = useState<"device" | "walks">("device");
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");

  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [deviceWizardOpen, setDeviceWizardOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ deviceId: string; name: string; token: string } | null>(null);

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
    if (!latest) {
      setMapStatus("idle");
      return;
    }
    setMapStatus("loading");
    const t = window.setTimeout(() => setMapStatus((s) => (s === "loaded" ? s : "failed")), 9000);
    return () => window.clearTimeout(t);
  }, [latest]);

  useEffect(() => {
    if (!activePetId) {
      setDevices([]);
      setDevicesLoaded(false);
      return;
    }
    setDevicesLoaded(false);
    const unsub = subscribeGpsDevices(
      activePetId,
      (items) => {
        setDevices(items);
        setDevicesLoaded(true);
      },
      () => {
        setDevicesLoaded(true);
      }
    );
    return () => unsub();
  }, [activePetId]);

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
    try {
      await updatePet(activePetId, {
        geofence: {
          enabled: geofenceEnabled,
          centerLat: latest.lat,
          centerLng: latest.lng,
          radiusM: r,
        },
      });
      pushToast({ type: "success", title: "Geofence", message: "Salvata." });
    } catch (e) {
      pushToast({ type: "error", title: "Geofence", message: e instanceof Error ? e.message : "Salvataggio fallito" });
    }
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
      pushToast({ type: "success", title: "GPS", message: "Punto registrato." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile leggere la posizione GPS");
      pushToast({ type: "error", title: "GPS", message: e instanceof Error ? e.message : "Impossibile leggere la posizione GPS" });
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
      (pos) => {
        void (async () => {
          try {
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
          } catch (e) {
            setError(e instanceof Error ? e.message : "Errore salvataggio GPS");
          }
        })();
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

  const ingestEndpoint = useMemo(() => {
    return `https://${(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || "us-central1"}-${import.meta.env.VITE_FIREBASE_PROJECT_ID as string}.cloudfunctions.net/gpsIngestPoint`;
  }, []);

  async function createDevice() {
    if (!user || !activePetId) return;
    const name = deviceName.trim() || "Collare GPS";
    setDeviceBusyId("create");
    try {
      const token = randomHexToken(24);
      const tokenHash = await sha256Hex(token);
      const now = Date.now();
      const deviceId = await createGpsDevice(activePetId, {
        petId: activePetId,
        name,
        kind: "generic_http",
        enabled: true,
        tokenHash,
        tokenPrefix: token.slice(0, 8),
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      });
      setDeviceWizardOpen(false);
      setDeviceName("");
      setTokenInfo({ deviceId, name, token });
      setTokenOpen(true);
      pushToast({ type: "success", title: "Dispositivo GPS", message: "Creato." });
    } catch (e) {
      pushToast({ type: "error", title: "Dispositivo GPS", message: e instanceof Error ? e.message : "Creazione fallita" });
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function rotateDeviceToken(d: GpsDevice) {
    if (!activePetId) return;
    if (!user || user.isDemo) return;
    setDeviceBusyId(d.id);
    try {
      const token = randomHexToken(24);
      const tokenHash = await sha256Hex(token);
      const now = Date.now();
      await updateGpsDevice(activePetId, d.id, { tokenHash, tokenPrefix: token.slice(0, 8), updatedAt: now, enabled: true });
      setTokenInfo({ deviceId: d.id, name: d.name, token });
      setTokenOpen(true);
      pushToast({ type: "success", title: "Token", message: "Rigenerato." });
    } catch (e) {
      pushToast({ type: "error", title: "Token", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function toggleDevice(d: GpsDevice) {
    if (!activePetId) return;
    setDeviceBusyId(d.id);
    try {
      await updateGpsDevice(activePetId, d.id, { enabled: !d.enabled, updatedAt: Date.now() });
    } catch (e) {
      pushToast({ type: "error", title: "Dispositivo", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function removeDevice(d: GpsDevice) {
    if (!activePetId) return;
    const ok = await confirmDialog({
      title: "Rimuovi dispositivo",
      description: `Vuoi rimuovere “${d.name}”? Il token non funzionerà più.`,
      confirmLabel: "Rimuovi",
      variant: "danger",
    });
    if (!ok) return;
    setDeviceBusyId(d.id);
    try {
      await deleteGpsDevice(activePetId, d.id);
      pushToast({ type: "success", title: "Dispositivo", message: "Rimosso." });
    } catch (e) {
      pushToast({ type: "error", title: "Dispositivo", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setDeviceBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GPS"
        description="Tracking, storico e zona sicura (geofence)."
        imagePrompt="minimal clean illustration, map pin with paw icon and route line, airy background, accent color, premium, no text, no watermark"
        imageAlt="GPS"
      />

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

          <Modal open={deviceWizardOpen} title="Collega un collare/dispositivo" description="Crea un token sicuro per un dispositivo GPS che invia via HTTP." onClose={() => setDeviceWizardOpen(false)}>
            <div className="grid gap-3">
              <Alert variant="info" title="Uso legale">
                Usa questa integrazione solo con dispositivi di tua proprietà e con consenso della persona che li gestisce. Non usare per tracciare persone o animali senza autorizzazione.
              </Alert>
              <label className="block">
                <div className="text-xs lp-muted mb-1">Nome dispositivo</div>
                <input className="lp-input" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Es. Tractive (HTTP), Collare GPS…" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="lp-btn-secondary" onClick={() => setDeviceWizardOpen(false)}>
                  Annulla
                </button>
                <button type="button" className="lp-btn-primary" disabled={!activePetId || deviceBusyId === "create"} onClick={() => void createDevice()}>
                  Crea
                </button>
              </div>
            </div>
          </Modal>

          <Modal open={tokenOpen} title="Token dispositivo" description="Copia il token ora: non verrà mostrato di nuovo." onClose={() => {
            setTokenOpen(false);
            setTokenInfo(null);
          }}>
            {tokenInfo && activePetId ? (
              <div className="grid gap-3">
                <Alert variant="warn" title="Token segreto">
                  Chi possiede questo token può inviare posizioni per questo pet. Conservalo in modo sicuro e rigeneralo in caso di sospetto.
                </Alert>
                <div className="lp-panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs lp-muted">Token</div>
                    <button
                      type="button"
                      className="lp-btn-icon"
                      onClick={() => {
                        void navigator.clipboard.writeText(tokenInfo.token);
                        pushToast({ type: "success", title: "Copiato", message: "Token copiato." });
                      }}
                    >
                      Copia
                    </button>
                  </div>
                  <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs break-all">{tokenInfo.token}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-xs lp-muted">Endpoint</div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs break-all">{ingestEndpoint}</div>
                  <div className="text-xs lp-muted">Payload (POST JSON)</div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(
                      {
                        petId: activePetId,
                        deviceId: tokenInfo.deviceId,
                        token: tokenInfo.token,
                        lat: 45.0,
                        lng: 9.0,
                        accuracyM: 15,
                        recordedAt: Date.now(),
                      },
                      null,
                      2
                    )}
                  </div>
                  <div className="text-xs lp-muted">Esempio (curl)</div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs break-words">
                    {`curl -X POST -H "Content-Type: application/json" -d '{"petId":"${activePetId}","deviceId":"${tokenInfo.deviceId}","token":"${tokenInfo.token}","lat":45.0,"lng":9.0,"accuracyM":15,"recordedAt":${Date.now()}}' "${ingestEndpoint}"`}
                  </div>
                </div>
              </div>
            ) : null}
          </Modal>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={tab === "device" ? "lp-btn-primary" : "lp-btn-secondary"}
              onClick={() => setTab("device")}
            >
              Mio tracking
            </button>
            <button
              type="button"
              className={tab === "walks" ? "lp-btn-primary" : "lp-btn-secondary"}
              onClick={() => setTab("walks")}
            >
              Passeggiate
            </button>
          </div>

          {tab === "walks" ? (
            <>
              {!activePetId ? (
                <EmptyState
                  title="Seleziona un pet"
                  description="Serve un pet attivo per andare in passeggiata e comparire sulla mappa."
                  action={
                    <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center justify-center">
                      Vai al profilo pet
                    </Link>
                  }
                />
              ) : (
                <WalksSocialMap />
              )}
            </>
          ) : (
            <>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                  <Card className="relative overflow-hidden">
                    <div className="lp-card-accent" aria-hidden="true" />
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>Live</CardTitle>
                          <CardDescription>Usa i permessi posizione del browser.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {watching ? (
                            <button type="button" onClick={stopTracking} className="lp-btn-primary" style={{ backgroundColor: "rgb(var(--lp-danger))" }}>
                              Ferma tracking
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!gpsAllowed) {
                                  pushToast({ type: "info", title: "GPS", message: "Permesso posizione non concesso. Attivalo nel browser e riprova." });
                                  return;
                                }
                                startTracking();
                              }}
                              className="lp-btn-primary"
                            >
                              Avvia tracking
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (tracking) {
                                pushToast({ type: "info", title: "GPS", message: "Registrazione già in corso." });
                                return;
                              }
                              if (!gpsAllowed) {
                                pushToast({ type: "info", title: "GPS", message: "Permesso posizione non concesso. Attivalo nel browser e riprova." });
                                return;
                              }
                              void recordOnce();
                            }}
                            className="lp-btn-secondary"
                          >
                            {tracking ? "Registrazione…" : "Registra punto"}
                          </button>
                          <div className="lp-mini-ill" aria-hidden="true" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!activePetId ? (
                        <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare il GPS." />
                      ) : latest ? (
                        <div className="mt-1 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latest.lat))}&mlon=${encodeURIComponent(String(latest.lng))}#map=16/${encodeURIComponent(String(latest.lat))}/${encodeURIComponent(String(latest.lng))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lp-btn-icon inline-flex items-center gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Apri su OpenStreetMap
                            </a>
                            {watching ? <span className="lp-badge lp-badge-info">Tracking attivo</span> : <span className="lp-badge">Tracking spento</span>}
                          </div>

                          {trackSpark ? (
                            <div className="lp-panel p-3">
                              <div className="text-xs text-slate-600">Traccia (ultimi punti)</div>
                              <svg width={trackSpark.w} height={trackSpark.h} className="mt-2 max-w-full">
                                <path
                                  d={trackSpark.d}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  style={{ color: "rgb(var(--lp-primary))" }}
                                />
                              </svg>
                            </div>
                          ) : null}

                          <div className="lp-panel p-3">
                            <div className="text-xs text-slate-600">Mappa</div>
                            <div className="mt-2 rounded-xl overflow-hidden border border-slate-200/70">
                              {mapStatus === "failed" ? (
                                <div className="h-[420px] grid place-items-center bg-[rgba(var(--lp-ink),0.04)]">
                                  <div className="max-w-md p-4">
                                    <EmptyState
                                      title="Mappa non disponibile"
                                      description="Su alcune reti/estensioni le tile di OpenStreetMap possono essere bloccate. Apri la mappa in una nuova scheda per zoom e dettagli."
                                      action={
                                        <a
                                          href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latest.lat))}&mlon=${encodeURIComponent(String(latest.lng))}#map=16/${encodeURIComponent(String(latest.lat))}/${encodeURIComponent(String(latest.lng))}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="lp-btn-primary inline-flex items-center gap-2"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          Apri su OpenStreetMap
                                        </a>
                                      }
                                    />
                                  </div>
                                </div>
                              ) : (
                                <iframe
                                  title="Mappa GPS"
                                  className="w-full h-[420px]"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onLoad={() => setMapStatus("loaded")}
                                  onError={() => setMapStatus("failed")}
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
                              )}
                            </div>
                            <div className="mt-2 text-xs text-slate-600">Vista indicativa: usa “Apri su OpenStreetMap” per zoom e dettagli.</div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState title="Nessun punto ancora" description="Premi “Registra punto” per salvare la posizione." />
                      )}

                      {error ? <div className="mt-3"><Alert variant="danger" title="Errore">{error}</Alert></div> : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5 space-y-6">
                  <Card className="relative overflow-hidden">
                    <div className="lp-card-accent" aria-hidden="true" />
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>Integrazione dispositivo</CardTitle>
                          <CardDescription>Collega collari/dispositivi GPS che supportano invio HTTP (webhook/push).</CardDescription>
                        </div>
                        <div className="lp-mini-ill" aria-hidden="true" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!activePetId ? (
                        <EmptyState title="Seleziona un pet" description="Scegli un profilo per configurare l’integrazione GPS." />
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="lp-btn-primary inline-flex items-center gap-2" disabled={!user || user.isDemo} onClick={() => setDeviceWizardOpen(true)}>
                              <Plus className="w-4 h-4" /> Collega dispositivo
                            </button>
                          </div>

                          {!devicesLoaded ? (
                            <div className="text-sm lp-muted">Carico dispositivi…</div>
                          ) : devices.length === 0 ? (
                            <div className="lp-surface p-4">
                              <div className="text-sm font-medium">Nessun dispositivo collegato</div>
                              <div className="mt-1 text-xs lp-muted">Collega un collare GPS che può inviare richieste HTTP (webhook) e usa il token per autenticare l’invio.</div>
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              {devices.map((d) => (
                                <div key={d.id} className="lp-surface p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{d.name}</div>
                                    <div className="text-xs lp-muted">
                                      {d.enabled ? "Attivo" : "Disattivato"} · token {d.tokenPrefix}…
                                      {d.lastSeenAt ? ` · ultimo ping ${new Date(d.lastSeenAt).toLocaleString()}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex-1" />
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <button type="button" className="lp-btn-secondary" disabled={deviceBusyId === d.id || user?.isDemo} onClick={() => void rotateDeviceToken(d)}>
                                      <KeyRound className="w-4 h-4" /> Token
                                    </button>
                                    <button type="button" className="lp-btn-secondary" disabled={deviceBusyId === d.id} onClick={() => void toggleDevice(d)}>
                                      {d.enabled ? "Disattiva" : "Attiva"}
                                    </button>
                                    <button type="button" className="lp-btn-icon" disabled={deviceBusyId === d.id} onClick={() => void removeDevice(d)}>
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={creatingToken || !user || user.isDemo}
                              className="lp-btn-secondary inline-flex items-center gap-2"
                              onClick={async () => {
                                if (!activePetId) return;
                                setCreatingToken(true);
                                try {
                                  const token = randomHexToken(24);
                                  await updatePet(activePetId, { gpsIngestToken: token });
                                  pushToast({ type: "success", title: "Token GPS", message: "Aggiornato." });
                                } catch (e) {
                                  pushToast({ type: "error", title: "Token GPS", message: e instanceof Error ? e.message : "Operazione fallita" });
                                } finally {
                                  setCreatingToken(false);
                                }
                              }}
                            >
                              <KeyRound className="w-4 h-4" />
                              {activePet?.gpsIngestToken ? "Rigenera token legacy" : "Genera token legacy"}
                            </button>

                            {activePet?.gpsIngestToken ? (
                              <button
                                type="button"
                                className="lp-btn-icon"
                                onClick={async () => {
                                  if (!activePetId) return;
                                  const ok = await confirmDialog({
                                    title: "Disattiva GPS",
                                    description: "Vuoi disattivare l’integrazione rimuovendo il token?",
                                    confirmLabel: "Disattiva",
                                    variant: "danger",
                                  });
                                  if (!ok) return;
                                  try {
                                    await updatePet(activePetId, { gpsIngestToken: deleteField() });
                                    pushToast({ type: "success", title: "Token GPS", message: "Rimosso." });
                                  } catch (e) {
                                    pushToast({ type: "error", title: "Token GPS", message: e instanceof Error ? e.message : "Operazione fallita" });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>

                          {activePet?.gpsIngestToken ? (
                            <div className="lp-surface p-4">
                              <div className="text-sm font-medium">Webhook (legacy)</div>
                              <div className="mt-1 text-xs text-slate-600">Conserva il token in modo sicuro: chi lo possiede può inviare posizioni.</div>
                              <div className="mt-3 grid grid-cols-1 gap-2">
                                <div className="text-xs text-slate-600">Endpoint</div>
                                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs break-all">
                                  {ingestEndpoint}
                                </div>
                                <div className="text-xs text-slate-600">Payload (POST JSON)</div>
                                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs whitespace-pre-wrap">
                                  {JSON.stringify(
                                    {
                                      petId: activePetId,
                                      token: activePet.gpsIngestToken,
                                      lat: 45.0,
                                      lng: 9.0,
                                      accuracyM: 15,
                                      recordedAt: Date.now(),
                                    },
                                    null,
                                    2
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600">Token legacy non attivo. Consigliato: collega un dispositivo e usa il token dedicato.</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="lp-card-accent" aria-hidden="true" />
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>Zona sicura (geofence)</CardTitle>
                          <CardDescription>Centro = ultimo punto registrato.</CardDescription>
                        </div>
                        <div className="lp-mini-ill" aria-hidden="true" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!activePetId ? (
                        <EmptyState title="Seleziona un pet" description="Scegli un profilo per configurare la zona sicura." />
                      ) : (
                        <div className="space-y-3">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={geofenceEnabled} onChange={(e) => setGeofenceEnabled(e.target.checked)} />
                            Attiva zona sicura
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-[220px_140px] gap-3">
                            <label className="block">
                              <div className="text-xs text-slate-400 mb-1">Raggio (metri)</div>
                              <input value={radiusM} onChange={(e) => setRadiusM(e.target.value)} className="lp-input" />
                            </label>
                            <button type="button" onClick={saveGeofence} className="lp-btn-secondary">Salva</button>
                          </div>
                          {geofenceStatus ? (
                            <Alert variant={geofenceStatus.outside ? "danger" : "success"} title="Zona sicura">
                              {geofenceStatus.outside
                                ? `Fuori zona sicura (${Math.round(geofenceStatus.distanceM)} m)`
                                : `Dentro zona sicura (${Math.round(geofenceStatus.distanceM)} m)`}
                            </Alert>
                          ) : (
                            <div className="text-sm text-slate-400">Attiva la zona e registra un punto per vedere lo stato.</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="lp-card-accent" aria-hidden="true" />
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>Storico</CardTitle>
                          <CardDescription>Ultimi punti registrati.</CardDescription>
                        </div>
                        <div className="lp-mini-ill" aria-hidden="true" />
                        {activePetId && history.length > 0 ? (
                          <button
                            onClick={async () => {
                              const ok = await confirmDialog({
                                title: "Svuota storico",
                                description: "Vuoi eliminare gli ultimi punti dallo storico?",
                                confirmLabel: "Svuota",
                                variant: "danger",
                              });
                              if (!ok) return;
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
                          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
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
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

            </>
          )}
        </>
      )}
    </div>
  );
}

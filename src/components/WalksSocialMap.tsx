import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Circle } from "react-leaflet";
import L from "leaflet";
import { MessageSquare, MapPin, Play, Square, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import type { Pet, WalkBadge, WalkPresence } from "@/types";
import { badgeLabel, removeWalkPresence, subscribeRecentWalkPresence, upsertWalkPresence } from "@/data/walks";
import { ensureDefaultGroups, joinGroup, sendGroupMessage } from "@/data/groups";
import { createNotification } from "@/data/notifications";
import { subscribePublicProfile, type PublicProfile } from "@/data/users";

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function badgeColor(b: WalkBadge) {
  if (b === "green") return "rgb(var(--lp-accent-2))";
  if (b === "yellow") return "rgb(var(--lp-warn))";
  return "rgb(var(--lp-danger))";
}

function badgeIcon(b: WalkBadge, label: string) {
  const c = badgeColor(b);
  const html = `<div style="width:28px;height:28px;border-radius:9999px;background:${c};border:2px solid rgba(255,255,255,0.95);box-shadow:0 10px 24px rgba(15,23,42,0.20);display:flex;align-items:center;justify-content:center;color:#0b1220;font-weight:700;font-size:12px;">${label}</div>`;
  return L.divIcon({ className: "", html, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

function deriveBadge(pet: Pet): WalkBadge {
  const v = pet.walkBadge;
  if (v === "green" || v === "yellow" || v === "red") return v;
  const tags = (pet.temperamentTags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => /aggress|morde|reattiv|pericol/i.test(t))) return "red";
  if (tags.some((t) => /timid|ansios|paur|diffident/i.test(t))) return "yellow";
  return "green";
}

function parseBadgeFilter(v: string): "all" | WalkBadge {
  if (v === "green" || v === "yellow" || v === "red") return v;
  return "all";
}

const FALLBACK_CENTER = { lat: 41.9028, lng: 12.4964 };

export function WalksSocialMap() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();

  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [walking, setWalking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [radiusKm, setRadiusKm] = useState("2");
  const [badgeFilter, setBadgeFilter] = useState<"all" | WalkBadge>("all");
  const [items, setItems] = useState<WalkPresence[]>([]);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<WalkPresence | null>(null);
  const [contactText, setContactText] = useState("");
  const [contactProfile, setContactProfile] = useState<PublicProfile | null>(null);
  const [sending, setSending] = useState(false);

  const radiusM = useMemo(() => {
    const r = Number(radiusKm);
    if (!Number.isFinite(r) || r <= 0) return 2000;
    return Math.min(10_000, Math.max(200, Math.round(r * 1000)));
  }, [radiusKm]);

  useEffect(() => {
    const since = Date.now() - 8 * 60 * 1000;
    const unsub = subscribeRecentWalkPresence(since, setItems);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!contactTarget?.ownerId) {
      setContactProfile(null);
      return;
    }
    const unsub = subscribePublicProfile(contactTarget.ownerId, setContactProfile);
    return () => unsub();
  }, [contactTarget?.ownerId]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCenter(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30_000 }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (pet?.id) void removeWalkPresence(pet.id);
    };
  }, [pet?.id]);

  const visible = useMemo(() => {
    const c = center ?? FALLBACK_CENTER;
    return items
      .filter((p) => p.updatedAt >= Date.now() - 10 * 60 * 1000)
      .filter((p) => (badgeFilter === "all" ? true : p.badge === badgeFilter))
      .map((p) => ({ p, distM: distanceMeters(c, { lat: p.lat, lng: p.lng }) }))
      .filter((x) => x.distM <= radiusM)
      .sort((a, b) => a.distM - b.distM);
  }, [badgeFilter, center, items, radiusM]);

  function distLabel(distM: number) {
    if (!Number.isFinite(distM)) return "—";
    if (distM < 1000) return `${Math.round(distM)} m`;
    return `${(distM / 1000).toFixed(1)} km`;
  }

  function openContact(p: WalkPresence, distM: number) {
    if (!user) {
      pushToast({ type: "error", title: "Community", message: "Devi effettuare l’accesso." });
      return;
    }
    const who = p.ownerId.slice(0, 6);
    const msg =
      `Ciao ${who}! Ho visto ${p.petName} in passeggiata (${badgeLabel(p.badge)}). ` +
      `Io sono a circa ${distLabel(distM)} da te. Ti va una passeggiata insieme?`;
    setContactTarget(p);
    setContactText(msg);
    setContactOpen(true);
  }

  async function sendContact() {
    if (!user || !pet || !contactTarget) return;
    if (contactTarget.ownerId === user.uid) {
      pushToast({ type: "error", title: "Community", message: "Non puoi contattare te stesso." });
      return;
    }
    const t = contactText.trim();
    if (!t) return;
    setSending(true);
    try {
      await ensureDefaultGroups();
      await joinGroup("walks", user.uid);
      const handle = contactProfile?.handle?.trim();
      const displayName = contactProfile?.displayName?.trim();
      const to = handle || displayName || contactTarget.ownerId.slice(0, 6);
      const now = Date.now();
      const text = `${t}\n\nPer: ${to} · Pet: ${contactTarget.petName} · Bollino: ${badgeLabel(contactTarget.badge)}`;
      await sendGroupMessage("walks", { groupId: "walks", authorId: user.uid, createdAt: now, text });
      await createNotification(pet.id, {
        petId: pet.id,
        createdBy: user.uid,
        type: "walk_request_sent",
        title: "Passeggiata",
        body: `Richiesta inviata a ${contactTarget.petName} (${to}).`,
        severity: "info",
        createdAt: now,
        read: false,
      });
      pushToast({ type: "success", title: "Community", message: "Richiesta inviata nel gruppo Passeggiate." });
      setContactOpen(false);
      setContactTarget(null);
      navigate("/app/community?tab=groups&groupId=walks");
    } catch (e) {
      pushToast({ type: "error", title: "Community", message: e instanceof Error ? e.message : "Invio fallito" });
    } finally {
      setSending(false);
    }
  }

  async function start() {
    if (!user || !pet) return;
    if (!navigator.geolocation) {
      pushToast({ type: "error", title: "GPS", message: "Geolocalizzazione non supportata." });
      return;
    }
    if (pet.walkVisible === false) {
      pushToast({ type: "error", title: "Passeggiata", message: "Attiva “Visibile in mappa” nel profilo pet." });
      return;
    }
    setBusy(true);
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          const payload: WalkPresence = {
            petId: pet.id,
            ownerId: pet.ownerId,
            petName: pet.name,
            species: pet.species,
            badge: deriveBadge(pet),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            updatedAt: now,
          };
          setCenter({ lat: payload.lat, lng: payload.lng });
          void upsertWalkPresence(payload);
        },
        (e) => {
          pushToast({ type: "error", title: "Passeggiata", message: e.message || "Impossibile leggere la posizione" });
          setWalking(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
      watchIdRef.current = id;
      setWalking(true);
      pushToast({ type: "success", title: "Passeggiata", message: "Visibile in mappa." });
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pet?.id) await removeWalkPresence(pet.id);
    setWalking(false);
    pushToast({ type: "success", title: "Passeggiata", message: "Passeggiata terminata." });
  }

  const mapCenter = center ?? FALLBACK_CENTER;

  return (
    <div className="space-y-4">
      <div className="lp-surface p-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold inline-flex items-center gap-2">
              <Users className="w-4 h-4 lp-icon-primary" />
              Mappa passeggiate
            </div>
            <div className="text-xs text-slate-600 mt-1">Vedi chi è in passeggiata vicino a te e filtra per temperamento.</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Raggio (km)</div>
              <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} inputMode="decimal" className="lp-input" />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Bollino</div>
              <select value={badgeFilter} onChange={(e) => setBadgeFilter(parseBadgeFilter(e.target.value))} className="lp-select">
                <option value="all">Tutti</option>
                <option value="green">Verde</option>
                <option value="yellow">Giallo</option>
                <option value="red">Rosso</option>
              </select>
            </label>

            {!walking ? (
              <button type="button" className="lp-btn-primary inline-flex items-center gap-2" disabled={busy || !user || !pet} onClick={() => void start()}>
                <Play className="w-4 h-4" />
                Inizia passeggiata
              </button>
            ) : (
              <button type="button" className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-medium hover:bg-rose-400 inline-flex items-center gap-2" onClick={() => void stop()}>
                <Square className="w-4 h-4" />
                Termina
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 lp-surface overflow-hidden">
          <div className="h-[420px]">
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={14} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={[mapCenter.lat, mapCenter.lng]}
                radius={radiusM}
                pathOptions={{
                  color: "rgb(var(--lp-primary))",
                  fillColor: "rgb(var(--lp-primary))",
                  fillOpacity: 0.08,
                }}
              />
              {visible.map(({ p }) => (
                <Marker key={p.petId} position={[p.lat, p.lng]} icon={badgeIcon(p.badge, p.petName.slice(0, 1).toUpperCase())}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{p.petName}</div>
                      <div className="text-xs text-slate-700">{p.species}</div>
                      <div className="text-xs text-slate-700">Bollino: {badgeLabel(p.badge)}</div>
                      <div className="text-xs text-slate-500">Aggiornato: {new Date(p.updatedAt).toLocaleTimeString()}</div>
                      <div className="pt-2">
                        <button
                          type="button"
                          className="lp-btn-secondary inline-flex items-center gap-2"
                          onClick={() => {
                            const d = distanceMeters(center ?? FALLBACK_CENTER, { lat: p.lat, lng: p.lng });
                            openContact(p, d);
                          }}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Contatta
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {center ? (
                <Marker position={[center.lat, center.lng]} icon={badgeIcon("green", "•")}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">La tua posizione</div>
                      <div className="text-xs text-slate-600">Usata per filtrare e centratura.</div>
                    </div>
                  </Popup>
                </Marker>
              ) : null}
            </MapContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-3">
          <div className="lp-surface p-4">
            <div className="text-sm font-semibold inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 lp-icon-primary" />
              Vicino a te
            </div>
            <div className="text-xs text-slate-600 mt-1">Seleziona un marker per dettagli. La lista è ordinata per distanza.</div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-700">Nessun pet in passeggiata nel raggio selezionato.</div>
          ) : (
            <div className="space-y-2">
              {visible.slice(0, 12).map(({ p, distM }) => (
                <div key={p.petId} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{p.petName}</div>
                      <div className="text-xs text-slate-600">
                        {badgeLabel(p.badge)} · {distLabel(distM)}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full" style={{ background: badgeColor(p.badge) }} />
                  </div>
                  <div className="mt-2">
                    <button type="button" className="lp-btn-secondary inline-flex items-center gap-2" onClick={() => openContact(p, distM)}>
                      <MessageSquare className="w-4 h-4" />
                      Contatta per passeggiata
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {contactOpen && contactTarget ? (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setContactOpen(false)} />
          <div className="absolute right-3 left-3 bottom-3 lg:right-6 lg:left-auto lg:bottom-6 lg:w-[520px]">
            <div className="rounded-2xl border border-slate-200/70 bg-white/95 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70">
                <div>
                  <div className="text-sm font-semibold">Contatta per passeggiata</div>
                  <div className="text-xs text-slate-600">Destinatario: {contactTarget.petName}</div>
                </div>
                <button type="button" className="p-2 rounded-xl hover:bg-slate-100" onClick={() => setContactOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="text-xs text-slate-600">Bollino</div>
                  <div className="text-sm font-semibold">{badgeLabel(contactTarget.badge)}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-600 mb-1">Messaggio (verrà inviato nel gruppo “Passeggiate”)</div>
                  <textarea value={contactText} onChange={(e) => setContactText(e.target.value)} rows={4} className="lp-textarea" />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" className="lp-btn-primary inline-flex items-center gap-2" disabled={sending} onClick={() => void sendContact()}>
                    <MessageSquare className="w-4 h-4" />
                    {sending ? "Invio…" : "Invia"}
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={() => setContactOpen(false)} disabled={sending}>
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

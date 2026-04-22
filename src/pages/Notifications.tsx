import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ListPlus, NotebookPen, ShieldAlert, Sparkles } from "lucide-react";
import { usePetStore } from "@/stores/petStore";
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from "@/data/notifications";
import { useAuthStore } from "@/stores/authStore";
import type { NotificationSeverity, PetNotification } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { createTask } from "@/data/tasks";
import { createHealthEvent } from "@/data/health";
import { useToastStore } from "@/stores/toastStore";
import { seedStarterKit } from "@/lib/starterKit";
import { setTaskDone, subscribeDueTasks, updateTask } from "@/data/tasks";
import { subscribeFinderReports } from "@/data/finderReports";
import type { FinderReport } from "@/types";
import { setFinderReportStatus } from "@/data/finderReportsActions";

function targetForType(type: string) {
  if (type.startsWith("agenda_due")) return "/app/agenda";
  if (type.startsWith("task_due")) return "/app/planner";
  if (type.startsWith("booking_")) return "/app/bookings";
  if (type.startsWith("gps_")) return "/app/gps";
  if (type.startsWith("health_")) return "/app/health";
  if (type.startsWith("vaccine_")) return "/app/vaccines";
  if (type.startsWith("med_")) return "/app/medications";
  if (type.startsWith("expense_")) return "/app/expenses";
  return "/app/dashboard";
}

function dayKey(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayTitle(k: string) {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
  if (k === today) return "Oggi";
  if (k === yesterday) return "Ieri";
  const d = new Date(`${k}T00:00:00`);
  return d.toLocaleDateString();
}

export default function Notifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    const petId = new URLSearchParams(location.search).get("petId");
    if (!petId) return;
    if (petId === activePetId) return;
    setActivePetId(petId);
  }, [activePetId, location.search, setActivePetId]);

  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sev, setSev] = useState<Record<NotificationSeverity, boolean>>({ info: true, warning: true, danger: true });
  const [items, setItems] = useState<PetNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingForId, setCreatingForId] = useState<string | null>(null);
  const [savingForId, setSavingForId] = useState<string | null>(null);
  const [seedingStarter, setSeedingStarter] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dueTasks, setDueTasks] = useState<import("@/types").PetTask[]>([]);
  const [finderReports, setFinderReports] = useState<FinderReport[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activePetId || !user) {
      setDueTasks([]);
      return;
    }
    const unsub = subscribeDueTasks(activePetId, user.uid, nowMs, (tasks) => setDueTasks(tasks));
    return () => unsub();
  }, [activePetId, nowMs, user]);

  useEffect(() => {
    if (!activePetId || !user) {
      setFinderReports([]);
      return;
    }
    const unsub = subscribeFinderReports(activePetId, (items) => setFinderReports(items));
    return () => unsub();
  }, [activePetId, user]);

  async function onSeedStarter() {
    if (!user || !activePetId) return;
    if (seedingStarter) return;
    setSeedingStarter(true);
    try {
      const res = await seedStarterKit(activePetId, user.uid);
      pushToast({
        type: res === "already" ? "info" : "success",
        title: "Setup rapido",
        message: res === "already" ? "Già applicato per questo pet." : "Creati dati iniziali e notifiche di esempio.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "Setup rapido", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setSeedingStarter(false);
    }
  }

  const severities = useMemo(() => (Object.entries(sev).filter(([, v]) => v).map(([k]) => k) as NotificationSeverity[]), [sev]);

  const grouped = useMemo(() => {
    const map = new Map<string, PetNotification[]>();
    for (const n of items) {
      const k = dayKey(n.createdAt);
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);

  useEffect(() => {
    if (!activePetId || !user) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const unsub = subscribeNotifications(
        activePetId,
        user.uid,
        {
          limitCount: 200,
          onlyUnread,
          severities: severities.length === 3 ? undefined : severities,
        },
        (next) => {
          setItems(next);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Caricamento fallito");
      return;
    }
  }, [activePetId, onlyUnread, severities, user]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifiche"
        description="Centro notifiche con filtri e stato letto."
        imagePrompt="minimal clean illustration, notification bell with paw icon and small filter chips, airy background, accent color, premium, no text, no watermark"
        imageAlt="Notifiche"
        actions={
          activePetId ? (
            <>
              <button
                type="button"
                className="lp-btn-secondary inline-flex items-center gap-2"
                onClick={() => {
                  const unread = items.filter((n) => !n.read);
                  const top = unread.slice(0, 12);
                  openWithDraft(
                    `Ho ${unread.length} notifiche non lette. Riassumile per priorità (critiche/attenzione/info) e dimmi i prossimi passi. Poi proponi 3 task nel planner. Notifiche: ${top
                      .map((n) => `${n.severity.toUpperCase()}: ${n.title}`)
                      .join(" | ")}.`
                  );
                }}
                disabled={!items.length}
              >
                <Sparkles className="w-4 h-4" />
                AI riepilogo
              </button>
              {items.some((n) => !n.read) ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ids = items.filter((n) => !n.read).map((n) => n.id);
                    await markAllNotificationsRead(activePetId, ids);
                    pushToast({ type: "success", title: "Notifiche", message: "Tutte segnate come lette." });
                  }}
                  className="lp-btn-secondary inline-flex items-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  Segna tutto letto
                </button>
              ) : null}
            </>
          ) : null
        }
      />

      {!activePetId ? (
        <EmptyState
          icon={Bell}
          title="Seleziona un pet"
          description="Scegli un profilo per vedere notifiche, promemoria e segnalazioni." 
          action={
            <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/pets")}>Apri profilo pet</button>
          }
        />
      ) : (
        <div className="space-y-4">
          {finderReports.length ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold">Segnalazioni smarrimento</div>
                    <div className="text-xs lp-muted">Avvistamenti e ritrovamenti arrivati dalla scheda pubblica.</div>
                  </div>
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/pets")}>Apri Pet Protetto</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {finderReports.slice(0, 5).map((r) => (
                    <div key={r.id} className="lp-panel p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {r.reportType === "found" ? "Ho trovato" : "Ho avvistato"} · {new Date(r.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "rgba(var(--lp-ink),0.12)", backgroundColor: "rgba(var(--lp-surface),0.65)", color: "rgb(var(--lp-ink))" }}>
                              {(r.status || "new") === "new" ? "Nuova" : (r.status || "new") === "verified" ? "Verificata" : (r.status || "new") === "spam" ? "Spam" : "Risolta"}
                            </span>
                          </div>
                          <div className="text-xs lp-muted mt-1">
                            {r.locationTextOptional ? `Dove: ${r.locationTextOptional}` : "Dove: —"}
                          </div>
                          {r.noteOptional ? <div className="text-xs text-slate-700 mt-2">{r.noteOptional}</div> : null}
                          {r.reporterContactOptional ? <div className="text-xs text-slate-700 mt-1">Contatto: {r.reporterContactOptional}</div> : null}

                          {(r.status || "new") !== "spam" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(r.status || "new") === "new" ? (
                                <>
                                  <button
                                    type="button"
                                    className="lp-btn-secondary"
                                    onClick={async () => {
                                      if (!activePetId) return;
                                      await setFinderReportStatus(activePetId, r.id, "verified");
                                      pushToast({ type: "success", title: "Segnalazione", message: "Segnata come attendibile." });
                                    }}
                                  >
                                    Segna attendibile
                                  </button>
                                  <button
                                    type="button"
                                    className="lp-btn-secondary"
                                    onClick={async () => {
                                      if (!activePetId) return;
                                      await setFinderReportStatus(activePetId, r.id, "spam");
                                      pushToast({ type: "info", title: "Segnalazione", message: "Segnata come spam." });
                                    }}
                                  >
                                    Segna spam
                                  </button>
                                </>
                              ) : null}

                              {(r.status || "new") === "verified" ? (
                                <button
                                  type="button"
                                  className="lp-btn-secondary"
                                  onClick={async () => {
                                    if (!activePetId) return;
                                    await setFinderReportStatus(activePetId, r.id, "resolved");
                                    pushToast({ type: "success", title: "Segnalazione", message: "Segnata come risolta." });
                                  }}
                                >
                                  Risolta
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0">
                          <button type="button" className="lp-btn-icon" onClick={() => navigate(`/p/${encodeURIComponent(r.publicId)}`)}>
                            Apri
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {dueTasks.length ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Promemoria urgenti</div>
                    <div className="text-xs lp-muted">Azioni rapide: apri, posticipa o segna come fatto.</div>
                  </div>
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}
                  >
                    Apri Planner
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  {dueTasks.slice(0, 6).map((t) => (
                    <div key={t.id} className="lp-panel p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{t.title}</div>
                          <div className="text-xs lp-muted mt-1">
                            Scadenza: {t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-wrap items-center gap-2 justify-end">
                          <button
                            type="button"
                            className="lp-btn-icon"
                            onClick={async () => {
                              if (!activePetId) return;
                              try {
                                await updateTask(activePetId, t.id, { dueAt: nowMs + 60 * 60 * 1000 });
                                pushToast({ type: "success", title: "Promemoria", message: "Posticipato di 1 ora." });
                              } catch (e) {
                                pushToast({ type: "error", title: "Promemoria", message: e instanceof Error ? e.message : "Posticipo fallito" });
                              }
                            }}
                          >
                            +1h
                          </button>
                          <button
                            type="button"
                            className="lp-btn-icon"
                            onClick={async () => {
                              if (!activePetId) return;
                              try {
                                await updateTask(activePetId, t.id, { dueAt: nowMs + 24 * 60 * 60 * 1000 });
                                pushToast({ type: "success", title: "Promemoria", message: "Posticipato a domani." });
                              } catch (e) {
                                pushToast({ type: "error", title: "Promemoria", message: e instanceof Error ? e.message : "Posticipo fallito" });
                              }
                            }}
                          >
                            Domani
                          </button>
                          <button
                            type="button"
                            className="lp-btn-icon"
                            onClick={async () => {
                              if (!activePetId) return;
                              try {
                                await setTaskDone(activePetId, t.id, true);
                                pushToast({ type: "success", title: "Promemoria", message: "Segnato come fatto." });
                              } catch (e) {
                                pushToast({ type: "error", title: "Promemoria", message: e instanceof Error ? e.message : "Operazione fallita" });
                              }
                            }}
                          >
                            Fatto
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="text-xs lp-muted">Preset:</div>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={!user || !activePetId}
                    onClick={async () => {
                      if (!user || !activePetId) return;
                      await createTask(activePetId, {
                        petId: activePetId,
                        title: "Vaccino (preset)",
                        dueAt: nowMs + 7 * 24 * 60 * 60 * 1000,
                        status: "due",
                        createdAt: Date.now(),
                        createdBy: user.uid,
                      });
                      pushToast({ type: "success", title: "Preset", message: "Promemoria vaccino creato." });
                    }}
                  >
                    Vaccino
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={!user || !activePetId}
                    onClick={async () => {
                      if (!user || !activePetId) return;
                      await createTask(activePetId, {
                        petId: activePetId,
                        title: "Visita veterinaria (preset)",
                        dueAt: nowMs + 14 * 24 * 60 * 60 * 1000,
                        status: "due",
                        createdAt: Date.now(),
                        createdBy: user.uid,
                      });
                      pushToast({ type: "success", title: "Preset", message: "Promemoria visita creato." });
                    }}
                  >
                    Visita
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={!user || !activePetId}
                    onClick={async () => {
                      if (!user || !activePetId) return;
                      await createTask(activePetId, {
                        petId: activePetId,
                        title: "Antiparassitario (preset)",
                        dueAt: nowMs + 30 * 24 * 60 * 60 * 1000,
                        status: "due",
                        createdAt: Date.now(),
                        createdBy: user.uid,
                      });
                      pushToast({ type: "success", title: "Preset", message: "Promemoria antiparassitario creato." });
                    }}
                  >
                    Antiparassitario
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-4">
            {error ? <Alert variant="danger" title="Errore">{error}</Alert> : null}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyUnread((v) => !v)}
                  className={
                    onlyUnread ? "lp-chip lp-chip-active" : "lp-chip"
                  }
                >
                  Solo non lette
                </button>
                <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  Totali: {items.length} · Non lette: {items.filter((n) => !n.read).length}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["info", "Info"],
                    ["warning", "Attenzione"],
                    ["danger", "Critiche"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSev((s) => ({ ...s, [k]: !s[k] }))}
                    className={
                      sev[k] ? "lp-chip lp-chip-active" : "lp-chip"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

              <div className="mt-4 space-y-2">
              {loading ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  title="Nessuna notifica"
                  description="Quando arriva qualcosa, la trovi qui."
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}
                      >
                        Apri Planner
                      </button>
                      {user ? (
                        <button type="button" className="lp-btn-primary" onClick={() => void onSeedStarter()} disabled={seedingStarter}>
                          {seedingStarter ? "Creo…" : "Setup rapido"}
                        </button>
                      ) : null}
                    </div>
                  }
                />
              ) : (
                grouped.map(([k, list]) => (
                  <div key={k} className="space-y-2">
                    <div className="text-xs font-semibold" style={{ color: "rgb(var(--lp-muted))" }}>{dayTitle(k)}</div>
                    {list.map((n) => (
                      <div key={n.id} className={n.read ? "lp-panel px-3 py-2 opacity-85" : "lp-panel px-3 py-2"}>
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 text-left flex-1"
                            onClick={async () => {
                              if (!activePetId) return;
                              if (!n.read) await markNotificationRead(activePetId, n.id);
                              navigate(targetForType(n.type));
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {n.severity === "danger" ? (
                                <ShieldAlert className="w-4 h-4" style={{ color: "rgb(var(--lp-danger))" }} />
                              ) : (
                                <Bell className="w-4 h-4" style={{ color: "rgb(var(--lp-primary-700))" }} />
                              )}
                              <div className="text-sm font-semibold truncate">{n.title}</div>
                              {!n.read ? (
                                <span
                                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ borderColor: "rgba(var(--lp-primary),0.20)", backgroundColor: "rgba(var(--lp-primary),0.10)", color: "rgb(var(--lp-primary-700))" }}
                                >
                                  NUOVA
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{n.body}</div>
                            <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </button>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <span
                              className={`lp-badge ${n.severity === "danger" ? "lp-badge-danger" : n.severity === "warning" ? "lp-badge-warn" : "lp-badge-info"}`}
                            >
                              {n.severity}
                            </span>
                            {!n.read ? (
                              <button
                                type="button"
                                className="lp-btn-icon"
                                disabled={!activePetId}
                                onClick={async () => {
                                  if (!activePetId) return;
                                  await markNotificationRead(activePetId, n.id);
                                  pushToast({ type: "success", title: "Notifiche", message: "Segnata come letta." });
                                }}
                              >
                                Letta
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className="lp-btn-icon inline-flex items-center gap-2"
                        disabled={!user || !activePetId || creatingForId === n.id}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          setCreatingForId(n.id);
                          try {
                            if (!n.read) await markNotificationRead(activePetId, n.id);
                            await createTask(activePetId, {
                              petId: activePetId,
                              title: n.title,
                              status: "due",
                              createdAt: Date.now(),
                              createdBy: user.uid,
                            });
                            pushToast({ type: "success", title: "Task creato", message: "Aggiunto al planner." });
                          } catch (err) {
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione task fallita" });
                          } finally {
                            setCreatingForId(null);
                          }
                        }}
                      >
                        <ListPlus className="w-4 h-4" />
                        Task
                      </button>
                      <button
                        type="button"
                        className="lp-btn-icon inline-flex items-center gap-2"
                        disabled={!user || !activePetId || savingForId === n.id}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          setSavingForId(n.id);
                          try {
                            if (!n.read) await markNotificationRead(activePetId, n.id);
                            await createHealthEvent(activePetId, {
                              petId: activePetId,
                              type: "note",
                              title: `Notifica · ${n.title}`,
                              note: n.body || undefined,
                              occurredAt: n.createdAt,
                              createdAt: Date.now(),
                              createdBy: user.uid,
                            });
                            pushToast({ type: "success", title: "Salvato", message: "Aggiunto in cartella clinica." });
                          } catch (err) {
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
                          } finally {
                            setSavingForId(null);
                          }
                        }}
                      >
                        <NotebookPen className="w-4 h-4" />
                        Salva
                      </button>
                      <button
                        type="button"
                        className="lp-btn-icon inline-flex items-center gap-2"
                        onClick={() => {
                          openWithDraft(
                            `Analizza questa notifica e dimmi cosa fare: ${n.severity.toUpperCase()} ${n.title}. Dettagli: ${n.body}. Proponi anche task concreti.`
                          );
                        }}
                        disabled={!activePetId}
                      >
                        <Sparkles className="w-4 h-4" />
                        Analizza
                      </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ShieldAlert } from "lucide-react";
import { usePetStore } from "@/stores/petStore";
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from "@/data/notifications";
import type { NotificationSeverity, PetNotification } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function severityChip(sev: NotificationSeverity) {
  if (sev === "danger") return "border-rose-500/30 bg-rose-500/10 text-rose-900";
  if (sev === "warning") return "border-amber-400/30 bg-amber-400/10 text-amber-900";
  return "border-sky-400/30 bg-sky-400/10 text-sky-900";
}

function targetForType(type: string) {
  if (type.startsWith("agenda_due")) return "/app/agenda";
  if (type.startsWith("task_due")) return "/app/planner";
  if (type.startsWith("booking_")) return "/app/bookings";
  if (type.startsWith("gps_")) return "/app/gps";
  if (type.startsWith("health_")) return "/app/health";
  return "/app/dashboard";
}

export default function Notifications() {
  const navigate = useNavigate();
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sev, setSev] = useState<Record<NotificationSeverity, boolean>>({ info: true, warning: true, danger: true });
  const [items, setItems] = useState<PetNotification[]>([]);

  const severities = useMemo(() => (Object.entries(sev).filter(([, v]) => v).map(([k]) => k) as NotificationSeverity[]), [sev]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeNotifications(
      activePetId,
      {
        limitCount: 200,
        onlyUnread,
        severities: severities.length === 3 ? undefined : severities,
      },
      setItems
    );
    return () => unsub();
  }, [activePetId, onlyUnread, severities]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifiche"
        description="Centro notifiche con filtri e stato letto."
        actions={
          activePetId && items.some((n) => !n.read) ? (
            <button
              onClick={async () => {
                const ids = items.filter((n) => !n.read).map((n) => n.id);
                await markAllNotificationsRead(activePetId, ids);
              }}
              className="lp-btn-secondary inline-flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Segna tutto letto
            </button>
          ) : null
        }
      />

      {!activePetId || !activePet ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le notifiche." />
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyUnread((v) => !v)}
                  className={
                    onlyUnread
                      ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-sm text-fuchsia-800"
                      : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm text-slate-700 hover:bg-white"
                  }
                >
                  Solo non lette
                </button>
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
                      sev[k]
                        ? `rounded-xl border px-3 py-2 text-sm ${severityChip(k)}`
                        : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm text-slate-700 hover:bg-white"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {items.length === 0 ? (
                <EmptyState title="Nessuna notifica" description="Quando arriva qualcosa, la trovi qui." />
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) await markNotificationRead(activePetId, n.id);
                      navigate(targetForType(n.type));
                    }}
                    className={
                      n.read
                        ? "w-full text-left lp-panel px-3 py-2 opacity-80"
                        : "w-full text-left lp-panel px-3 py-2"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {n.severity === "danger" ? (
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                          ) : (
                            <Bell className="w-4 h-4 text-fuchsia-700" />
                          )}
                          <div className="text-sm font-semibold truncate">{n.title}</div>
                          {!n.read ? (
                            <span className="inline-flex items-center rounded-full border border-fuchsia-600/20 bg-fuchsia-600/10 px-2 py-0.5 text-[10px] text-fuchsia-800">
                              NUOVA
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{n.body}</div>
                        <div className="mt-1 text-xs text-slate-600">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>

                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${severityChip(n.severity)}`}>
                        {n.severity}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

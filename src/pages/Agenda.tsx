import { useEffect, useMemo, useState } from "react";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createAgendaEvent, createAgendaSeries, deleteAgendaEvent, seedUpcomingAgendaFromSeries, subscribeAgendaRange, updateAgendaEvent } from "@/data/agenda";
import type { AgendaEvent, AgendaSeries } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function icsDate(ms: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function icsEscape(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Agenda() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const [events, setEvents] = useState<AgendaEvent[]>([]);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [kind, setKind] = useState<AgendaEvent["kind"]>("vet");
  const [reminder, setReminder] = useState("60");
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "weekly">("none");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editKind, setEditKind] = useState<AgendaEvent["kind"]>("vet");
  const [editReminder, setEditReminder] = useState("60");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, []);

  function parseRecurrenceType(v: string): "none" | "daily" | "weekly" {
    if (v === "daily" || v === "weekly") return v;
    return "none";
  }

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeAgendaRange(activePetId, range.fromMs, range.toMs, setEvents);
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const t = title.trim();
    if (!t) {
      pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per l’evento." });
      return;
    }
    const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
    if (!Number.isFinite(dueMs)) {
      pushToast({ type: "error", title: "Data non valida", message: "Controlla data e ora dell’evento." });
      return;
    }
    setSaving(true);
    try {
      const reminderMinutesBefore = Math.max(0, Number(reminder) || 0);
      if (recurrenceType === "none") {
        await createAgendaEvent(activePetId, {
          petId: activePetId,
          title: t,
          dueAt: dueMs,
          kind,
          reminderMinutesBefore,
          createdAt: Date.now(),
          createdBy: user.uid,
        });
        pushToast({ type: "success", title: "Evento creato", message: "Aggiunto all’agenda." });
      } else {
        const d = new Date(dueMs);
        const timeOfDay = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const seriesInput: Omit<AgendaSeries, "id"> = {
          petId: activePetId,
          title: t,
          kind,
          enabled: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          startAt: dueMs,
          timeOfDay,
          recurrence:
            recurrenceType === "weekly"
              ? { type: "weekly", weekdays: weekdays.length ? weekdays : [d.getDay()] }
              : { type: "daily" },
          reminderMinutesBefore,
          createdAt: Date.now(),
          createdBy: user.uid,
        };
        const seriesId = await createAgendaSeries(activePetId, seriesInput);
        await seedUpcomingAgendaFromSeries(activePetId, { id: seriesId, ...seriesInput }, 30);
        pushToast({ type: "success", title: "Routine agenda creata", message: "Eventi generati per i prossimi giorni." });
      }
      setTitle("");
      setDueAt("");
      setKind("vet");
      setReminder("60");
      setRecurrenceType("none");
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Operazione fallita" });
    } finally {
      setSaving(false);
    }
  }

  const weekdayOptions = useMemo(
    () =>
      [
        { i: 1, label: "Lun" },
        { i: 2, label: "Mar" },
        { i: 3, label: "Mer" },
        { i: 4, label: "Gio" },
        { i: 5, label: "Ven" },
        { i: 6, label: "Sab" },
        { i: 0, label: "Dom" },
      ] as const,
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Appuntamenti, promemoria e cura quotidiana, tutti in un posto."
        actions={
          activePetId && events.length ? (
            <button
              type="button"
              className="lp-btn-secondary"
              onClick={() => {
                const now = Date.now();
                const lines: string[] = [];
                lines.push("BEGIN:VCALENDAR");
                lines.push("VERSION:2.0");
                lines.push("PRODID:-//LifePet//Agenda//IT");
                lines.push("CALSCALE:GREGORIAN");

                for (const e of events) {
                  const uid = `${activePetId}-${e.id}@lifepet`;
                  lines.push("BEGIN:VEVENT");
                  lines.push(`UID:${icsEscape(uid)}`);
                  lines.push(`DTSTAMP:${icsDate(now)}`);
                  lines.push(`DTSTART:${icsDate(e.dueAt)}`);
                  lines.push(`SUMMARY:${icsEscape(e.title)}`);
                  lines.push(`DESCRIPTION:${icsEscape(`Tipo: ${e.kind}`)}`);
                  if (e.reminderMinutesBefore && e.reminderMinutesBefore > 0) {
                    lines.push("BEGIN:VALARM");
                    lines.push("ACTION:DISPLAY");
                    lines.push(`DESCRIPTION:${icsEscape(e.title)}`);
                    lines.push(`TRIGGER:-PT${Math.round(e.reminderMinutesBefore)}M`);
                    lines.push("END:VALARM");
                  }
                  lines.push("END:VEVENT");
                }

                lines.push("END:VCALENDAR");
                downloadText(`lifepet-agenda-${activePetId}.ics`, lines.join("\r\n"));
              }}
            >
              Esporta ICS
            </button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi evento</CardTitle>
          <CardDescription>Visite, toelettatura, training e promemoria.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per aggiungere eventi." />
        ) : (
          <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_180px_200px_140px] gap-3 items-end">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Titolo</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Data e ora</div>
              <input
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                type="datetime-local"
                required
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Tipo</div>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as AgendaEvent["kind"])}
                className="lp-select"
              >
                <option value="vet">Veterinario</option>
                <option value="grooming">Toelettatura</option>
                <option value="training">Training</option>
                <option value="cleaning">Pulizia</option>
                <option value="other">Altro</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Promemoria</div>
              <div className="relative">
                <Bell className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                  className="w-full pl-9 lp-select"
                >
                  <option value="0">Nessuno</option>
                  <option value="15">15 min prima</option>
                  <option value="60">1 ora prima</option>
                  <option value="180">3 ore prima</option>
                  <option value="1440">1 giorno prima</option>
                </select>
              </div>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Ricorrenza</div>
              <select value={recurrenceType} onChange={(e) => setRecurrenceType(parseRecurrenceType(e.target.value))} className="lp-select">
                <option value="none">Nessuna</option>
                <option value="daily">Giornaliera</option>
                <option value="weekly">Settimanale</option>
              </select>
            </label>

            <button
              disabled={saving}
              className="lp-btn-primary"
              type="submit"
            >
              {saving ? "…" : "Aggiungi"}
            </button>

            {recurrenceType === "weekly" ? (
              <div className="md:col-span-6">
                <div className="text-xs text-slate-400 mb-1">Giorni</div>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((w) => (
                    <button
                      key={w.i}
                      type="button"
                      onClick={() => setWeekdays((prev) => (prev.includes(w.i) ? prev.filter((x) => x !== w.i) : [...prev, w.i]))}
                      className={
                        weekdays.includes(w.i)
                          ? "rounded-xl bg-sky-600/10 border border-sky-600/20 px-3 py-2 text-xs text-sky-800"
                          : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
                      }
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prossimi 30 giorni</CardTitle>
          <CardDescription>Una vista rapida per organizzarti bene.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere l’agenda." />
        ) : events.length === 0 ? (
          <EmptyState title="Nessun evento" description="Aggiungi un promemoria o un appuntamento." />
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="lp-panel px-3 py-2">
                {editingId === ev.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activePetId) return;
                      const t = editTitle.trim();
                      if (!t) {
                        pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per l’evento." });
                        return;
                      }
                      const dueMs = editDueAt ? new Date(editDueAt).getTime() : NaN;
                      if (!Number.isFinite(dueMs)) {
                        pushToast({ type: "error", title: "Data non valida", message: "Controlla data e ora dell’evento." });
                        return;
                      }
                      setSavingEdit(true);
                      try {
                        await updateAgendaEvent(activePetId, ev.id, {
                          title: t,
                          dueAt: dueMs,
                          kind: editKind,
                          reminderMinutesBefore: Math.max(0, Number(editReminder) || 0),
                        });
                        setEditingId(null);
                        pushToast({ type: "success", title: "Evento aggiornato", message: "Salvataggio completato." });
                      } catch (err) {
                        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-[1fr_220px_200px_1fr] gap-3 items-end"
                  >
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Titolo</div>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="lp-input" />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Data e ora</div>
                      <input value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} type="datetime-local" className="lp-input" />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Tipo</div>
                      <select value={editKind} onChange={(e) => setEditKind(e.target.value as AgendaEvent["kind"])} className="lp-select">
                        <option value="vet">Veterinario</option>
                        <option value="grooming">Toelettatura</option>
                        <option value="training">Training</option>
                        <option value="cleaning">Pulizia</option>
                        <option value="other">Altro</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Promemoria</div>
                      <select value={editReminder} onChange={(e) => setEditReminder(e.target.value)} className="lp-select">
                        <option value="0">Nessuno</option>
                        <option value="15">15 min</option>
                        <option value="60">1 ora</option>
                        <option value="180">3 ore</option>
                        <option value="1440">1 giorno</option>
                      </select>
                    </label>
                    <div className="md:col-span-4 flex items-center gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="lp-btn-secondary">
                        Annulla
                      </button>
                      <button disabled={savingEdit} type="submit" className="lp-btn-primary">
                        {savingEdit ? "Salvataggio…" : "Salva"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-xs text-slate-500">{ev.kind}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(ev.dueAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(ev.id);
                          setEditTitle(ev.title);
                          setEditDueAt(new Date(ev.dueAt).toISOString().slice(0, 16));
                          setEditKind(ev.kind);
                          setEditReminder(String(ev.reminderMinutesBefore ?? 0));
                        }}
                        className="lp-btn-icon"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          if (deletingId) return;
                          if (!confirm("Eliminare questo evento?")) return;
                          setDeletingId(ev.id);
                          try {
                            await deleteAgendaEvent(activePetId, ev.id);
                            pushToast({ type: "success", title: "Evento eliminato", message: "Rimosso dall’agenda." });
                          } catch (err) {
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        className="lp-btn-icon"
                        disabled={deletingId === ev.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

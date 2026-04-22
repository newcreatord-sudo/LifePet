import { useMemo, useState } from "react";
import { PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";
import type { AgendaEvent, AgendaSeries } from "@/types";
import { useConfirmDialog } from "@/components/confirm";
import { useToastStore } from "@/stores/toastStore";
import { deleteAgendaSeriesAndFutureEvents, deleteFutureAgendaEventsForSeries, seedUpcomingAgendaFromSeries, updateAgendaSeries } from "@/data/agenda";

const weekdayOptions = [{ i: 1, label: "Lun" }, { i: 2, label: "Mar" }, { i: 3, label: "Mer" }, { i: 4, label: "Gio" }, { i: 5, label: "Ven" }, { i: 6, label: "Sab" }, { i: 0, label: "Dom" }] as const;
const weekdayMap: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Gio", 5: "Ven", 6: "Sab" };

function toDateValue(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateValue(v: string) {
  const ms = new Date(v).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function recurrenceLabel(r: AgendaSeries["recurrence"]) {
  return r.type === "daily" ? "Ogni giorno" : `Ogni settimana: ${(r.weekdays || []).slice().sort((a, b) => a - b).map((d) => weekdayMap[d] || String(d)).join(", ")}`;
}

export function SeriesManager(props: { petId: string; userId: string; series: AgendaSeries[] }) {
  const { petId, userId, series } = props;
  const confirmDialog = useConfirmDialog();
  const pushToast = useToastStore((s) => s.push);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKind, setEditKind] = useState<AgendaEvent["kind"]>("other");
  const [editStartAt, setEditStartAt] = useState("");
  const [editTimeOfDay, setEditTimeOfDay] = useState("09:00");
  const [editRecurrence, setEditRecurrence] = useState<"daily" | "weekly">("daily");
  const [editWeekdays, setEditWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editReminder, setEditReminder] = useState("60");
  const visible = useMemo(() => series.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [series]);

  async function toggleEnabled(s: AgendaSeries) {
    const now = Date.now();
    if (busyId) return;
    if (s.createdBy !== userId) {
      pushToast({ type: "error", title: "Serie", message: "Non hai permessi per modificare questa serie." });
      return;
    }

    if (s.enabled) {
      const ok = await confirmDialog({
        title: "Disattiva serie",
        description: "Vuoi disattivare la serie e rimuovere gli eventi futuri già generati?",
        confirmLabel: "Disattiva",
        cancelLabel: "Annulla",
        variant: "danger",
      });
      if (!ok) return;
      setBusyId(s.id);
      try {
        await updateAgendaSeries(petId, s.id, { enabled: false });
        await deleteFutureAgendaEventsForSeries(petId, s.id, now);
        pushToast({ type: "success", title: "Serie disattivata", message: "Eventi futuri rimossi." });
      } catch (e) {
        pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Operazione fallita" });
      } finally {
        setBusyId(null);
      }
      return;
    }

    setBusyId(s.id);
    try {
      await updateAgendaSeries(petId, s.id, { enabled: true });
      await seedUpcomingAgendaFromSeries(petId, { ...s, enabled: true }, 30);
      pushToast({ type: "success", title: "Serie attivata", message: "Eventi futuri generati." });
    } catch (e) {
      pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(s: AgendaSeries) {
    if (busyId) return;
    if (s.createdBy !== userId) {
      pushToast({ type: "error", title: "Serie", message: "Non hai permessi per eliminare questa serie." });
      return;
    }
    const ok = await confirmDialog({
      title: "Elimina serie",
      description: "Elimina la serie e rimuove gli eventi futuri già generati (lo storico passato resta).",
      confirmLabel: "Elimina",
      cancelLabel: "Annulla",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(s.id);
    try {
      await deleteAgendaSeriesAndFutureEvents(petId, s.id, Date.now());
      pushToast({ type: "success", title: "Serie eliminata", message: "Rimossa." });
      if (editingId === s.id) setEditingId(null);
    } catch (e) {
      pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Eliminazione fallita" });
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(s: AgendaSeries) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditKind(s.kind);
    setEditStartAt(toDateValue(s.startAt));
    setEditTimeOfDay(s.timeOfDay);
    setEditReminder(String(s.reminderMinutesBefore ?? 0));
    setEditRecurrence(s.recurrence.type);
    setEditWeekdays(s.recurrence.type === "weekly" ? s.recurrence.weekdays.slice() : [1, 2, 3, 4, 5]);
  }

  async function saveEdit(s: AgendaSeries) {
    if (busyId) return;
    if (s.createdBy !== userId) {
      pushToast({ type: "error", title: "Serie", message: "Non hai permessi per modificare questa serie." });
      return;
    }
    const t = editTitle.trim();
    if (!t) {
      pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per la serie." });
      return;
    }
    const startAt = parseDateValue(editStartAt);
    if (!startAt) {
      pushToast({ type: "error", title: "Data non valida", message: "Controlla la data di inizio." });
      return;
    }
    const timeOfDay = String(editTimeOfDay || "").trim();
    if (!/^\d{2}:\d{2}$/.test(timeOfDay)) {
      pushToast({ type: "error", title: "Orario non valido", message: "Usa formato HH:MM." });
      return;
    }
    const reminderMinutesBefore = Math.max(0, Number(editReminder) || 0);
    const recurrence: AgendaSeries["recurrence"] =
      editRecurrence === "weekly"
        ? { type: "weekly", weekdays: Array.from(new Set(editWeekdays)).slice().sort((a, b) => a - b) }
        : { type: "daily" };
    if (recurrence.type === "weekly" && recurrence.weekdays.length === 0) {
      pushToast({ type: "error", title: "Giorni mancanti", message: "Seleziona almeno un giorno per la serie settimanale." });
      return;
    }

    const ok = await confirmDialog({
      title: "Salva modifiche",
      description: s.enabled ? "Rigenera gli eventi futuri della serie in base alle modifiche." : "Aggiorna la serie (è disattivata, non genera eventi).",
      confirmLabel: "Salva",
      cancelLabel: "Annulla",
    });
    if (!ok) return;

    setBusyId(s.id);
    try {
      const patch: Partial<Omit<AgendaSeries, "id" | "petId" | "createdAt" | "createdBy">> = {
        title: t,
        kind: editKind,
        startAt,
        timeOfDay,
        recurrence,
        reminderMinutesBefore,
      };
      await updateAgendaSeries(petId, s.id, patch);

      if (s.enabled) {
        await deleteFutureAgendaEventsForSeries(petId, s.id, Date.now());
        const updated: AgendaSeries = { ...s, ...patch } as AgendaSeries;
        await seedUpcomingAgendaFromSeries(petId, updated, 30);
      }

      pushToast({ type: "success", title: "Serie aggiornata", message: "Modifiche salvate." });
      setEditingId(null);
    } catch (e) {
      pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Salvataggio fallito" });
    } finally {
      setBusyId(null);
    }
  }

  if (!visible.length) return <div className="text-sm lp-muted">Nessuna serie. Creala dall’AI o dal campo “Ricorrenza”.</div>;

  return (
    <div className="space-y-2">
      {visible.map((s) => {
          const isEditing = editingId === s.id;
          const disabled = busyId === s.id || busyId === "__batch__";
          return (
            <div key={s.id} className="lp-panel px-3 py-2">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit(s);
                  }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
                >
                  <label className="lg:col-span-4 block">
                    <div className="text-xs lp-muted mb-1">Titolo</div>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="lp-input" />
                  </label>
                  <label className="lg:col-span-2 block">
                    <div className="text-xs lp-muted mb-1">Tipo</div>
                    <select value={editKind} onChange={(e) => setEditKind(e.target.value as AgendaEvent["kind"])} className="lp-select">
                      <option value="vet">Veterinario</option>
                      <option value="grooming">Toelettatura</option>
                      <option value="training">Training</option>
                      <option value="cleaning">Pulizia</option>
                      <option value="other">Altro</option>
                    </select>
                  </label>
                  <label className="lg:col-span-2 block">
                    <div className="text-xs lp-muted mb-1">Inizio</div>
                    <input value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} type="date" className="lp-input" />
                  </label>
                  <label className="lg:col-span-2 block">
                    <div className="text-xs lp-muted mb-1">Ora</div>
                    <input value={editTimeOfDay} onChange={(e) => setEditTimeOfDay(e.target.value)} placeholder="HH:MM" className="lp-input" />
                  </label>
                  <label className="lg:col-span-1 block">
                    <div className="text-xs lp-muted mb-1">Prom.</div>
                    <input value={editReminder} onChange={(e) => setEditReminder(e.target.value)} inputMode="numeric" className="lp-input" />
                  </label>
                  <label className="lg:col-span-1 block">
                    <div className="text-xs lp-muted mb-1">Freq.</div>
                    <select value={editRecurrence} onChange={(e) => setEditRecurrence(e.target.value === "weekly" ? "weekly" : "daily")} className="lp-select">
                      <option value="daily">Giorni</option>
                      <option value="weekly">Settimana</option>
                    </select>
                  </label>

                  {editRecurrence === "weekly" ? (
                    <div className="lg:col-span-12">
                      <div className="text-xs lp-muted">Giorni</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {weekdayOptions.map((w) => (
                          <button
                            key={w.i}
                            type="button"
                            onClick={() =>
                              setEditWeekdays((prev) =>
                                prev.includes(w.i) ? prev.filter((x) => x !== w.i) : [...prev, w.i]
                              )
                            }
                            className={editWeekdays.includes(w.i) ? "lp-chip lp-chip-active" : "lp-chip"}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="lg:col-span-12 flex items-center justify-end gap-2">
                    <button type="button" className="lp-btn-secondary" onClick={() => setEditingId(null)} disabled={disabled}>Annulla</button>
                    <button type="submit" className="lp-btn-primary" disabled={disabled}>{disabled ? "…" : "Salva"}</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <span className={s.enabled ? "lp-badge lp-badge-info" : "lp-badge"}>{s.enabled ? "Attiva" : "Disattiva"}</span>
                    </div>
                    <div className="text-xs lp-muted mt-1">{s.kind} · {recurrenceLabel(s.recurrence)} · {s.timeOfDay} · Inizio {new Date(s.startAt).toLocaleDateString()} · Prom. {s.reminderMinutesBefore ?? 0}m</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="lp-btn-icon" disabled={disabled} onClick={() => toggleEnabled(s)} aria-label={s.enabled ? "Disattiva" : "Attiva"}>{s.enabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}</button>
                    <button type="button" className="lp-btn-icon" disabled={disabled} onClick={() => startEdit(s)} aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                    <button type="button" className="lp-btn-icon" disabled={disabled} onClick={() => void onDelete(s)} aria-label="Elimina"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

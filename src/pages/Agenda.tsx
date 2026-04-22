import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, CalendarDays, Clock, Layers, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import {
  createAgendaEvent,
  createAgendaSeries,
  deleteAgendaEvent,
  seedUpcomingAgendaFromSeries,
  subscribeAgendaRange,
  subscribeAgendaSeries,
  updateAgendaEvent,
} from "@/data/agenda";
import type { AgendaEvent, AgendaSeries } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { seedStarterKit } from "@/lib/starterKit";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/confirm";
import { MonthCalendar } from "@/components/agenda/MonthCalendar";
import { aiSuggestAgendaEvents, aiSuggestAgendaPlan, aiSuggestReminder } from "@/data/ai";
import { agendaEventDedupeKey, agendaSeriesDedupeKey } from "@/lib/agendaDedupe";
import { SeriesManager } from "@/components/agenda/SeriesManager";
import { PlannerAgendaTabs } from "@/components/PlannerAgendaTabs";

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
  const confirmDialog = useConfirmDialog();
  const location = useLocation();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [series, setSeries] = useState<AgendaSeries[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const createTitleRef = useRef<HTMLInputElement | null>(null);
  const [seedingStarter, setSeedingStarter] = useState(false);

  function focusAddEvent() {
    createTitleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    createTitleRef.current?.focus();
  }

  async function onSeedStarter() {
    if (!user || !activePetId) return;
    if (seedingStarter) return;
    setSeedingStarter(true);
    try {
      const res = await seedStarterKit(activePetId, user.uid);
      pushToast({
        type: res === "already" ? "info" : "success",
        title: "Setup rapido",
        message: res === "already" ? "Già applicato per questo pet." : "Creati dati iniziali per popolare le sezioni.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "Setup rapido", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setSeedingStarter(false);
    }
  }
  const [kindFilter, setKindFilter] = useState<Record<AgendaEvent["kind"], boolean>>({
    vet: true,
    grooming: true,
    training: true,
    cleaning: true,
    other: true,
  });

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

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<null | { title: string; dueAt: number; kind: AgendaEvent["kind"]; reminderMinutesBefore?: number | null; notes?: string }>(null);

  const [aiMode, setAiMode] = useState<"single" | "multi" | "plan">("single");
  const [aiBatchMax, setAiBatchMax] = useState("6");
  const [aiBatch, setAiBatch] = useState<Array<{ title: string; dueAt: number; kind: AgendaEvent["kind"]; reminderMinutesBefore?: number | null; notes?: string }>>([]);
  const [aiBatchSel, setAiBatchSel] = useState<Record<string, boolean>>({});
  const [aiBatchSaving, setAiBatchSaving] = useState(false);

  const [aiSeriesMax, setAiSeriesMax] = useState("4");
  const [aiSeries, setAiSeries] = useState<
    Array<{
      title: string;
      kind: AgendaEvent["kind"];
      startAt: number;
      timeOfDay: string;
      recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] };
      reminderMinutesBefore?: number | null;
      notes?: string;
    }>
  >([]);
  const [aiSeriesSel, setAiSeriesSel] = useState<Record<string, boolean>>({});

  const range = useMemo(() => {
    const from = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 7);
    const to = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
    to.setDate(to.getDate() + 7);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, [calendarMonth]);

  function toDatetimeLocal(ms: number) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const ai = sp.get("ai");
    if (ai) {
      setAiText(ai);
      setAiSuggestion(null);
      setAiError(null);
    }
  }, [location.search]);

  function parseRecurrenceType(v: string): "none" | "daily" | "weekly" {
    if (v === "daily" || v === "weekly") return v;
    return "none";
  }

  useEffect(() => {
    if (!activePetId) {
      setEvents([]);
      setLoaded(false);
      setInlineError(null);
      setSelected({});
      return;
    }
    setLoaded(false);
    setInlineError(null);
    const unsub = subscribeAgendaRange(
      activePetId,
      range.fromMs,
      range.toMs,
      (items) => {
        setEvents(items);
        setLoaded(true);
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento agenda fallito");
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs]);

  useEffect(() => {
    if (!activePetId) {
      setSeries([]);
      return;
    }
    const unsub = subscribeAgendaSeries(
      activePetId,
      (items) => {
        setSeries(items);
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento serie fallito");
      }
    );
    return () => unsub();
  }, [activePetId]);

  const visibleEvents = useMemo(() => events.filter((e) => kindFilter[e.kind]), [events, kindFilter]);
  const selectedIds = useMemo(() => visibleEvents.filter((e) => selected[e.id]).map((e) => e.id), [selected, visibleEvents]);

  const nextUpcoming = useMemo(() => {
    const now = Date.now();
    return visibleEvents
      .filter((e) => e.dueAt >= now)
      .slice()
      .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null;
  }, [visibleEvents]);

  const selectedDayRange = useMemo(() => {
    const from = new Date(selectedDay);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, [selectedDay]);

  const dayEvents = useMemo(() => {
    return visibleEvents.filter((e) => e.dueAt >= selectedDayRange.fromMs && e.dueAt <= selectedDayRange.toMs).slice().sort((a, b) => a.dueAt - b.dueAt);
  }, [selectedDayRange.fromMs, selectedDayRange.toMs, visibleEvents]);

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      set.add(agendaEventDedupeKey(e.title, e.kind, e.dueAt));
    }
    return set;
  }, [events]);

  const existingSeriesKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) {
      set.add(agendaSeriesDedupeKey(s));
    }
    return set;
  }, [series]);

  function localDedupeKey(k: string) {
    return `lifepet:agenda:dedupe:${activePetId || "none"}:${k}`;
  }

  function localSeriesDedupeKey(k: string) {
    return `lifepet:agenda:series:dedupe:${activePetId || "none"}:${k}`;
  }

  function isLocalDuplicate(k: string, ttlMs: number) {
    try {
      const raw = localStorage.getItem(localDedupeKey(k));
      const ts = raw ? Number(raw) : 0;
      if (!ts || !Number.isFinite(ts)) return false;
      return Date.now() - ts < ttlMs;
    } catch {
      return false;
    }
  }

  function isLocalSeriesDuplicate(k: string, ttlMs: number) {
    try {
      const raw = localStorage.getItem(localSeriesDedupeKey(k));
      const ts = raw ? Number(raw) : 0;
      if (!ts || !Number.isFinite(ts)) return false;
      return Date.now() - ts < ttlMs;
    } catch {
      return false;
    }
  }

  function markLocalDeduped(k: string) {
    try {
      localStorage.setItem(localDedupeKey(k), String(Date.now()));
    } catch {
      return;
    }
  }

  function markLocalSeriesDeduped(k: string) {
    try {
      localStorage.setItem(localSeriesDedupeKey(k), String(Date.now()));
    } catch {
      return;
    }
  }

  function recurrenceLabel(r: { type: "daily" } | { type: "weekly"; weekdays: number[] }) {
    if (r.type === "daily") return "Ogni giorno";
    const map: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Gio", 5: "Ven", 6: "Sab" };
    const days = (r.weekdays || []).slice().sort((a, b) => a - b).map((d) => map[d] || String(d));
    return `Ogni settimana: ${days.join(", ")}`;
  }

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
    setInlineError(null);
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
      setInlineError(err instanceof Error ? err.message : "Operazione fallita");
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
        imagePrompt="minimal clean illustration, calendar with paw icon and reminders list, airy background, accent color, premium, no text, no watermark"
        imageAlt="Agenda"
        actions={
          <>
            <button
              type="button"
              className="lp-btn-secondary inline-flex items-center gap-2"
              onClick={() => {
                setAiMode("plan");
                setAiText(
                  "Pianifica i prossimi 14 giorni: crea 2-3 serie (es. farmaco giornaliero, training settimanale) e 2-3 promemoria singoli (es. chiamare vet, comprare scorte). Usa orari realistici."
                );
                setAiError(null);
                setAiSuggestion(null);
                setAiBatch([]);
                setAiBatchSel({});
                setAiSeries([]);
                setAiSeriesSel({});
              }}
              disabled={!activePetId}
            >
              <Sparkles className="w-4 h-4" />
              Piano AI
            </button>
            {activePetId && events.length ? (
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  const now = Date.now();
                  const lines: string[] = [];
                  lines.push("BEGIN:VCALENDAR");
                  lines.push("VERSION:2.0");
                  lines.push("PRODID:-//PetLyon//Agenda//IT");
                  lines.push("CALSCALE:GREGORIAN");

                  for (const e of events) {
                    const uid = `${activePetId}-${e.id}@petlyon`;
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
                  downloadText("petlyon-agenda.ics", lines.join("\n"));
                  pushToast({ type: "success", title: "Esportato", message: "File .ics scaricato." });
                }}
              >
                <Bell className="w-4 h-4 inline-block mr-2" />
                Esporta .ics
              </button>
            ) : null}
          </>
        }
      />

      <PlannerAgendaTabs />

      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="lp-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs lp-muted">Prossimi</div>
                  <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{visibleEvents.filter((e) => e.dueAt >= Date.now()).length}</div>
                  <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>{nextUpcoming ? `Next: ${nextUpcoming.title}` : "Nessun evento"}</div>
                </div>
                <CalendarDays className="w-5 h-5 lp-icon-primary" />
              </div>
            </div>
            <div className="lp-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs lp-muted">Serie</div>
                  <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{series.length}</div>
                  <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Routine ricorrenti</div>
                </div>
                <Layers className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
              </div>
            </div>
            <div className="lp-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs lp-muted">Reminder</div>
                  <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{visibleEvents.filter((e) => (e.reminderMinutesBefore ?? 0) > 0).length}</div>
                  <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Con notifica</div>
                </div>
                <Clock className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
              </div>
              {activePetId ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link to={{ pathname: "/app/planner", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-chip">Collega al Planner</Link>
                  <Link to={{ pathname: "/app/health", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-chip">Aggiungi visita</Link>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <MonthCalendar
            month={calendarMonth}
            selectedDay={selectedDay}
            events={visibleEvents}
            onMonthChange={(next) => setCalendarMonth(next)}
            onSelectDay={(d) => {
              const next = new Date(d);
              next.setHours(0, 0, 0, 0);
              setSelectedDay(next);
              if (!dueAt) {
                const slot = new Date(next);
                slot.setHours(9, 0, 0, 0);
                setDueAt(toDatetimeLocal(slot.getTime()));
              }
            }}
          />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <CardTitle>Giorno selezionato</CardTitle>
              <CardDescription>{selectedDay.toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
              {!activePetId ? (
                <EmptyState
                  title="Seleziona un pet"
                  description="Scegli un profilo per vedere l’agenda."
                  action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
                />
              ) : !loaded ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : dayEvents.length === 0 ? (
                <div className="text-sm lp-muted">Nessun evento in questo giorno.</div>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className="lp-panel px-3 py-2">
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-xs lp-muted mt-1">{new Date(ev.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {ev.kind}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <CardTitle>Crea con AI</CardTitle>
              <CardDescription>Genera eventi e serie ricorrenti, poi conferma cosa salvare.</CardDescription>
            </CardHeader>
            <CardContent>
              {aiError ? (
                <div className="mb-3">
                  <Alert variant="danger" title="Errore">{aiError}</Alert>
                </div>
              ) : null}

              <div className="flex items-center gap-2 mb-3">
                <button type="button" className={aiMode === "single" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setAiMode("single")}>Singolo</button>
                <button type="button" className={aiMode === "multi" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setAiMode("multi")}>Multi</button>
                <button type="button" className={aiMode === "plan" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setAiMode("plan")}>Serie</button>
              </div>

              <div className="grid gap-2">
                <textarea
                  className="lp-textarea"
                  rows={3}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={
                    aiMode === "single"
                      ? "Esempio: ricordami sabato alle 10 di chiamare il veterinario per controllare la terapia."
                      : aiMode === "multi"
                        ? "Esempio: pianifica i prossimi 7 giorni con 5 eventi (vet, farmaci, training, toelettatura) e orari realistici."
                        : "Esempio: ogni giorno alle 9 somministra farmaco, ogni lun/mer/ven alle 18 training, e aggiungi 2 promemoria singoli questa settimana."
                  }
                  disabled={!activePetId || aiBusy}
                />

                {aiMode === "multi" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs lp-muted">Massimo</label>
                    <select className="lp-select" value={aiBatchMax} onChange={(e) => setAiBatchMax(e.target.value)} disabled={!activePetId || aiBusy}>
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                    </select>
                    <div className="text-xs lp-muted">eventi</div>
                  </div>
                ) : null}

                {aiMode === "plan" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs lp-muted">Max serie</label>
                    <select className="lp-select" value={aiSeriesMax} onChange={(e) => setAiSeriesMax(e.target.value)} disabled={!activePetId || aiBusy}>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="6">6</option>
                      <option value="8">8</option>
                    </select>
                    <div className="text-xs lp-muted">· Max eventi</div>
                    <select className="lp-select" value={aiBatchMax} onChange={(e) => setAiBatchMax(e.target.value)} disabled={!activePetId || aiBusy}>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                    </select>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="lp-btn-primary"
                    disabled={!activePetId || aiBusy || !aiText.trim()}
                    onClick={async () => {
                      if (!activePetId) return;
                      setAiBusy(true);
                      setAiError(null);
                      setAiSuggestion(null);
                      setAiBatch([]);
                      setAiBatchSel({});
                      setAiSeries([]);
                      setAiSeriesSel({});
                      try {
                        if (aiMode === "single") {
                          const res = await aiSuggestReminder(activePetId, aiText, Date.now());
                          if (!res.reminder || res.confidence < 0.65) {
                            setAiError("Non ho trovato una data/ora abbastanza chiara. Prova a specificare giorno e ora.");
                            return;
                          }
                          setAiSuggestion(res.reminder);
                          return;
                        }

                        if (aiMode === "multi") {
                          const max = Math.max(1, Math.min(10, Number(aiBatchMax) || 6));
                          const res = await aiSuggestAgendaEvents(activePetId, aiText, Date.now(), max);
                          if (!res.events.length || res.confidence < 0.55) {
                            setAiError("Non sono riuscito a generare una lista affidabile. Prova a specificare un intervallo (es. 7 giorni) e qualche tipo di evento.");
                            return;
                          }
                          setAiBatch(res.events);
                          const nextSel: Record<string, boolean> = {};
                          for (const e of res.events) {
                            const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                            const dup = existingKeys.has(k) || isLocalDuplicate(k, 14 * 24 * 60 * 60 * 1000);
                            nextSel[k] = !dup;
                          }
                          setAiBatchSel(nextSel);
                          return;
                        }

                        const maxS = Math.max(0, Math.min(8, Number(aiSeriesMax) || 4));
                        const maxE = Math.max(0, Math.min(10, Number(aiBatchMax) || 6));
                        const plan = await aiSuggestAgendaPlan(activePetId, aiText, Date.now(), maxE, maxS);
                        if ((!plan.series.length && !plan.events.length) || plan.confidence < 0.5) {
                          setAiError("Non ho trovato una proposta sufficientemente chiara per creare serie/eventi. Prova a specificare orari e giorni.");
                          return;
                        }

                        setAiSeries(plan.series);
                        setAiBatch(plan.events);

                        const ttlMs = 14 * 24 * 60 * 60 * 1000;
                        const sSel: Record<string, boolean> = {};
                        for (const s of plan.series) {
                          const k = agendaSeriesDedupeKey(s);
                          const dup = existingSeriesKeys.has(k) || isLocalSeriesDuplicate(k, ttlMs);
                          sSel[k] = !dup;
                        }
                        setAiSeriesSel(sSel);

                        const eSel: Record<string, boolean> = {};
                        for (const e of plan.events) {
                          const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                          const dup = existingKeys.has(k) || isLocalDuplicate(k, ttlMs);
                          eSel[k] = !dup;
                        }
                        setAiBatchSel(eSel);
                      } catch (e) {
                        setAiError(e instanceof Error ? e.message : "Richiesta AI fallita");
                      } finally {
                        setAiBusy(false);
                      }
                    }}
                  >
                    {aiBusy ? "Generazione…" : aiMode === "single" ? "Genera" : aiMode === "multi" ? "Genera lista" : "Genera piano"}
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={aiBusy}
                    onClick={() => {
                      setAiText("");
                      setAiSuggestion(null);
                      setAiBatch([]);
                      setAiBatchSel({});
                      setAiSeries([]);
                      setAiSeriesSel({});
                      setAiError(null);
                    }}
                  >
                    Pulisci
                  </button>
                </div>

                {aiSuggestion ? (
                  <div className="lp-panel p-3">
                    <div className="text-sm font-semibold">Proposta</div>
                    <div className="text-sm mt-1">{aiSuggestion.title}</div>
                    <div className="text-xs lp-muted mt-1">{new Date(aiSuggestion.dueAt).toLocaleString()} · {aiSuggestion.kind}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className="lp-btn-primary"
                        disabled={!user || !activePetId}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          try {
                            const k = agendaEventDedupeKey(aiSuggestion.title, aiSuggestion.kind, aiSuggestion.dueAt);
                            const dup = existingKeys.has(k) || isLocalDuplicate(k, 7 * 24 * 60 * 60 * 1000);
                            if (dup) {
                              pushToast({ type: "info", title: "Agenda", message: "Questo evento sembra già presente: deduplica attiva." });
                              setAiSuggestion(null);
                              return;
                            }
                            await createAgendaEvent(activePetId, {
                              petId: activePetId,
                              title: aiSuggestion.title,
                              dueAt: aiSuggestion.dueAt,
                              kind: aiSuggestion.kind,
                              reminderMinutesBefore: Math.max(0, Number(aiSuggestion.reminderMinutesBefore ?? 60) || 0),
                              createdAt: Date.now(),
                              createdBy: user.uid,
                            });
                            markLocalDeduped(k);
                            pushToast({ type: "success", title: "Promemoria creato", message: "Aggiunto all’agenda." });
                            setAiSuggestion(null);
                            setAiError(null);
                            const d = new Date(aiSuggestion.dueAt);
                            d.setHours(0, 0, 0, 0);
                            setSelectedDay(d);
                            setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                          } catch (e) {
                            setAiError(e instanceof Error ? e.message : "Salvataggio fallito");
                          }
                        }}
                      >
                        Conferma e salva
                      </button>
                      <button type="button" className="lp-btn-secondary" onClick={() => setAiSuggestion(null)}>
                        Annulla
                      </button>
                    </div>
                    {aiSuggestion.notes ? <div className="text-xs lp-muted mt-2 whitespace-pre-wrap">Note: {aiSuggestion.notes}</div> : null}
                  </div>
                ) : null}

                {aiMode === "plan" && (aiSeries.length || aiBatch.length) ? (
                  <div className="lp-panel p-3">
                    <div className="text-sm font-semibold">Piano proposto</div>

                    {aiSeries.length ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs lp-muted">Serie ricorrenti</div>
                          <label className="inline-flex items-center gap-2 text-xs lp-muted">
                            <input
                              type="checkbox"
                              checked={aiSeries.length > 0 && aiSeries.every((s) => aiSeriesSel[agendaSeriesDedupeKey(s)] === true)}
                              onChange={(ev) => {
                                const checked = ev.target.checked;
                                const ttlMs = 14 * 24 * 60 * 60 * 1000;
                                const next: Record<string, boolean> = { ...aiSeriesSel };
                                for (const s of aiSeries) {
                                  const k = agendaSeriesDedupeKey(s);
                                  const dup = existingSeriesKeys.has(k) || isLocalSeriesDuplicate(k, ttlMs);
                                  next[k] = checked ? !dup : false;
                                }
                                setAiSeriesSel(next);
                              }}
                            />
                            Seleziona tutto
                          </label>
                        </div>

                        <div className="mt-2 space-y-2">
                          {aiSeries.map((s) => {
                            const k = agendaSeriesDedupeKey(s);
                            const ttlMs = 14 * 24 * 60 * 60 * 1000;
                            const dup = existingSeriesKeys.has(k) || isLocalSeriesDuplicate(k, ttlMs);
                            const checked = Boolean(aiSeriesSel[k]);
                            return (
                              <label key={k} className="flex items-start gap-3 lp-panel px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={dup}
                                  onChange={(ev) => setAiSeriesSel((prev) => ({ ...prev, [k]: ev.target.checked }))}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{s.title}</div>
                                  <div className="text-xs lp-muted mt-1">
                                    {s.kind} · {recurrenceLabel(s.recurrence)} · {s.timeOfDay} · inizio {new Date(s.startAt).toLocaleDateString()}
                                    {dup ? " · già presente" : ""}
                                  </div>
                                  {s.notes ? <div className="text-xs lp-muted mt-1 whitespace-pre-wrap">{s.notes}</div> : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {aiBatch.length ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs lp-muted">Eventi singoli</div>
                          <label className="inline-flex items-center gap-2 text-xs lp-muted">
                            <input
                              type="checkbox"
                              checked={aiBatch.length > 0 && aiBatch.every((e) => aiBatchSel[agendaEventDedupeKey(e.title, e.kind, e.dueAt)] === true)}
                              onChange={(ev) => {
                                const checked = ev.target.checked;
                                const next: Record<string, boolean> = { ...aiBatchSel };
                                for (const e of aiBatch) {
                                  const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                                  const dup = existingKeys.has(k) || isLocalDuplicate(k, 14 * 24 * 60 * 60 * 1000);
                                  next[k] = checked ? !dup : false;
                                }
                                setAiBatchSel(next);
                              }}
                            />
                            Seleziona tutto
                          </label>
                        </div>
                        <div className="mt-2 space-y-2">
                          {aiBatch.map((e) => {
                            const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                            const dup = existingKeys.has(k) || isLocalDuplicate(k, 14 * 24 * 60 * 60 * 1000);
                            const checked = Boolean(aiBatchSel[k]);
                            return (
                              <label key={k} className="flex items-start gap-3 lp-panel px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={dup}
                                  onChange={(ev) => setAiBatchSel((prev) => ({ ...prev, [k]: ev.target.checked }))}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{e.title}</div>
                                  <div className="text-xs lp-muted mt-1">{new Date(e.dueAt).toLocaleString()} · {e.kind}{dup ? " · già presente" : ""}</div>
                                  {e.notes ? <div className="text-xs lp-muted mt-1 whitespace-pre-wrap">{e.notes}</div> : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        className="lp-btn-secondary"
                        disabled={aiBatchSaving}
                        onClick={() => {
                          setAiSeries([]);
                          setAiSeriesSel({});
                          setAiBatch([]);
                          setAiBatchSel({});
                        }}
                      >
                        Chiudi
                      </button>
                      <button
                        type="button"
                        className="lp-btn-primary"
                        disabled={!user || !activePetId || aiBatchSaving || (Object.values(aiBatchSel).every((v) => !v) && Object.values(aiSeriesSel).every((v) => !v))}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          if (aiBatchSaving) return;
                          setAiBatchSaving(true);
                          setAiError(null);
                          const createdAt = Date.now();
                          const ttlMs = 14 * 24 * 60 * 60 * 1000;
                          const errors: string[] = [];
                          let okCount = 0;
                          try {
                            for (const s of aiSeries) {
                              const k = agendaSeriesDedupeKey(s);
                              if (!aiSeriesSel[k]) continue;
                              const dup = existingSeriesKeys.has(k) || isLocalSeriesDuplicate(k, ttlMs);
                              if (dup) continue;
                              try {
                                const seriesInput: Omit<AgendaSeries, "id"> = {
                                  petId: activePetId,
                                  title: s.title,
                                  kind: s.kind,
                                  enabled: true,
                                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                  startAt: s.startAt,
                                  timeOfDay: s.timeOfDay,
                                  recurrence: s.recurrence,
                                  reminderMinutesBefore: Math.max(0, Number(s.reminderMinutesBefore ?? 60) || 0),
                                  createdAt,
                                  createdBy: user.uid,
                                };
                                const seriesId = await createAgendaSeries(activePetId, seriesInput);
                                await seedUpcomingAgendaFromSeries(activePetId, { id: seriesId, ...seriesInput }, 30);
                                markLocalSeriesDeduped(k);
                                okCount++;
                              } catch (err) {
                                errors.push(err instanceof Error ? err.message : "Salvataggio serie fallito");
                              }
                            }

                            for (const e of aiBatch) {
                              const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                              if (!aiBatchSel[k]) continue;
                              const dup = existingKeys.has(k) || isLocalDuplicate(k, ttlMs);
                              if (dup) continue;
                              try {
                                await createAgendaEvent(activePetId, {
                                  petId: activePetId,
                                  title: e.title,
                                  dueAt: e.dueAt,
                                  kind: e.kind,
                                  reminderMinutesBefore: Math.max(0, Number(e.reminderMinutesBefore ?? 60) || 0),
                                  createdAt,
                                  createdBy: user.uid,
                                });
                                markLocalDeduped(k);
                                okCount++;
                              } catch (err) {
                                errors.push(err instanceof Error ? err.message : "Salvataggio fallito");
                              }
                            }

                            if (okCount) {
                              pushToast({ type: "success", title: "Agenda", message: `Creati ${okCount} elementi (serie/eventi).` });
                            } else {
                              pushToast({ type: "info", title: "Agenda", message: "Nessun elemento creato (duplicati o nessuna selezione)." });
                            }
                            if (errors.length) {
                              setAiError(`Alcuni elementi non sono stati salvati:\n${errors.slice(0, 5).map((x) => `• ${x}`).join("\n")}`);
                            }
                            setAiSeries([]);
                            setAiSeriesSel({});
                            setAiBatch([]);
                            setAiBatchSel({});
                          } finally {
                            setAiBatchSaving(false);
                          }
                        }}
                      >
                        {aiBatchSaving ? "Salvataggio…" : "Conferma e salva"}
                      </button>
                    </div>
                  </div>
                ) : aiMode === "multi" && aiBatch.length ? (
                  <div className="lp-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Lista proposta</div>
                      <label className="inline-flex items-center gap-2 text-xs lp-muted">
                        <input
                          type="checkbox"
                          checked={aiBatch.length > 0 && aiBatch.every((e) => aiBatchSel[agendaEventDedupeKey(e.title, e.kind, e.dueAt)] === true)}
                          onChange={(ev) => {
                            const checked = ev.target.checked;
                            const next: Record<string, boolean> = { ...aiBatchSel };
                            for (const e of aiBatch) {
                              const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                              const dup = existingKeys.has(k) || isLocalDuplicate(k, 7 * 24 * 60 * 60 * 1000);
                              next[k] = checked ? !dup : false;
                            }
                            setAiBatchSel(next);
                          }}
                        />
                        Seleziona tutto
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {aiBatch.map((e) => {
                        const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                        const dup = existingKeys.has(k) || isLocalDuplicate(k, 7 * 24 * 60 * 60 * 1000);
                        const checked = Boolean(aiBatchSel[k]);
                        return (
                          <label key={k} className="flex items-start gap-3 lp-panel px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={dup}
                              onChange={(ev) => setAiBatchSel((s) => ({ ...s, [k]: ev.target.checked }))}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{e.title}</div>
                              <div className="text-xs lp-muted mt-1">{new Date(e.dueAt).toLocaleString()} · {e.kind}{dup ? " · già presente" : ""}</div>
                              {e.notes ? <div className="text-xs lp-muted mt-1 whitespace-pre-wrap">{e.notes}</div> : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 justify-end">
                      <button type="button" className="lp-btn-secondary" disabled={aiBatchSaving} onClick={() => { setAiBatch([]); setAiBatchSel({}); }}>
                        Chiudi
                      </button>
                      <button
                        type="button"
                        className="lp-btn-primary"
                        disabled={!user || !activePetId || aiBatchSaving || Object.values(aiBatchSel).every((v) => !v)}
                        onClick={async () => {
                          if (!user || !activePetId) return;
                          if (aiBatchSaving) return;
                          setAiBatchSaving(true);
                          setAiError(null);
                          const createdAt = Date.now();
                          const ttlMs = 14 * 24 * 60 * 60 * 1000;
                          const errors: string[] = [];
                          let okCount = 0;
                          try {
                            for (const e of aiBatch) {
                              const k = agendaEventDedupeKey(e.title, e.kind, e.dueAt);
                              if (!aiBatchSel[k]) continue;
                              const dup = existingKeys.has(k) || isLocalDuplicate(k, ttlMs);
                              if (dup) continue;
                              try {
                                await createAgendaEvent(activePetId, {
                                  petId: activePetId,
                                  title: e.title,
                                  dueAt: e.dueAt,
                                  kind: e.kind,
                                  reminderMinutesBefore: Math.max(0, Number(e.reminderMinutesBefore ?? 60) || 0),
                                  createdAt,
                                  createdBy: user.uid,
                                });
                                markLocalDeduped(k);
                                okCount++;
                              } catch (err) {
                                errors.push(err instanceof Error ? err.message : "Salvataggio fallito");
                              }
                            }

                            if (okCount) {
                              pushToast({ type: "success", title: "Agenda", message: `Creati ${okCount} eventi.` });
                            } else {
                              pushToast({ type: "info", title: "Agenda", message: "Nessun evento creato (duplicati o nessuna selezione)." });
                            }
                            if (errors.length) {
                              setAiError(`Alcuni eventi non sono stati salvati:\n${errors.slice(0, 5).map((x) => `• ${x}`).join("\n")}`);
                            }
                          } finally {
                            setAiBatchSaving(false);
                          }
                        }}
                      >
                        {aiBatchSaving ? "Salvataggio…" : "Conferma e salva"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Serie</CardTitle>
              <CardDescription>Ricorrenze attive/disattive e gestione eventi futuri.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activePetId ? (
                <EmptyState
                  title="Seleziona un pet"
                  description="Scegli un profilo per vedere le serie."
                  action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
                />
              ) : series.length === 0 ? (
                <div className="text-sm lp-muted">Nessuna serie. Creala dall’AI o dal campo “Ricorrenza”.</div>
              ) : !user ? (
                <div className="text-sm lp-muted">Accedi per modificare o eliminare le serie.</div>
              ) : (
                <SeriesManager petId={activePetId} userId={user.uid} series={series} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi evento</CardTitle>
          <CardDescription>Visite, toelettatura, training e promemoria.</CardDescription>
        </CardHeader>
        <CardContent>
          {inlineError ? (
            <div className="mb-3">
              <Alert variant="danger" title="Errore">{inlineError}</Alert>
            </div>
          ) : null}
          {!activePetId ? (
            <EmptyState
              title="Seleziona un pet"
              description="Scegli un profilo per aggiungere eventi."
              action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
            />
          ) : (
            <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_180px_200px_140px] gap-3 items-end">
            <label className="block">
              <div className="text-xs lp-muted mb-1">Titolo</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="lp-input"
                ref={createTitleRef}
              />
            </label>
            <label className="block">
              <div className="text-xs lp-muted mb-1">Data e ora</div>
              <div className="flex items-center gap-2">
                <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="datetime-local" required className="lp-input" />
                <button type="button" className="lp-btn-secondary whitespace-nowrap" onClick={() => setDueAt(toDatetimeLocal(Date.now()))}>
                  Ora
                </button>
              </div>
            </label>
            <label className="block">
              <div className="text-xs lp-muted mb-1">Tipo</div>
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
              <div className="text-xs lp-muted mb-1">Promemoria</div>
              <div className="relative">
                <Bell className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgb(var(--lp-muted))" }} />
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
              <div className="text-xs lp-muted mb-1">Ricorrenza</div>
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
                <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  Giorni
                </div>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((w) => (
                    <button
                      key={w.i}
                      type="button"
                      onClick={() => setWeekdays((prev) => (prev.includes(w.i) ? prev.filter((x) => x !== w.i) : [...prev, w.i]))}
                      className={
                        weekdays.includes(w.i)
                          ? "lp-chip lp-chip-active"
                          : "lp-chip"
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
          <CardTitle>Eventi</CardTitle>
          <CardDescription>Filtra e gestisci gli eventi nel periodo visibile.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState
            title="Seleziona un pet"
            description="Scegli un profilo per vedere l’agenda."
            action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
          />
        ) : !loaded ? (
          <div className="grid gap-2">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
          </div>
        ) : visibleEvents.length === 0 ? (
          <EmptyState
            title="Nessun evento"
            description="Aggiungi un promemoria o un appuntamento."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="lp-btn-primary" onClick={focusAddEvent}>
                  Aggiungi evento
                </button>
                {user ? (
                  <button type="button" className="lp-btn-secondary" onClick={() => void onSeedStarter()} disabled={seedingStarter}>
                    {seedingStarter ? "Creo…" : "Setup rapido"}
                  </button>
                ) : null}
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["vet", "Veterinario"],
                    ["grooming", "Toelettatura"],
                    ["training", "Training"],
                    ["cleaning", "Pulizia"],
                    ["other", "Altro"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter((s) => ({ ...s, [k]: !s[k] }))}
                    className={kindFilter[k] ? "lp-chip lp-chip-active" : "lp-chip"}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs lp-muted">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === visibleEvents.length}
                    onChange={(e) => {
                      const next = e.target.checked ? Object.fromEntries(visibleEvents.map((x) => [x.id, true])) : {};
                      setSelected(next);
                    }}
                  />
                  Seleziona tutto
                </label>
                {selectedIds.length ? (
                  <>
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => setSelected({})}>
                      Deseleziona
                    </button>
                    <button
                      type="button"
                      className="lp-btn-secondary px-3 py-2 text-xs"
                      onClick={async () => {
                        if (!activePetId) return;
                        const ok = await confirmDialog({
                          title: "Elimina eventi",
                          description: `Vuoi eliminare ${selectedIds.length} eventi selezionati?`,
                          confirmLabel: "Elimina",
                          variant: "danger",
                        });
                        if (!ok) return;
                        setInlineError(null);
                        try {
                          for (const id of selectedIds) await deleteAgendaEvent(activePetId, id);
                          setSelected({});
                          pushToast({ type: "success", title: "Agenda", message: "Eventi eliminati." });
                        } catch (err) {
                          setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
                          pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
                        }
                      }}
                    >
                      Elimina ({selectedIds.length})
                    </button>
                  </>
                ) : (
                  <div className="text-xs lp-muted">{visibleEvents.length} eventi</div>
                )}
              </div>
            </div>

            {visibleEvents.map((ev) => (
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
                        setInlineError(err instanceof Error ? err.message : "Salvataggio fallito");
                        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-[1fr_220px_200px_1fr] gap-3 items-end"
                  >
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Titolo</div>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="lp-input" />
                    </label>
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Data e ora</div>
                      <input value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} type="datetime-local" className="lp-input" />
                    </label>
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Tipo</div>
                      <select value={editKind} onChange={(e) => setEditKind(e.target.value as AgendaEvent["kind"])} className="lp-select">
                        <option value="vet">Veterinario</option>
                        <option value="grooming">Toelettatura</option>
                        <option value="training">Training</option>
                        <option value="cleaning">Pulizia</option>
                        <option value="other">Altro</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Promemoria</div>
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
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(selected[ev.id])}
                        onChange={(e) => setSelected((s) => ({ ...s, [ev.id]: e.target.checked }))}
                        aria-label="Seleziona evento"
                      />
                      <div className="min-w-0">
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-xs lp-muted">{ev.kind}</div>
                      <div className="text-xs lp-muted mt-1">{new Date(ev.dueAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(ev.id);
                          setEditTitle(ev.title);
                        setEditDueAt(toDatetimeLocal(ev.dueAt));
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
                          const ok = await confirmDialog({
                            title: "Elimina evento",
                            description: "Vuoi eliminare questo evento dall’agenda?",
                            confirmLabel: "Elimina",
                            variant: "danger",
                          });
                          if (!ok) return;
                          setDeletingId(ev.id);
                          setInlineError(null);
                          try {
                            await deleteAgendaEvent(activePetId, ev.id);
                            pushToast({ type: "success", title: "Evento eliminato", message: "Rimosso dall’agenda." });
                          } catch (err) {
                            setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
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

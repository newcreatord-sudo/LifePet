import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Clock, Pencil, Repeat, Sparkles, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { createTask, deleteTask, setTaskDone, subscribeTasks, updateTask } from "@/data/tasks";
import { createRoutine, deleteRoutine, seedEnabledRoutinesOncePerDay, setRoutineEnabled, subscribeRoutines, updateRoutine } from "@/data/routines";
import type { PetRoutine, RoutineKind, PetTask } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { useConfirmDialog } from "@/components/confirm";
import { PlannerAgendaTabs } from "@/components/PlannerAgendaTabs";
import { seedStarterKit } from "@/lib/starterKit";

export default function Planner() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const location = useLocation();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const confirmDialog = useConfirmDialog();
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [routines, setRoutines] = useState<PetRoutine[]>([]);
  const [loaded, setLoaded] = useState({ tasks: false, routines: false });
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selectedDue, setSelectedDue] = useState<Record<string, boolean>>({});
  const [selectedDone, setSelectedDone] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const createTaskTitleRef = useRef<HTMLInputElement | null>(null);
  const [seedingStarter, setSeedingStarter] = useState(false);

  const [routineTitle, setRoutineTitle] = useState("");
  const [routineKind, setRoutineKind] = useState<RoutineKind>("food");
  const [routineTimes, setRoutineTimes] = useState("08:00, 19:00");
  const [routineRecurrenceType, setRoutineRecurrenceType] = useState<"daily" | "weekly">("daily");
  const [routineWeekdays, setRoutineWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [creatingRoutine, setCreatingRoutine] = useState(false);

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editRoutineTitle, setEditRoutineTitle] = useState("");
  const [editRoutineKind, setEditRoutineKind] = useState<RoutineKind>("food");
  const [editRoutineTimes, setEditRoutineTimes] = useState("");
  const [editRoutineRecurrenceType, setEditRoutineRecurrenceType] = useState<"daily" | "weekly">("daily");
  const [editRoutineWeekdays, setEditRoutineWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingRoutine, setSavingRoutine] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDueAt, setEditTaskDueAt] = useState<string>("");
  const [savingTask, setSavingTask] = useState(false);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  function focusCreateTask() {
    createTaskTitleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    createTaskTitleRef.current?.focus();
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

  function toLocalDatetimeInputValue(ms: number) {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function setDuePreset(daysFromNow: number, hh: number, mm: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hh, mm, 0, 0);
    setDueAt(toLocalDatetimeInputValue(d.getTime()));
  }

  function parseTimesInput(raw: string) {
    const tokens = raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (tokens.length === 0) return { times: [] as string[], error: "Inserisci almeno un orario (es. 08:00)." };
    const out: string[] = [];
    for (const t of tokens) {
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return { times: [], error: `Orario non valido: ${t}` };
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        return { times: [], error: `Orario non valido: ${t}` };
      }
      const norm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      if (!out.includes(norm)) out.push(norm);
    }
    out.sort();
    return { times: out };
  }

  useEffect(() => {
    if (!activePetId || !user) {
      setTasks([]);
      setLoaded((s) => ({ ...s, tasks: false }));
      setSelectedDue({});
      setSelectedDone({});
      return;
    }
    setLoaded((s) => ({ ...s, tasks: false }));
    setInlineError(null);
    const unsub = subscribeTasks(
      activePetId,
      user.uid,
      (items) => {
        setTasks(items);
        setLoaded((s) => ({ ...s, tasks: true }));
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento task fallito");
        setLoaded((s) => ({ ...s, tasks: true }));
      }
    );
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const params = new URLSearchParams(location.search);
    const completeTaskId = params.get("completeTaskId");
    if (!completeTaskId) return;
    void (async () => {
      try {
        await setTaskDone(activePetId, completeTaskId, true, Date.now());
        pushToast({ type: "success", title: "Task completato", message: "Segnato come fatto." });
      } catch (err) {
        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Operazione fallita" });
      } finally {
        params.delete("completeTaskId");
        navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
      }
    })();
  }, [activePetId, location.pathname, location.search, navigate, pushToast, user]);

  useEffect(() => {
    if (!activePetId) return;
    setLoaded((s) => ({ ...s, routines: false }));
    setInlineError(null);
    const unsub = subscribeRoutines(
      activePetId,
      (items) => {
        setRoutines(items);
        setLoaded((s) => ({ ...s, routines: true }));
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento routine fallito");
        setLoaded((s) => ({ ...s, routines: true }));
      }
    );
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    void (async () => {
      try {
        await seedEnabledRoutinesOncePerDay(activePetId, routines);
      } catch (err) {
        setInlineError(err instanceof Error ? err.message : "Generazione task routine fallita");
        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Generazione task routine fallita" });
      }
    })();
  }, [activePetId, pushToast, routines]);

  const due = useMemo(() => {
    return tasks
      .filter((t) => t.status === "due")
      .slice()
      .sort((a, b) => {
        const ad = typeof a.dueAt === "number" ? a.dueAt : Number.POSITIVE_INFINITY;
        const bd = typeof b.dueAt === "number" ? b.dueAt : Number.POSITIVE_INFINITY;
        return ad - bd || b.createdAt - a.createdAt;
      });
  }, [tasks]);
  const done = useMemo(() => {
    return tasks
      .filter((t) => t.status === "done")
      .slice()
      .sort((a, b) => {
        const ac = typeof a.completedAt === "number" ? a.completedAt : 0;
        const bc = typeof b.completedAt === "number" ? b.completedAt : 0;
        return bc - ac || b.createdAt - a.createdAt;
      });
  }, [tasks]);
  const selectedDueIds = useMemo(() => due.filter((t) => selectedDue[t.id]).map((t) => t.id), [due, selectedDue]);
  const selectedDoneIds = useMemo(() => done.filter((t) => selectedDone[t.id]).map((t) => t.id), [done, selectedDone]);
  const selectedDueCount = selectedDueIds.length;
  const selectedDoneCount = selectedDoneIds.length;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const t = title.trim();
    if (!t) {
      pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per il task." });
      return;
    }
    setCreating(true);
    setInlineError(null);
    try {
      const parsed = dueAt ? new Date(dueAt).getTime() : undefined;
      const dueMs = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
      await createTask(activePetId, {
        petId: activePetId,
        title: t,
        dueAt: dueMs,
        status: "due",
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setTitle("");
      setDueAt("");
      pushToast({ type: "success", title: "Task creato", message: "Aggiunto alla lista." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Creazione task fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione task fallita" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: PetTask, done: boolean) {
    if (!activePetId) return;
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);
    setInlineError(null);
    try {
      await setTaskDone(activePetId, task.id, done, Date.now());
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Aggiornamento task fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Aggiornamento task fallito" });
    } finally {
      setTogglingTaskId(null);
    }
  }

  async function batchSetDone(ids: string[], done: boolean) {
    if (!activePetId || !ids.length) return;
    if (togglingTaskId) return;
    setTogglingTaskId("__batch__");
    setInlineError(null);
    try {
      for (const id of ids) {
        await setTaskDone(activePetId, id, done, Date.now());
      }
      pushToast({ type: "success", title: "Planner", message: done ? "Task completati." : "Task ripristinati." });
      if (done) setSelectedDue({});
      else setSelectedDone({});
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Operazione batch fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Operazione batch fallita" });
    } finally {
      setTogglingTaskId(null);
    }
  }

  async function batchDelete(ids: string[]) {
    if (!activePetId || !ids.length) return;
    if (deletingTaskId) return;
    const ok = await confirmDialog({
      title: "Elimina task",
      description: `Vuoi eliminare ${ids.length} task selezionati?`,
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingTaskId("__batch__");
    setInlineError(null);
    try {
      for (const id of ids) {
        await deleteTask(activePetId, id);
      }
      pushToast({ type: "success", title: "Planner", message: "Task eliminati." });
      setSelectedDue({});
      setSelectedDone({});
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Eliminazione batch fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione batch fallita" });
    } finally {
      setDeletingTaskId(null);
    }
  }

  async function onCreateRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const t = routineTitle.trim();
    if (!t) {
      pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per la routine." });
      return;
    }
    const parsedTimes = parseTimesInput(routineTimes);
    if (parsedTimes.error) {
      pushToast({ type: "error", title: "Orari non validi", message: parsedTimes.error });
      return;
    }

    setCreatingRoutine(true);
    try {
      await createRoutine(activePetId, {
        petId: activePetId,
        title: t,
        kind: routineKind,
        enabled: true,
        times: parsedTimes.times,
        recurrence:
          routineRecurrenceType === "weekly"
            ? { type: "weekly", weekdays: routineWeekdays.length ? routineWeekdays : [new Date().getDay()] }
            : { type: "daily" },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setRoutineTitle("");
      pushToast({ type: "success", title: "Routine creata", message: "Genererà task automaticamente." });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione routine fallita" });
    } finally {
      setCreatingRoutine(false);
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

  function parseRecurrenceType(v: string): "daily" | "weekly" {
    return v === "weekly" ? "weekly" : "daily";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planner"
        description="Routine e task, per una cura costante e senza stress."
        imagePrompt="minimal clean illustration, checklist and calendar for pet care routine, soft pastel background, accent color, premium, no text, no watermark"
        imageAlt="Planner"
        actions={
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            onClick={() => openWithDraft("Aiutami a creare un planner: proponi 5 routine utili (con orari) e 5 task per oggi. Se mancano info, fammi domande.")}
            disabled={!activePetId}
          >
            <Sparkles className="w-4 h-4" />
            AI planner
          </button>
        }
      />

      {inlineError ? <Alert variant="danger" title="Errore">{inlineError}</Alert> : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <PlannerAgendaTabs />

          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="lp-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs lp-muted">Da fare</div>
                      <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{due.length}</div>
                      <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Task aperti</div>
                    </div>
                    <CalendarCheck className="w-5 h-5 lp-icon-primary" />
                  </div>
                </div>
                <div className="lp-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs lp-muted">Completati</div>
                      <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{done.length}</div>
                      <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Storico recente</div>
                    </div>
                    <Clock className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
                  </div>
                </div>
                <div className="lp-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs lp-muted">Routine</div>
                      <div className="text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{routines.filter((r) => r.enabled).length}</div>
                      <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Attive</div>
                    </div>
                    <Repeat className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
                  </div>
                  {activePetId ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link to={{ pathname: "/app/health", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-chip">Collega a Salute</Link>
                      <Link to={{ pathname: "/app/documents", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-chip">Allega documenti</Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="relative overflow-hidden">
              <div className="lp-card-accent" aria-hidden="true" />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Da fare</CardTitle>
                    <CardDescription>Task aperti per il pet attivo</CardDescription>
                  </div>
                  <div className="lp-mini-ill" aria-hidden="true" />
                  {selectedDueCount ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="lp-btn-secondary px-3 py-2 text-xs"
                        onClick={() => setSelectedDue({})}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Deseleziona
                      </button>
                      <button
                        type="button"
                        className="lp-btn-secondary px-3 py-2 text-xs"
                        onClick={() => void batchDelete(selectedDueIds)}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Elimina ({selectedDueCount})
                      </button>
                      <button
                        type="button"
                        className="lp-btn-primary px-3 py-2 text-xs"
                        onClick={() => void batchSetDone(selectedDueIds, true)}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Fatto ({selectedDueCount})
                      </button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
              {!loaded.tasks ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : due.length === 0 ? (
                <EmptyState
                  title="Nessun task aperto"
                  description="Crea il primo task o una routine: l’app diventa utile subito."
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="lp-btn-primary" onClick={focusCreateTask}>
                        Crea task
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
                  <div className="flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs lp-muted">
                      <input
                        type="checkbox"
                        checked={selectedDueCount > 0 && selectedDueCount === due.length}
                        onChange={(e) => {
                          const next = e.target.checked ? Object.fromEntries(due.map((t) => [t.id, true])) : {};
                          setSelectedDue(next);
                        }}
                      />
                      Seleziona tutto
                    </label>
                    <div className="text-xs lp-muted">{due.length} task</div>
                  </div>
                  {due.map((t) => (
                    <div key={t.id} className="lp-panel px-3 py-2">
                      {editingTaskId === t.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!activePetId) return;
                            const nextTitle = editTaskTitle.trim();
                            if (!nextTitle) {
                              pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per il task." });
                              return;
                            }
                            setSavingTask(true);
                            try {
                              const parsed = editTaskDueAt ? new Date(editTaskDueAt).getTime() : undefined;
                              const dueMs = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
                              await updateTask(activePetId, t.id, { title: nextTitle, dueAt: dueMs });
                              setEditingTaskId(null);
                              pushToast({ type: "success", title: "Task aggiornato", message: "Salvataggio completato." });
                            } catch (err) {
                              pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio task fallito" });
                            } finally {
                              setSavingTask(false);
                            }
                          }}
                          className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-end"
                        >
                          <label className="block">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Titolo</div>
                            <input value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} className="lp-input" />
                          </label>
                          <label className="block">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Scadenza</div>
                            <input value={editTaskDueAt} onChange={(e) => setEditTaskDueAt(e.target.value)} type="datetime-local" className="lp-input" />
                          </label>
                          <div className="md:col-span-2 flex items-center gap-2 justify-end">
                            <button type="button" onClick={() => setEditingTaskId(null)} className="lp-btn-secondary px-3 py-2 text-xs">Annulla</button>
                            <button disabled={savingTask} type="submit" className="lp-btn-primary px-3 py-2 text-xs disabled:opacity-60">
                              {savingTask ? "Salvataggio…" : "Salva"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={Boolean(selectedDue[t.id])}
                              onChange={(e) => setSelectedDue((s) => ({ ...s, [t.id]: e.target.checked }))}
                              aria-label="Seleziona task"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{t.title}</div>
                              <div className="text-xs lp-muted">{t.dueAt ? new Date(t.dueAt).toLocaleString() : "Senza orario"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTaskId(t.id);
                                setEditTaskTitle(t.title);
                                setEditTaskDueAt(t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 16) : "");
                              }}
                              className="lp-btn-secondary px-3 py-2 text-xs"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!activePetId) return;
                                if (deletingTaskId) return;
                                const ok = await confirmDialog({
                                  title: "Elimina task",
                                  description: "Vuoi eliminare questo task?",
                                  confirmLabel: "Elimina",
                                  variant: "danger",
                                });
                                if (!ok) return;
                                setDeletingTaskId(t.id);
                                try {
                                  await deleteTask(activePetId, t.id);
                                  pushToast({ type: "success", title: "Task eliminato", message: "Rimosso." });
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione task fallita" });
                                } finally {
                                  setDeletingTaskId(null);
                                }
                              }}
                              className="lp-btn-secondary px-3 py-2 text-xs"
                              disabled={deletingTaskId === t.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleDone(t, true)} className="lp-btn-secondary px-3 py-2 text-xs" disabled={togglingTaskId === t.id}>
                              Fatto
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

            <Card className="relative overflow-hidden">
              <div className="lp-card-accent" aria-hidden="true" />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Completati</CardTitle>
                    <CardDescription>Cronologia dei task completati</CardDescription>
                  </div>
                  <div className="lp-mini-ill" aria-hidden="true" />
                  {selectedDoneCount ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="lp-btn-secondary px-3 py-2 text-xs"
                        onClick={() => setSelectedDone({})}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Deseleziona
                      </button>
                      <button
                        type="button"
                        className="lp-btn-secondary px-3 py-2 text-xs"
                        onClick={() => void batchDelete(selectedDoneIds)}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Elimina ({selectedDoneCount})
                      </button>
                      <button
                        type="button"
                        className="lp-btn-primary px-3 py-2 text-xs"
                        onClick={() => void batchSetDone(selectedDoneIds, false)}
                        disabled={togglingTaskId === "__batch__" || deletingTaskId === "__batch__"}
                      >
                        Ripristina ({selectedDoneCount})
                      </button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
              {!loaded.tasks ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : done.length === 0 ? (
                <EmptyState title="Ancora niente qui" description="Quando completi un task, lo trovi in questa lista." />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs lp-muted">
                      <input
                        type="checkbox"
                        checked={selectedDoneCount > 0 && selectedDoneCount === done.length}
                        onChange={(e) => {
                          const next = e.target.checked ? Object.fromEntries(done.map((t) => [t.id, true])) : {};
                          setSelectedDone(next);
                        }}
                      />
                      Seleziona tutto
                    </label>
                    <div className="text-xs lp-muted">{done.length} task</div>
                  </div>
                  {done.map((t) => (
                    <div key={t.id} className="lp-panel px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(selectedDone[t.id])}
                            onChange={(e) => setSelectedDone((s) => ({ ...s, [t.id]: e.target.checked }))}
                            aria-label="Seleziona task completato"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{t.title}</div>
                            <div className="text-xs lp-muted">Fatto: {t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (!activePetId) return;
                              if (deletingTaskId) return;
                              const ok = await confirmDialog({
                                title: "Elimina task",
                                description: "Vuoi eliminare questo task?",
                                confirmLabel: "Elimina",
                                variant: "danger",
                              });
                              if (!ok) return;
                              setDeletingTaskId(t.id);
                              try {
                                await deleteTask(activePetId, t.id);
                                pushToast({ type: "success", title: "Task eliminato", message: "Rimosso." });
                              } catch (err) {
                                pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione task fallita" });
                              } finally {
                                setDeletingTaskId(null);
                              }
                            }}
                            className="lp-btn-secondary px-3 py-2 text-xs"
                            disabled={deletingTaskId === t.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleDone(t, false)} className="lp-btn-secondary px-3 py-2 text-xs" disabled={togglingTaskId === t.id}>
                            Annulla
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit max-h-[calc(100vh-7rem)] overflow-auto pr-1">
          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Crea task</CardTitle>
                  <CardDescription>Piccole cose, fatte bene e al momento giusto.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <EmptyState
                title="Seleziona un pet"
                description="Scegli un profilo per creare task."
                action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
              />
            ) : (
              <form onSubmit={onCreate} className="grid grid-cols-1 gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titolo task"
                  required
                  className="lp-input"
                  ref={createTaskTitleRef}
                />
                <div className="space-y-2">
                  <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="datetime-local" className="lp-input" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="lp-chip" onClick={() => setDuePreset(0, 18, 0)}>
                      Oggi 18:00
                    </button>
                    <button type="button" className="lp-chip" onClick={() => setDuePreset(1, 9, 0)}>
                      Domani 09:00
                    </button>
                    <button type="button" className="lp-chip" onClick={() => setDuePreset(7, 9, 0)}>
                      +7 giorni
                    </button>
                    {dueAt ? (
                      <button type="button" className="lp-chip" onClick={() => setDueAt("")}>Nessuna scadenza</button>
                    ) : null}
                  </div>
                </div>
                <button disabled={creating} className="lp-btn-primary disabled:opacity-60" type="submit">
                  {creating ? "Aggiunta…" : "Aggiungi"}
                </button>
              </form>
            )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Routine</CardTitle>
                  <CardDescription>Crea abitudini quotidiane e genera task automatici.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <EmptyState
                title="Seleziona un pet"
                description="Scegli un profilo per gestire le routine."
                action={<Link to="/app/pets" className="lp-btn-primary inline-flex items-center justify-center">Apri profilo pet</Link>}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <form onSubmit={onCreateRoutine} className="space-y-3">
              <label className="block">
                <div className="text-xs lp-muted mb-1">Titolo</div>
                <input
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  placeholder="Pasto serale"
                  className="lp-input"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Tipo</div>
                  <select
                    value={routineKind}
                    onChange={(e) => setRoutineKind(e.target.value as RoutineKind)}
                    className="lp-select"
                  >
                    <option value="food">Cibo</option>
                    <option value="med">Farmaco</option>
                    <option value="walk">Passeggiata</option>
                    <option value="training">Training</option>
                    <option value="grooming">Toelettatura</option>
                    <option value="cleaning">Pulizia</option>
                    <option value="other">Altro</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Orari (separati da virgola)</div>
                  <input
                    value={routineTimes}
                    onChange={(e) => setRoutineTimes(e.target.value)}
                    placeholder="08:00, 19:00"
                    className="lp-input"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Ricorrenza</div>
                  <select value={routineRecurrenceType} onChange={(e) => setRoutineRecurrenceType(parseRecurrenceType(e.target.value))} className="lp-select">
                    <option value="daily">Giornaliera</option>
                    <option value="weekly">Settimanale</option>
                  </select>
                </label>

                {routineRecurrenceType === "weekly" ? (
                  <div>
                    <div className="text-xs lp-muted mb-1">Giorni</div>
                    <div className="flex flex-wrap gap-2">
                      {weekdayOptions.map((w) => (
                        <button
                          key={w.i}
                          type="button"
                          onClick={() =>
                            setRoutineWeekdays((prev) =>
                              prev.includes(w.i) ? prev.filter((x) => x !== w.i) : [...prev, w.i]
                            )
                          }
                          className={
                            routineWeekdays.includes(w.i)
                              ? "rounded-xl lp-primary-soft px-3 py-2 text-xs"
                              : "rounded-xl lp-panel px-3 py-2 text-xs"
                          }
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                disabled={creatingRoutine}
                className="w-full lp-btn-primary"
                type="submit"
              >
                {creatingRoutine ? "Creazione…" : "Crea routine"}
              </button>
              <div className="text-xs lp-muted">Le routine generano task per i prossimi 7 giorni (senza duplicati).</div>
            </form>

            <div className="max-h-[520px] overflow-auto pr-1">
              {!loaded.routines ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : routines.length === 0 ? (
                <EmptyState title="Nessuna routine" description="Crea la prima routine per trasformare abitudini in task." />
              ) : (
                <div className="space-y-2">
                  {routines.map((r) => (
                    <div key={r.id} className="lp-panel px-3 py-2">
                      {editingRoutineId === r.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!activePetId) return;
                            const t = editRoutineTitle.trim();
                            const parsedTimes = parseTimesInput(editRoutineTimes);
                            if (!t) {
                              pushToast({ type: "error", title: "Titolo obbligatorio", message: "Inserisci un titolo per la routine." });
                              return;
                            }
                            if (parsedTimes.error) {
                              pushToast({ type: "error", title: "Orari non validi", message: parsedTimes.error });
                              return;
                            }
                            setSavingRoutine(true);
                            try {
                              await updateRoutine(activePetId, r.id, {
                                title: t,
                                kind: editRoutineKind,
                                times: parsedTimes.times,
                                recurrence:
                                  editRoutineRecurrenceType === "weekly"
                                    ? { type: "weekly", weekdays: editRoutineWeekdays.length ? editRoutineWeekdays : [new Date().getDay()] }
                                    : { type: "daily" },
                              });
                              setEditingRoutineId(null);
                              pushToast({ type: "success", title: "Routine aggiornata", message: "Salvataggio completato." });
                            } catch (err) {
                              pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio routine fallito" });
                            } finally {
                              setSavingRoutine(false);
                            }
                          }}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <label className="block sm:col-span-2">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Titolo</div>
                            <input
                              value={editRoutineTitle}
                              onChange={(e) => setEditRoutineTitle(e.target.value)}
                              className="lp-input"
                            />
                          </label>
                          <label className="block">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Tipo</div>
                            <select
                              value={editRoutineKind}
                              onChange={(e) => setEditRoutineKind(e.target.value as RoutineKind)}
                              className="lp-select"
                            >
                              <option value="food">Cibo</option>
                              <option value="med">Farmaco</option>
                              <option value="walk">Passeggiata</option>
                              <option value="training">Training</option>
                              <option value="grooming">Toelettatura</option>
                              <option value="cleaning">Pulizia</option>
                              <option value="other">Altro</option>
                            </select>
                          </label>
                          <label className="block">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Orari</div>
                            <input
                              value={editRoutineTimes}
                              onChange={(e) => setEditRoutineTimes(e.target.value)}
                              className="lp-input"
                            />
                          </label>

                          <label className="block">
                            <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Ricorrenza</div>
                            <select
                              value={editRoutineRecurrenceType}
                              onChange={(e) => setEditRoutineRecurrenceType(parseRecurrenceType(e.target.value))}
                              className="lp-select"
                            >
                              <option value="daily">Giornaliera</option>
                              <option value="weekly">Settimanale</option>
                            </select>
                          </label>

                          {editRoutineRecurrenceType === "weekly" ? (
                            <div className="sm:col-span-2">
                              <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Giorni</div>
                              <div className="flex flex-wrap gap-2">
                                {weekdayOptions.map((w) => (
                                  <button
                                    key={w.i}
                                    type="button"
                                    onClick={() =>
                                      setEditRoutineWeekdays((prev) =>
                                        prev.includes(w.i) ? prev.filter((x) => x !== w.i) : [...prev, w.i]
                                      )
                                    }
                                    className={
                                      editRoutineWeekdays.includes(w.i)
                                        ? "rounded-xl lp-primary-soft px-3 py-2 text-xs"
                                        : "rounded-xl lp-panel px-3 py-2 text-xs"
                                    }
                                  >
                                    {w.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="sm:col-span-2 flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingRoutineId(null)}
                              className="lp-btn-secondary px-3 py-2 text-xs"
                            >
                              Annulla
                            </button>
                            <button
                              disabled={savingRoutine}
                              type="submit"
                              className="lp-btn-primary px-3 py-2 text-xs disabled:opacity-60"
                            >
                              {savingRoutine ? "Salvataggio…" : "Salva"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{r.title}</div>
                            <div className="text-xs lp-muted">
                              {r.kind} · {r.times.join(", ")}
                              {r.recurrence.type === "weekly" ? ` · ${r.recurrence.weekdays.join("/")}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingRoutineId(r.id);
                                setEditRoutineTitle(r.title);
                                setEditRoutineKind(r.kind);
                                setEditRoutineTimes(r.times.join(", "));
                                setEditRoutineRecurrenceType(r.recurrence.type);
                                setEditRoutineWeekdays(r.recurrence.type === "weekly" ? r.recurrence.weekdays : [1, 2, 3, 4, 5]);
                              }}
                              className="lp-btn-secondary px-3 py-2 text-xs"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!activePetId) return;
                                if (deletingRoutineId) return;
                                const ok = await confirmDialog({
                                  title: "Elimina routine",
                                  description: "Vuoi eliminare questa routine?",
                                  confirmLabel: "Elimina",
                                  variant: "danger",
                                });
                                if (!ok) return;
                                setDeletingRoutineId(r.id);
                                try {
                                  await deleteRoutine(activePetId, r.id);
                                  pushToast({ type: "success", title: "Routine eliminata", message: "Rimossa." });
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione routine fallita" });
                                } finally {
                                  setDeletingRoutineId(null);
                                }
                              }}
                              className="lp-btn-secondary px-3 py-2 text-xs"
                              disabled={deletingRoutineId === r.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!activePetId) return;
                                try {
                                  await setRoutineEnabled(activePetId, r.id, !r.enabled);
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Aggiornamento routine fallito" });
                                }
                              }}
                              className={
                                r.enabled
                                  ? "lp-btn-primary px-3 py-2 text-xs"
                                  : "lp-btn-secondary px-3 py-2 text-xs"
                              }
                            >
                              {r.enabled ? "Attiva" : "Disattiva"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

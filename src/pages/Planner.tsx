import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createTask, deleteTask, setTaskDone, subscribeTasks, updateTask } from "@/data/tasks";
import { createRoutine, deleteRoutine, seedEnabledRoutinesOncePerDay, setRoutineEnabled, subscribeRoutines, updateRoutine } from "@/data/routines";
import type { PetRoutine, RoutineKind, PetTask } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Planner() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [routines, setRoutines] = useState<PetRoutine[]>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeTasks(activePetId, setTasks);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const params = new URLSearchParams(location.search);
    const completeTaskId = params.get("completeTaskId");
    if (!completeTaskId) return;
    void (async () => {
      await setTaskDone(activePetId, completeTaskId, true, Date.now());
      params.delete("completeTaskId");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    })();
  }, [activePetId, location.pathname, location.search, navigate, user]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRoutines(activePetId, setRoutines);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    void seedEnabledRoutinesOncePerDay(activePetId, routines);
  }, [activePetId, routines]);

  const due = useMemo(() => tasks.filter((t) => t.status === "due"), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    setCreating(true);
    try {
      const dueMs = dueAt ? new Date(dueAt).getTime() : undefined;
      await createTask(activePetId, {
        petId: activePetId,
        title: title.trim(),
        dueAt: dueMs,
        status: "due",
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setTitle("");
      setDueAt("");
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: PetTask, done: boolean) {
    if (!activePetId) return;
    await setTaskDone(activePetId, task.id, done, Date.now());
  }

  async function onCreateRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const t = routineTitle.trim();
    if (!t) return;
    const times = routineTimes
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (times.length === 0) return;

    setCreatingRoutine(true);
    try {
      await createRoutine(activePetId, {
        petId: activePetId,
        title: t,
        kind: routineKind,
        enabled: true,
        times,
        recurrence:
          routineRecurrenceType === "weekly"
            ? { type: "weekly", weekdays: routineWeekdays.length ? routineWeekdays : [new Date().getDay()] }
            : { type: "daily" },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setRoutineTitle("");
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
      <PageHeader title="Planner" description="Routine e task, per una cura costante e senza stress." />

      <Card>
        <CardHeader>
          <CardTitle>Routine</CardTitle>
          <CardDescription>Crea abitudini quotidiane e genera task automatici.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per gestire le routine." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <form onSubmit={onCreateRoutine} className="lg:col-span-5 space-y-3">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Titolo</div>
                <input
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  placeholder="Pasto serale"
                  className="lp-input"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Tipo</div>
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
                  <div className="text-xs text-slate-600 mb-1">Orari (separati da virgola)</div>
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
                  <div className="text-xs text-slate-600 mb-1">Ricorrenza</div>
                  <select value={routineRecurrenceType} onChange={(e) => setRoutineRecurrenceType(parseRecurrenceType(e.target.value))} className="lp-select">
                    <option value="daily">Giornaliera</option>
                    <option value="weekly">Settimanale</option>
                  </select>
                </label>

                {routineRecurrenceType === "weekly" ? (
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Giorni</div>
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
                              ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-xs text-fuchsia-800"
                              : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
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
              <div className="text-xs text-slate-600">Le routine generano task per i prossimi 7 giorni (senza duplicati).</div>
            </form>

            <div className="lg:col-span-7">
              {routines.length === 0 ? (
                <EmptyState title="Nessuna routine" description="Crea la prima routine per trasformare abitudini in task." />
              ) : (
                <div className="space-y-2">
                  {routines.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                      {editingRoutineId === r.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!activePetId) return;
                            const t = editRoutineTitle.trim();
                            const times = editRoutineTimes
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean);
                            if (!t || times.length === 0) return;
                            setSavingRoutine(true);
                            try {
                              await updateRoutine(activePetId, r.id, {
                                title: t,
                                kind: editRoutineKind,
                                times,
                                recurrence:
                                  editRoutineRecurrenceType === "weekly"
                                    ? { type: "weekly", weekdays: editRoutineWeekdays.length ? editRoutineWeekdays : [new Date().getDay()] }
                                    : { type: "daily" },
                              });
                              setEditingRoutineId(null);
                            } finally {
                              setSavingRoutine(false);
                            }
                          }}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <label className="block sm:col-span-2">
                            <div className="text-xs text-slate-400 mb-1">Titolo</div>
                            <input
                              value={editRoutineTitle}
                              onChange={(e) => setEditRoutineTitle(e.target.value)}
                              className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block">
                            <div className="text-xs text-slate-400 mb-1">Tipo</div>
                            <select
                              value={editRoutineKind}
                              onChange={(e) => setEditRoutineKind(e.target.value as RoutineKind)}
                              className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
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
                            <div className="text-xs text-slate-400 mb-1">Orari</div>
                            <input
                              value={editRoutineTimes}
                              onChange={(e) => setEditRoutineTimes(e.target.value)}
                              className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
                            />
                          </label>

                          <label className="block">
                            <div className="text-xs text-slate-400 mb-1">Ricorrenza</div>
                            <select
                              value={editRoutineRecurrenceType}
                              onChange={(e) => setEditRoutineRecurrenceType(parseRecurrenceType(e.target.value))}
                              className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
                            >
                              <option value="daily">Giornaliera</option>
                              <option value="weekly">Settimanale</option>
                            </select>
                          </label>

                          {editRoutineRecurrenceType === "weekly" ? (
                            <div className="sm:col-span-2">
                              <div className="text-xs text-slate-400 mb-1">Giorni</div>
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
                                        ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-xs text-fuchsia-800"
                                        : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
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
                              className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                            >
                              Annulla
                            </button>
                            <button
                              disabled={savingRoutine}
                              type="submit"
                              className="rounded-xl bg-fuchsia-600 text-white px-3 py-2 text-xs font-medium hover:bg-fuchsia-500 disabled:opacity-60"
                            >
                              {savingRoutine ? "Salvataggio…" : "Salva"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{r.title}</div>
                            <div className="text-xs text-slate-600">
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
                              className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!activePetId) return;
                                if (!confirm("Eliminare questa routine?")) return;
                                await deleteRoutine(activePetId, r.id);
                              }}
                              className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => activePetId && setRoutineEnabled(activePetId, r.id, !r.enabled)}
                              className={
                                r.enabled
                                  ? "rounded-xl bg-fuchsia-600 text-white px-3 py-2 text-xs font-medium hover:bg-fuchsia-500"
                                  : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
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

      <Card>
        <CardHeader>
          <CardTitle>Crea task</CardTitle>
          <CardDescription>Piccole cose, fatte bene e al momento giusto.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per creare task." />
        ) : (
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-[1fr_220px_140px] gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo task"
              required
              className="rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/30"
            />
            <input
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              type="datetime-local"
              className="rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/30"
            />
            <button
              disabled={creating}
              className="rounded-xl bg-fuchsia-600 text-white px-4 py-2 text-sm font-medium hover:bg-fuchsia-500 disabled:opacity-60"
              type="submit"
            >
              {creating ? "Aggiunta…" : "Aggiungi"}
            </button>
          </form>
        )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Da fare</CardTitle>
            <CardDescription>Task aperti per il pet attivo</CardDescription>
          </CardHeader>
          <CardContent>
          {due.length === 0 ? (
            <EmptyState title="Nessun task aperto" description="Ottimo: qui compariranno le prossime attività." />
          ) : (
            <div className="space-y-2">
              {due.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                  {editingTaskId === t.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!activePetId) return;
                        setSavingTask(true);
                        try {
                          const dueMs = editTaskDueAt ? new Date(editTaskDueAt).getTime() : undefined;
                          await updateTask(activePetId, t.id, { title: editTaskTitle.trim(), dueAt: dueMs });
                          setEditingTaskId(null);
                        } finally {
                          setSavingTask(false);
                        }
                      }}
                      className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-end"
                    >
                      <label className="block">
                        <div className="text-xs text-slate-400 mb-1">Titolo</div>
                        <input
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                          className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs text-slate-400 mb-1">Scadenza</div>
                        <input
                          value={editTaskDueAt}
                          onChange={(e) => setEditTaskDueAt(e.target.value)}
                          type="datetime-local"
                          className="w-full rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="md:col-span-2 flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                        >
                          Annulla
                        </button>
                        <button
                          disabled={savingTask}
                          type="submit"
                          className="rounded-xl bg-fuchsia-600 text-white px-3 py-2 text-xs font-medium hover:bg-fuchsia-500 disabled:opacity-60"
                        >
                          {savingTask ? "Salvataggio…" : "Salva"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-xs text-slate-500">{t.dueAt ? new Date(t.dueAt).toLocaleString() : "Senza orario"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingTaskId(t.id);
                            setEditTaskTitle(t.title);
                            setEditTaskDueAt(t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 16) : "");
                          }}
                          className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!activePetId) return;
                            if (!confirm("Eliminare questo task?")) return;
                            await deleteTask(activePetId, t.id);
                          }}
                          className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleDone(t, true)}
                          className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                        >
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

        <Card>
          <CardHeader>
            <CardTitle>Completati</CardTitle>
            <CardDescription>Cronologia dei task completati</CardDescription>
          </CardHeader>
          <CardContent>
          {done.length === 0 ? (
            <EmptyState title="Ancora niente qui" description="Quando completi un task, lo trovi in questa lista." />
          ) : (
            <div className="space-y-2">
              {done.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-slate-500">Fatto: {t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          if (!confirm("Eliminare questo task?")) return;
                          await deleteTask(activePetId, t.id);
                        }}
                        className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleDone(t, false)}
                        className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
                      >
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
  );
}

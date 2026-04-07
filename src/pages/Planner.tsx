import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createTask, deleteTask, setTaskDone, subscribeTasks, updateTask } from "@/data/tasks";
import { createRoutine, deleteRoutine, setRoutineEnabled, subscribeRoutines, updateRoutine } from "@/data/routines";
import type { PetRoutine, RoutineKind, PetTask } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Planner() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [routines, setRoutines] = useState<PetRoutine[]>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [routineTitle, setRoutineTitle] = useState("");
  const [routineKind, setRoutineKind] = useState<RoutineKind>("food");
  const [routineTimes, setRoutineTimes] = useState("08:00, 19:00");
  const [creatingRoutine, setCreatingRoutine] = useState(false);

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editRoutineTitle, setEditRoutineTitle] = useState("");
  const [editRoutineKind, setEditRoutineKind] = useState<RoutineKind>("food");
  const [editRoutineTimes, setEditRoutineTimes] = useState("");
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
    if (!activePetId) return;
    const unsub = subscribeRoutines(activePetId, setRoutines);
    return () => unsub();
  }, [activePetId]);

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
        recurrence: { type: "daily" },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setRoutineTitle("");
    } finally {
      setCreatingRoutine(false);
    }
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
                <div className="text-xs text-slate-400 mb-1">Titolo</div>
                <input
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  placeholder="Pasto serale"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Tipo</div>
                  <select
                    value={routineKind}
                    onChange={(e) => setRoutineKind(e.target.value as RoutineKind)}
                    className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
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
                  <div className="text-xs text-slate-400 mb-1">Orari (separati da virgola)</div>
                  <input
                    value={routineTimes}
                    onChange={(e) => setRoutineTimes(e.target.value)}
                    placeholder="08:00, 19:00"
                    className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                disabled={creatingRoutine}
                className="w-full rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
                type="submit"
              >
                {creatingRoutine ? "Creazione…" : "Crea routine"}
              </button>
              <div className="text-xs text-slate-500">Le routine generano task per i prossimi 7 giorni (senza duplicati).</div>
            </form>

            <div className="lg:col-span-7">
              {routines.length === 0 ? (
                <EmptyState title="Nessuna routine" description="Crea la prima routine per trasformare abitudini in task." />
              ) : (
                <div className="space-y-2">
                  {routines.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
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
                              await updateRoutine(activePetId, r.id, { title: t, kind: editRoutineKind, times });
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
                              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block">
                            <div className="text-xs text-slate-400 mb-1">Tipo</div>
                            <select
                              value={editRoutineKind}
                              onChange={(e) => setEditRoutineKind(e.target.value as RoutineKind)}
                              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
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
                              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="sm:col-span-2 flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingRoutineId(null)}
                              className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                            >
                              Annulla
                            </button>
                            <button
                              disabled={savingRoutine}
                              type="submit"
                              className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60"
                            >
                              {savingRoutine ? "Salvataggio…" : "Salva"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{r.title}</div>
                            <div className="text-xs text-slate-500">{r.kind} · {r.times.join(", ")}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingRoutineId(r.id);
                                setEditRoutineTitle(r.title);
                                setEditRoutineKind(r.kind);
                                setEditRoutineTimes(r.times.join(", "));
                              }}
                              className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!activePetId) return;
                                if (!confirm("Eliminare questa routine?")) return;
                                await deleteRoutine(activePetId, r.id);
                              }}
                              className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => activePetId && setRoutineEnabled(activePetId, r.id, !r.enabled)}
                              className={
                                r.enabled
                                  ? "rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300"
                                  : "rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
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
              className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
            />
            <input
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              type="datetime-local"
              className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
            />
            <button
              disabled={creating}
              className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
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
                <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
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
                          className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs text-slate-400 mb-1">Scadenza</div>
                        <input
                          value={editTaskDueAt}
                          onChange={(e) => setEditTaskDueAt(e.target.value)}
                          type="datetime-local"
                          className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="md:col-span-2 flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                        >
                          Annulla
                        </button>
                        <button
                          disabled={savingTask}
                          type="submit"
                          className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60"
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
                          className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!activePetId) return;
                            if (!confirm("Eliminare questo task?")) return;
                            await deleteTask(activePetId, t.id);
                          }}
                          className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleDone(t, true)}
                          className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
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
                <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
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
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleDone(t, false)}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
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

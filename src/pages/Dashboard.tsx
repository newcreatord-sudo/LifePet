import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, Droplets, Footprints, HeartPulse, NotebookPen, Plus, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createPet } from "@/data/pets";
import { createTask, subscribeDueTasks } from "@/data/tasks";
import { createLog, subscribeRecentLogs } from "@/data/logs";
import { subscribeUpcomingAgenda } from "@/data/agenda";
import { markNotificationRead, subscribeUnreadNotifications } from "@/data/notifications";
import type { LogType, PetLog, PetTask } from "@/types";
import type { AgendaEvent, PetNotification } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PetAvatar } from "@/components/PetAvatar";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? pets[0] ?? null, [activePetId, pets]);

  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("dog");
  const [creatingPet, setCreatingPet] = useState(false);

  const [dueTasks, setDueTasks] = useState<PetTask[]>([]);
  const [recentLogs, setRecentLogs] = useState<PetLog[]>([]);
  const [upcoming, setUpcoming] = useState<AgendaEvent[]>([]);
  const [notifications, setNotifications] = useState<PetNotification[]>([]);

  const nowMs = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeDueTasks(activePetId, Date.now(), setDueTasks);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentLogs(activePetId, 10, setRecentLogs);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeUpcomingAgenda(activePetId, Date.now(), 6, setUpcoming);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeUnreadNotifications(activePetId, 6, setNotifications);
    return () => unsub();
  }, [activePetId]);

  async function onCreatePet(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreatingPet(true);
    try {
      await createPet({
        ownerId: user.uid,
        name: petName.trim(),
        species: petSpecies,
        createdAt: Date.now(),
      });
      setPetName("");
    } finally {
      setCreatingPet(false);
    }
  }

  async function quickAddTask() {
    if (!user || !activePetId) return;
    await createTask(activePetId, {
      petId: activePetId,
      title: "Check water bowl",
      dueAt: Date.now() + 60 * 60 * 1000,
      status: "due",
      createdAt: Date.now(),
      createdBy: user.uid,
    });
  }

  async function quickAddLog(type: LogType) {
    if (!user || !activePetId) return;
    await createLog(activePetId, {
      petId: activePetId,
      type,
      occurredAt: Date.now(),
      note: type === "food" ? "Meal logged" : type === "water" ? "Water" : type === "activity" ? "Activity" : "",
      value:
        type === "water"
          ? { amount: 250, unit: "ml" }
          : type === "activity"
            ? { amount: 30, unit: "min" }
            : undefined,
      createdAt: Date.now(),
      createdBy: user.uid,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Un riepilogo gentile e pratico per prendersi cura ogni giorno."
        actions={
          <>
            <button
              onClick={quickAddTask}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm hover:bg-slate-900"
            >
              <Plus className="w-4 h-4" />
              Quick task
            </button>
            <button
              onClick={() => quickAddLog("note")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300"
            >
              <NotebookPen className="w-4 h-4" />
              Quick log
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Card className="overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0">
                <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-400/10 blur-3xl rounded-full" />
                <div className="absolute -bottom-28 -right-24 w-96 h-96 bg-cyan-400/10 blur-3xl rounded-full" />
              </div>
              <div className="relative p-5">
                {activePet ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <PetAvatar photoPath={activePet.photoPath} name={activePet.name} className="w-12 h-12 rounded-2xl" />
                      <div>
                        <div className="text-xs text-slate-400">Pet attivo</div>
                        <div className="text-lg font-semibold">{activePet.name}</div>
                        <div className="text-xs text-slate-500">{activePet.species}{activePet.breed ? ` · ${activePet.breed}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to="/app/status" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                        Status
                      </Link>
                      <Link to="/app/records" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                        Records
                      </Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={HeartPulse}
                    title="Crea il primo pet"
                    description="Aggiungi il profilo per iniziare con routine, salute e cartella clinica."
                    action={
                      <a href="#create-pet" className="inline-flex items-center justify-center rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300">
                        Inizia
                      </a>
                    }
                  />
                )}

                {activePet ? (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Target className="w-4 h-4 text-emerald-200" />
                        Task dovuti
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{dueTasks.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Bell className="w-4 h-4 text-emerald-200" />
                        Alert
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{notifications.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <CalendarClock className="w-4 h-4 text-emerald-200" />
                        Agenda
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{upcoming.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        Insight
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{recentLogs.length}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Azioni rapide</CardTitle>
              <CardDescription>Un gesto alla volta, per stare bene davvero.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activePetId ? (
                <div className="text-sm text-slate-400">Seleziona o crea un pet per usare le azioni rapide.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => quickAddLog("food")} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-900/60 text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HeartPulse className="w-4 h-4 text-emerald-200" />
                      Cibo
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Registra pasto</div>
                  </button>
                  <button onClick={() => quickAddLog("water")} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-900/60 text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Droplets className="w-4 h-4 text-emerald-200" />
                      Acqua
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Idratazione</div>
                  </button>
                  <button onClick={() => quickAddLog("activity")} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-900/60 text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Footprints className="w-4 h-4 text-emerald-200" />
                      Attività
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Passeggiata / gioco</div>
                  </button>
                  <button onClick={() => quickAddLog("symptom")} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 hover:bg-slate-900/60 text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HeartPulse className="w-4 h-4 text-rose-200" />
                      Sintomi
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Nota salute</div>
                  </button>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-200" />
                Per riepiloghi AI: apri Insights e genera una sintesi.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Task in scadenza</CardTitle>
                <CardDescription>{activePetId ? "Per il pet attivo" : "Seleziona o crea un pet"}</CardDescription>
              </div>
              <Link to="/app/planner" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Planner
              </Link>
            </div>
          </CardHeader>
          <CardContent>
          {activePetId ? (
            dueTasks.length === 0 ? (
              <EmptyState icon={Target} title="Nessun task dovuto" description="Programma le attività e resta sereno." />
            ) : (
              <div className="space-y-2">
                {dueTasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-slate-500">
                      Due: {t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <EmptyState icon={HeartPulse} title="Primo passo" description="Crea un pet e inizia a registrare routine e salute." />
          )}
          </CardContent>
        </Card>

        <section className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Smart alerts</CardTitle>
                  <CardDescription>Consigli automatici in base ai log</CardDescription>
                </div>
                <Link to="/app/health" className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                  Health
                </Link>
              </div>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <div className="text-sm text-slate-400">Seleziona un pet per vedere gli alert.</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-slate-400">Nessun alert non letto.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{n.body}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => activePetId && markNotificationRead(activePetId, n.id)}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        Mark read
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agenda in arrivo</CardTitle>
              <CardDescription>Prossimi eventi e promemoria</CardDescription>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <div className="text-sm text-slate-400">Select a pet to see upcoming events.</div>
            ) : upcoming.length === 0 ? (
              <div className="text-sm text-slate-400">No upcoming events.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-slate-500">{new Date(e.dueAt).toLocaleString()} · {e.kind}</div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>

          <Card id="create-pet">
            <CardHeader>
              <CardTitle>Crea pet</CardTitle>
              <CardDescription>Profilo base: puoi aggiungere dettagli dopo</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={onCreatePet} className="space-y-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Name</div>
                <input
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Species</div>
                <select
                  value={petSpecies}
                  onChange={(e) => setPetSpecies(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button
                disabled={creatingPet}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 py-2 text-sm hover:bg-slate-900 disabled:opacity-60"
                type="submit"
              >
                {creatingPet ? "Creating…" : "Create"}
              </button>
              <div className="text-xs text-slate-500">
                Pets created: {pets.length} · Device time: {new Date(nowMs).toLocaleString()}
              </div>
            </form>
            </CardContent>
          </Card>
        </section>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Attività recente</CardTitle>
              <CardDescription>Ultimi log per il pet attivo</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={() => quickAddLog("food")} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Log food
              </button>
              <button onClick={() => quickAddLog("water")} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Log water
              </button>
              <button onClick={() => quickAddLog("weight")} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Log weight
              </button>
              <button onClick={() => quickAddLog("activity")} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Log activity
              </button>
              <button onClick={() => quickAddLog("symptom")} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                Log symptom
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        {activePetId ? (
          recentLogs.length === 0 ? (
            <div className="text-sm text-slate-400">No logs yet. Add one with Quick log.</div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((l) => (
                <div key={l.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{l.type}</div>
                    <div className="text-xs text-slate-500">{new Date(l.occurredAt).toLocaleString()}</div>
                  </div>
                  {l.note ? <div className="text-sm text-slate-300 mt-1">{l.note}</div> : null}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-sm text-slate-400">Select or create a pet to see activity.</div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

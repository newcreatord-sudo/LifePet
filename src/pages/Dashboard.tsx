import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, Droplets, Footprints, HeartPulse, NotebookPen, PhoneCall, Plus, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createPet } from "@/data/pets";
import { useToastStore } from "@/stores/toastStore";
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
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const pushToast = useToastStore((s) => s.push);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? pets[0] ?? null, [activePetId, pets]);

  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("dog");
  const [creatingPet, setCreatingPet] = useState(false);

  const [dueTasks, setDueTasks] = useState<PetTask[]>([]);
  const [recentLogs, setRecentLogs] = useState<PetLog[]>([]);
  const [upcoming, setUpcoming] = useState<AgendaEvent[]>([]);
  const [notifications, setNotifications] = useState<PetNotification[]>([]);

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
    const n = petName.trim();
    if (!n) return;
    setCreatingPet(true);
    try {
      const id = await createPet({
        ownerId: user.uid,
        name: n,
        species: petSpecies,
        createdAt: Date.now(),
      });
      setPetName("");
      setActivePetId(id);
      pushToast({ type: "success", title: "Pet creato", message: `${n} è stato aggiunto.` });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione pet fallita" });
    } finally {
      setCreatingPet(false);
    }
  }

  async function quickAddTask() {
    if (!user || !activePetId) return;
    await createTask(activePetId, {
      petId: activePetId,
      title: "Controlla la ciotola dell’acqua",
      dueAt: Date.now() + 60 * 60 * 1000,
      status: "due",
      createdAt: Date.now(),
      createdBy: user.uid,
    });
  }

  async function quickAddLog(type: LogType) {
    if (!user || !activePetId) return;
    const now = Date.now();
    const defaultNote =
      type === "food"
        ? "Pasto"
        : type === "water"
          ? "Acqua"
          : type === "activity"
            ? "Attività"
            : type === "weight"
              ? "Peso"
              : type === "symptom"
                ? "Sintomi"
                : "Nota";

    const note = (prompt("Nota (opzionale):", defaultNote) ?? "").trim() || defaultNote;

    const askNumber = (label: string, def: number) => {
      const raw = prompt(label, String(def));
      if (raw === null) return null;
      const v = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) return null;
      return v;
    };

    const value =
      type === "water"
        ? (() => {
            const amount = askNumber("Quanta acqua (ml)?", 250);
            return amount ? { amount, unit: "ml" } : undefined;
          })()
        : type === "activity"
          ? (() => {
              const amount = askNumber("Durata attività (min)?", 30);
              return amount ? { amount, unit: "min" } : undefined;
            })()
          : type === "food"
            ? (() => {
                const amount = askNumber("Quanto cibo (g)?", 100);
                return amount ? { amount, unit: "g" } : undefined;
              })()
            : type === "weight"
              ? (() => {
                  const amount = askNumber("Peso (kg)?", 10);
                  return amount ? { amount, unit: "kg" } : undefined;
                })()
              : undefined;

    await createLog(activePetId, {
      petId: activePetId,
      type,
      occurredAt: now,
      note,
      value,
      createdAt: now,
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
            {activePet?.vetContact?.emergencyPhone ? (
              <a
                href={`tel:${activePet.vetContact.emergencyPhone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 text-white px-3 py-2 text-sm font-medium hover:bg-rose-400"
              >
                <PhoneCall className="w-4 h-4" />
                SOS Vet
              </a>
            ) : null}
            <button
              onClick={quickAddTask}
              disabled={!user || !activePetId}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm hover:bg-white disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Task rapido
            </button>
            <button
              onClick={() => quickAddLog("note")}
              disabled={!user || !activePetId}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-60"
            >
              <NotebookPen className="w-4 h-4" />
              Nota rapida
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Card className="overflow-hidden">
            <div className="relative">
                <div className="absolute inset-0">
                  <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-400/20 blur-3xl rounded-full" />
                  <div className="absolute -bottom-28 -right-24 w-96 h-96 bg-sky-400/20 blur-3xl rounded-full" />
                </div>
              <div className="relative p-5">
                {activePet ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <PetAvatar photoPath={activePet.photoPath} name={activePet.name} className="w-12 h-12 rounded-2xl" />
                      <div>
                        <div className="text-xs text-slate-600">Pet attivo</div>
                        <div className="text-lg font-semibold">{activePet.name}</div>
                        <div className="text-xs text-slate-600">{activePet.species}{activePet.breed ? ` · ${activePet.breed}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to="/app/status" className="lp-btn-icon">
                        Status
                      </Link>
                      <Link to="/app/records" className="lp-btn-icon">
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
                      <a href="#create-pet" className="inline-flex items-center justify-center rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-500">
                        Inizia
                      </a>
                    }
                  />
                )}

                {activePet ? (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Target className="w-4 h-4 text-sky-700" />
                        Task dovuti
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{dueTasks.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Bell className="w-4 h-4 text-sky-700" />
                        Alert
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{notifications.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <CalendarClock className="w-4 h-4 text-sky-700" />
                        Agenda
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{upcoming.length}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Sparkles className="w-4 h-4 text-sky-700" />
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
                <div className="text-sm text-slate-600">Seleziona o crea un pet per usare le azioni rapide.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => quickAddLog("food")} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 hover:bg-white text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HeartPulse className="w-4 h-4 text-sky-700" />
                      Cibo
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Registra pasto</div>
                  </button>
                  <button onClick={() => quickAddLog("water")} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 hover:bg-white text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Droplets className="w-4 h-4 text-sky-700" />
                      Acqua
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Idratazione</div>
                  </button>
                  <button onClick={() => quickAddLog("activity")} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 hover:bg-white text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Footprints className="w-4 h-4 text-sky-700" />
                      Attività
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Passeggiata / gioco</div>
                  </button>
                  <button onClick={() => quickAddLog("symptom")} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 hover:bg-white text-left">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HeartPulse className="w-4 h-4 text-rose-200" />
                      Sintomi
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Nota salute</div>
                  </button>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-3 text-xs text-slate-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-700" />
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
              <Link to="/app/planner" className="lp-btn-icon">
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
                  <div key={t.id} className="lp-panel px-3 py-2">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-slate-600">
                      Scadenza: {t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}
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
                <Link to="/app/health" className="lp-btn-icon">
                  Salute
                </Link>
              </div>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <div className="text-sm text-slate-600">Seleziona un pet per vedere gli alert.</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-slate-600">Nessun alert non letto.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="lp-panel px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
                        <div className="text-xs text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => activePetId && markNotificationRead(activePetId, n.id)}
                        className="lp-btn-icon"
                      >
                        Segna letto
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Agenda</CardTitle>
                  <CardDescription>Prossimi eventi e promemoria</CardDescription>
                </div>
                <Link to="/app/agenda" className="lp-btn-icon">
                  Apri
                </Link>
              </div>
            </CardHeader>
            <CardContent>
            {!activePetId ? (
              <div className="text-sm text-slate-600">Seleziona un pet per vedere i prossimi eventi.</div>
            ) : upcoming.length === 0 ? (
              <div className="text-sm text-slate-600">Nessun evento in arrivo.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="lp-panel px-3 py-2">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-slate-600">{new Date(e.dueAt).toLocaleString()} · {e.kind}</div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>

          <Card id="create-pet" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Crea pet</CardTitle>
              <CardDescription>Profilo base: puoi aggiungere dettagli dopo</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={onCreatePet} className="space-y-3">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Nome</div>
                <input
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  required
                  className="lp-input"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Specie</div>
                <select
                  value={petSpecies}
                  onChange={(e) => setPetSpecies(e.target.value)}
                  className="lp-select"
                >
                  <option value="dog">Cane</option>
                  <option value="cat">Gatto</option>
                  <option value="other">Altro</option>
                </select>
              </label>
              <button
                disabled={creatingPet}
                className="w-full lp-btn-primary"
                type="submit"
              >
                {creatingPet ? "Creazione…" : "Crea"}
              </button>
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
              <button
                onClick={() => quickAddLog("food")}
                disabled={!user || !activePetId}
                className="lp-btn-icon"
              >
                Cibo
              </button>
              <button
                onClick={() => quickAddLog("water")}
                disabled={!user || !activePetId}
                className="lp-btn-icon"
              >
                Acqua
              </button>
              <button
                onClick={() => quickAddLog("weight")}
                disabled={!user || !activePetId}
                className="lp-btn-icon"
              >
                Peso
              </button>
              <button
                onClick={() => quickAddLog("activity")}
                disabled={!user || !activePetId}
                className="lp-btn-icon"
              >
                Attività
              </button>
              <button
                onClick={() => quickAddLog("symptom")}
                disabled={!user || !activePetId}
                className="lp-btn-icon"
              >
                Sintomi
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        {activePetId ? (
          recentLogs.length === 0 ? (
            <div className="text-sm text-slate-600">Nessun log. Aggiungi una nota rapida o registra un evento.</div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((l) => (
                <div key={l.id} className="lp-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{l.type}</div>
                    <div className="text-xs text-slate-600">{new Date(l.occurredAt).toLocaleString()}</div>
                  </div>
                  {l.note ? <div className="text-sm text-slate-300 mt-1">{l.note}</div> : null}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-sm text-slate-600">Seleziona o crea un pet per vedere l’attività.</div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

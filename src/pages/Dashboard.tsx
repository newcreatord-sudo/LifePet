import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, Droplets, Footprints, HeartPulse, NotebookPen, PhoneCall, Plus, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createPet } from "@/data/pets";
import { useToastStore } from "@/stores/toastStore";
import { createTask, subscribeDueTasks, subscribeTasks } from "@/data/tasks";
import { createLog, subscribeLogsRange, subscribeRecentLogs } from "@/data/logs";
import { subscribeUpcomingAgenda } from "@/data/agenda";
import { markNotificationRead, subscribeUnreadNotifications } from "@/data/notifications";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeVaccines } from "@/data/vaccines";
import { computePetStatus, statusClass, statusEmoji, statusLabel } from "@/lib/petStatus";
import type { HealthEvent, LogType, Pet, PetLog, PetTask, PetVaccine } from "@/types";
import type { AgendaEvent, PetNotification } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PetAvatar } from "@/components/PetAvatar";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const setPets = usePetStore((s) => s.setPets);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const pushToast = useToastStore((s) => s.push);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? pets[0] ?? null, [activePetId, pets]);

  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("dog");
  const [petSpeciesOther, setPetSpeciesOther] = useState("");
  const [createAdvanced, setCreateAdvanced] = useState(false);
  const [petBreed, setPetBreed] = useState("");
  const [petDob, setPetDob] = useState("");
  const [petSex, setPetSex] = useState<"male" | "female" | "unknown">("unknown");
  const [petNeutered, setPetNeutered] = useState(false);
  const [petWeightKg, setPetWeightKg] = useState("");
  const [petActivityLevel, setPetActivityLevel] = useState<"low" | "medium" | "high">("medium");
  const [petTemperamentTags, setPetTemperamentTags] = useState("");
  const [petAllergies, setPetAllergies] = useState("");
  const [petConditions, setPetConditions] = useState("");
  const [petMedications, setPetMedications] = useState("");
  const [petMicrochipId, setPetMicrochipId] = useState("");
  const [petPassportId, setPetPassportId] = useState("");
  const [petRegistry, setPetRegistry] = useState("");
  const [petFoodLabel, setPetFoodLabel] = useState("");
  const [petFoodKcalPerG, setPetFoodKcalPerG] = useState("");
  const [petFoodNotes, setPetFoodNotes] = useState("");
  const [petDietNotes, setPetDietNotes] = useState("");
  const [petVetClinicName, setPetVetClinicName] = useState("");
  const [petVetPhone, setPetVetPhone] = useState("");
  const [petVetEmergencyPhone, setPetVetEmergencyPhone] = useState("");
  const [petVetAddress, setPetVetAddress] = useState("");
  const [creatingPet, setCreatingPet] = useState(false);

  const [dueTasks, setDueTasks] = useState<PetTask[]>([]);
  const [recentLogs, setRecentLogs] = useState<PetLog[]>([]);
  const [upcoming, setUpcoming] = useState<AgendaEvent[]>([]);
  const [notifications, setNotifications] = useState<PetNotification[]>([]);

  const [statusLogs30d, setStatusLogs30d] = useState<PetLog[]>([]);
  const [statusTasks, setStatusTasks] = useState<PetTask[]>([]);
  const [statusHealthEvents, setStatusHealthEvents] = useState<HealthEvent[]>([]);
  const [statusVaccines, setStatusVaccines] = useState<PetVaccine[]>([]);

  const statusRange = useMemo(() => {
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
  }, []);

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
    const unsub = subscribeLogsRange(activePetId, statusRange.fromMs, statusRange.toMs, setStatusLogs30d);
    return () => unsub();
  }, [activePetId, statusRange.fromMs, statusRange.toMs]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeTasks(activePetId, setStatusTasks);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentHealthEvents(activePetId, 30, setStatusHealthEvents);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeVaccines(activePetId, setStatusVaccines);
    return () => unsub();
  }, [activePetId]);

  const petStatus = useMemo(() => {
    return computePetStatus({
      pet: activePet,
      logs30d: statusLogs30d,
      tasks: statusTasks,
      healthEvents: statusHealthEvents,
      vaccines: statusVaccines,
      nowMs: Date.now(),
    });
  }, [activePet, statusHealthEvents, statusLogs30d, statusTasks, statusVaccines]);

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
    if (!n) {
      pushToast({ type: "error", title: "Nome obbligatorio", message: "Inserisci il nome del pet." });
      return;
    }

    const toList = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
    const compact = <T extends Record<string, unknown>>(obj: T) => {
      const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
      return entries.length ? (Object.fromEntries(entries) as T) : undefined;
    };

    const species = petSpecies === "other" ? petSpeciesOther.trim() : petSpecies;
    if (petSpecies === "other" && !species) {
      pushToast({ type: "error", title: "Specie obbligatoria", message: "Compila il campo Specie (testo)." });
      return;
    }
    const weight = Number(petWeightKg.replace(",", "."));
    const kcalPerG = Number(petFoodKcalPerG.replace(",", "."));
    const temperamentTags = toList(petTemperamentTags);
    const allergies = toList(petAllergies);
    const conditions = toList(petConditions);
    const medications = toList(petMedications);

    const identification: Pet["identification"] = compact({
      passportId: petPassportId.trim() || undefined,
      registry: petRegistry.trim() || undefined,
    });

    const currentFood: Pet["currentFood"] = compact({
      label: petFoodLabel.trim() || undefined,
      kcalPerG: Number.isFinite(kcalPerG) && kcalPerG > 0 ? kcalPerG : undefined,
      notes: petFoodNotes.trim() || undefined,
    });

    const healthProfile: Pet["healthProfile"] = allergies.length || conditions.length || medications.length ? { allergies, conditions, medications } : undefined;

    const vetContact: Pet["vetContact"] = compact({
      clinicName: petVetClinicName.trim() || undefined,
      phone: petVetPhone.trim() || undefined,
      emergencyPhone: petVetEmergencyPhone.trim() || undefined,
      address: petVetAddress.trim() || undefined,
    });

    if (createAdvanced && petDob.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(petDob.trim())) {
      pushToast({ type: "error", title: "Data non valida", message: "Usa formato YYYY-MM-DD." });
      return;
    }

    const now = Date.now();
    setCreatingPet(true);
    try {
      const id = await createPet({
        ownerId: user.uid,
        name: n,
        species,
        ...(createAdvanced
          ? {
              breed: petBreed.trim() || undefined,
              dob: petDob.trim() || undefined,
              sex: petSex,
              neutered: petNeutered,
              weightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
              activityLevel: petActivityLevel,
              temperamentTags: temperamentTags.length ? temperamentTags : undefined,
              microchipId: petMicrochipId.trim() || undefined,
              identification,
              currentFood,
              healthProfile,
              vetContact,
              dietNotes: petDietNotes.trim() || undefined,
            }
          : {}),
        createdAt: now,
      });
      setPets([
        {
          id,
          ownerId: user.uid,
          name: n,
          species,
          ...(createAdvanced
            ? {
                breed: petBreed.trim() || undefined,
                dob: petDob.trim() || undefined,
                sex: petSex,
                neutered: petNeutered,
                weightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
                activityLevel: petActivityLevel,
                temperamentTags: temperamentTags.length ? temperamentTags : undefined,
                microchipId: petMicrochipId.trim() || undefined,
                identification,
                currentFood,
                healthProfile,
                vetContact,
                dietNotes: petDietNotes.trim() || undefined,
              }
            : {}),
          createdAt: now,
        },
        ...pets,
      ]);
      setPetName("");
      setPetSpecies("dog");
      setPetSpeciesOther("");
      setCreateAdvanced(false);
      setPetBreed("");
      setPetDob("");
      setPetSex("unknown");
      setPetNeutered(false);
      setPetWeightKg("");
      setPetActivityLevel("medium");
      setPetTemperamentTags("");
      setPetAllergies("");
      setPetConditions("");
      setPetMedications("");
      setPetMicrochipId("");
      setPetPassportId("");
      setPetRegistry("");
      setPetFoodLabel("");
      setPetFoodKcalPerG("");
      setPetFoodNotes("");
      setPetDietNotes("");
      setPetVetClinicName("");
      setPetVetPhone("");
      setPetVetEmergencyPhone("");
      setPetVetAddress("");
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
    try {
      await createTask(activePetId, {
        petId: activePetId,
        title: "Controlla la ciotola dell’acqua",
        dueAt: Date.now() + 60 * 60 * 1000,
        status: "due",
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      pushToast({ type: "success", title: "Task", message: "Creato." });
    } catch (e) {
      pushToast({ type: "error", title: "Task", message: e instanceof Error ? e.message : "Creazione fallita" });
    }
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

    try {
      await createLog(activePetId, {
        petId: activePetId,
        type,
        occurredAt: now,
        note,
        value,
        createdAt: now,
        createdBy: user.uid,
      });
      pushToast({ type: "success", title: "Log", message: "Salvato." });
    } catch (e) {
      pushToast({ type: "error", title: "Log", message: e instanceof Error ? e.message : "Salvataggio fallito" });
    }
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
                        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(petStatus.overall)}`}>
                          <span>{statusEmoji(petStatus.overall)}</span>
                          {statusLabel(petStatus.overall)}
                        </span>
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
              <CardDescription>Puoi inserire subito tutti i dati oppure completarli dopo</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={onCreatePet} className="space-y-3">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Nome</div>
                <input
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  required
                  maxLength={60}
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

              {petSpecies === "other" ? (
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Specie (testo)</div>
                  <input value={petSpeciesOther} onChange={(e) => setPetSpeciesOther(e.target.value)} className="lp-input" placeholder="Es. anatra" />
                </label>
              ) : null}

              <button
                type="button"
                className="w-full lp-btn-secondary"
                onClick={() => setCreateAdvanced((v) => !v)}
                disabled={creatingPet}
              >
                {createAdvanced ? "Nascondi dati avanzati" : "Inserisci dati avanzati"}
              </button>

              {createAdvanced ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Razza</div>
                    <input value={petBreed} onChange={(e) => setPetBreed(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Data nascita</div>
                    <input value={petDob} onChange={(e) => setPetDob(e.target.value)} className="lp-input" placeholder="YYYY-MM-DD" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Sesso</div>
                    <select value={petSex} onChange={(e) => setPetSex(e.target.value as "male" | "female" | "unknown")} className="lp-select">
                      <option value="unknown">Non specificato</option>
                      <option value="male">Maschio</option>
                      <option value="female">Femmina</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Attività</div>
                    <select value={petActivityLevel} onChange={(e) => setPetActivityLevel(e.target.value as "low" | "medium" | "high")} className="lp-select">
                      <option value="low">Bassa</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" checked={petNeutered} onChange={(e) => setPetNeutered(e.target.checked)} />
                    <div className="text-sm">Sterilizzato/a</div>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Peso (kg)</div>
                    <input value={petWeightKg} onChange={(e) => setPetWeightKg(e.target.value)} className="lp-input" inputMode="decimal" placeholder="Es. 12.5" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Microchip</div>
                    <input value={petMicrochipId} onChange={(e) => setPetMicrochipId(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Carattere (tag, separati da virgola)</div>
                    <input value={petTemperamentTags} onChange={(e) => setPetTemperamentTags(e.target.value)} className="lp-input" placeholder="Es. socievole, timido" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Allergie (virgola)</div>
                    <input value={petAllergies} onChange={(e) => setPetAllergies(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Patologie (virgola)</div>
                    <input value={petConditions} onChange={(e) => setPetConditions(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Farmaci (virgola)</div>
                    <input value={petMedications} onChange={(e) => setPetMedications(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Passaporto</div>
                    <input value={petPassportId} onChange={(e) => setPetPassportId(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Registro</div>
                    <input value={petRegistry} onChange={(e) => setPetRegistry(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Alimentazione attuale</div>
                    <input value={petFoodLabel} onChange={(e) => setPetFoodLabel(e.target.value)} className="lp-input" placeholder="Marca / tipo" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Kcal per grammo</div>
                    <input value={petFoodKcalPerG} onChange={(e) => setPetFoodKcalPerG(e.target.value)} className="lp-input" inputMode="decimal" placeholder="Es. 3.6" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Note cibo</div>
                    <input value={petFoodNotes} onChange={(e) => setPetFoodNotes(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block sm:col-span-2">
                    <div className="text-xs text-slate-600 mb-1">Note dieta</div>
                    <input value={petDietNotes} onChange={(e) => setPetDietNotes(e.target.value)} className="lp-input" />
                  </label>

                  <div className="sm:col-span-2 text-xs text-slate-600 mt-2">Contatto veterinario</div>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Clinica</div>
                    <input value={petVetClinicName} onChange={(e) => setPetVetClinicName(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Telefono</div>
                    <input value={petVetPhone} onChange={(e) => setPetVetPhone(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Emergenza</div>
                    <input value={petVetEmergencyPhone} onChange={(e) => setPetVetEmergencyPhone(e.target.value)} className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-600 mb-1">Indirizzo</div>
                    <input value={petVetAddress} onChange={(e) => setPetVetAddress(e.target.value)} className="lp-input" />
                  </label>
                </div>
              ) : null}

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

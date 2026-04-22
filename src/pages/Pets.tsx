import { useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { usePetCreateStore } from "@/stores/petCreateStore";
import { useAuthStore } from "@/stores/authStore";
import { deletePetCascade, updatePet } from "@/data/pets";
import { createLog, deleteLog, subscribeLogsRange } from "@/data/logs";
import { getPetDocumentDownloadUrl, subscribeDocuments, uploadPetDocument } from "@/data/documents";
import { deletePetPhoto, uploadPetPhoto } from "@/data/profilePhotos";
import { subscribeTasks } from "@/data/tasks";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeVaccines } from "@/data/vaccines";
import { PetAvatar } from "@/components/PetAvatar";
import { useEffect } from "react";
import { deleteField } from "firebase/firestore";
import { computePetStatus, statusClass, statusEmoji, statusLabel } from "@/lib/petStatus";
import type { HealthEvent, Pet, PetDocument, PetLog, PetTask, PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { FileText, LineChart, Save, ShieldPlus, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useToastStore } from "@/stores/toastStore";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { ConfirmStyles, useConfirmDialog } from "@/components/confirm";
import { PetBasicsCard } from "@/components/pets/PetBasicsCard";
import { PetFoodCard } from "@/components/pets/PetFoodCard";
import { PetHealthProfileCard } from "@/components/pets/PetHealthProfileCard";
import { PetVetCard } from "@/components/pets/PetVetCard";
import { PetWalkCard } from "@/components/pets/PetWalkCard";
import { PetProtectionCard } from "@/components/pets/PetProtectionCard";
import { syncPetCardFromPet } from "@/data/petCards";
import { PetKeyDataCard } from "@/components/pets/PetKeyDataCard";

export default function Pets() {
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const openWithDraft = useAiPanelStore((s) => s.openWithDraft);
  const confirmDialog = useConfirmDialog();
  const openCreatePet = usePetCreateStore((s) => s.openDialog);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [name, setName] = useState(activePet?.name ?? "");
  const [species, setSpecies] = useState(activePet?.species ?? "dog");
  const [breed, setBreed] = useState(activePet?.breed ?? "");
  const [dob, setDob] = useState(activePet?.dob ?? "");
  const [weightKg, setWeightKg] = useState(activePet?.weightKg?.toString() ?? "");
  const [sex, setSex] = useState(activePet?.sex ?? "unknown");
  const [neutered, setNeutered] = useState(Boolean(activePet?.neutered));
  const [activityLevel, setActivityLevel] = useState(activePet?.activityLevel ?? "medium");
  const [bodyConditionScore, setBodyConditionScore] = useState(activePet?.bodyConditionScore?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(activePet?.heightCm?.toString() ?? "");
  const [temperamentTags, setTemperamentTags] = useState((activePet?.temperamentTags ?? []).join(", "));
  const [walkBadge, setWalkBadge] = useState<NonNullable<Pet["walkBadge"]>>(activePet?.walkBadge ?? "green");
  const [walkVisible, setWalkVisible] = useState(Boolean(activePet?.walkVisible));
  const [allergies, setAllergies] = useState((activePet?.healthProfile?.allergies ?? []).join(", "));
  const [conditions, setConditions] = useState((activePet?.healthProfile?.conditions ?? []).join(", "));
  const [medications, setMedications] = useState((activePet?.healthProfile?.medications ?? []).join(", "));
  const [vetClinicName, setVetClinicName] = useState(activePet?.vetContact?.clinicName ?? "");
  const [vetPhone, setVetPhone] = useState(activePet?.vetContact?.phone ?? "");
  const [vetEmergencyPhone, setVetEmergencyPhone] = useState(activePet?.vetContact?.emergencyPhone ?? "");
  const [vetAddress, setVetAddress] = useState(activePet?.vetContact?.address ?? "");
  const [microchipId, setMicrochipId] = useState(activePet?.microchipId ?? "");
  const [passportId, setPassportId] = useState(activePet?.identification?.passportId ?? "");
  const [registry, setRegistry] = useState(activePet?.identification?.registry ?? "");
  const [dietNotes, setDietNotes] = useState(activePet?.dietNotes ?? "");
  const [foodLabel, setFoodLabel] = useState(activePet?.currentFood?.label ?? "");
  const [foodKcalPerG, setFoodKcalPerG] = useState(activePet?.currentFood?.kcalPerG?.toString() ?? "");
  const [foodNotes, setFoodNotes] = useState(activePet?.currentFood?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [weightLogs, setWeightLogs] = useState<{ at: number; kg: number }[]>([]);
  const [weightLogIds, setWeightLogIds] = useState<{ id: string; at: number; kg: number }[]>([]);
  const [logs30d, setLogs30d] = useState<PetLog[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [vaccines, setVaccines] = useState<PetVaccine[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [addingWeight, setAddingWeight] = useState(false);
  const [wow, setWow] = useState<{ petId: string; at: number } | null>(null);

  function parseNumber(v: string) {
    const n = Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function validateUpload(file: File, maxMb: number) {
    if (file.size > maxMb * 1024 * 1024) return `Massimo ${maxMb}MB.`;
    return null;
  }

  useEffect(() => {
    setName(activePet?.name ?? "");
    setSpecies(activePet?.species ?? "dog");
    setBreed(activePet?.breed ?? "");
    setDob(activePet?.dob ?? "");
    setWeightKg(activePet?.weightKg?.toString() ?? "");
    setSex(activePet?.sex ?? "unknown");
    setNeutered(Boolean(activePet?.neutered));
    setActivityLevel(activePet?.activityLevel ?? "medium");
    setBodyConditionScore(activePet?.bodyConditionScore?.toString() ?? "");
    setHeightCm(activePet?.heightCm?.toString() ?? "");
    setTemperamentTags((activePet?.temperamentTags ?? []).join(", "));
    setWalkBadge(activePet?.walkBadge ?? "green");
    setWalkVisible(Boolean(activePet?.walkVisible));
    setAllergies((activePet?.healthProfile?.allergies ?? []).join(", "));
    setConditions((activePet?.healthProfile?.conditions ?? []).join(", "));
    setMedications((activePet?.healthProfile?.medications ?? []).join(", "));
    setVetClinicName(activePet?.vetContact?.clinicName ?? "");
    setVetPhone(activePet?.vetContact?.phone ?? "");
    setVetEmergencyPhone(activePet?.vetContact?.emergencyPhone ?? "");
    setVetAddress(activePet?.vetContact?.address ?? "");
    setMicrochipId(activePet?.microchipId ?? "");
    setPassportId(activePet?.identification?.passportId ?? "");
    setRegistry(activePet?.identification?.registry ?? "");
    setDietNotes(activePet?.dietNotes ?? "");
    setFoodLabel(activePet?.currentFood?.label ?? "");
    setFoodKcalPerG(activePet?.currentFood?.kcalPerG?.toString() ?? "");
    setFoodNotes(activePet?.currentFood?.notes ?? "");
    setInlineError(null);
  }, [
    activePet?.breed,
    activePet?.bodyConditionScore,
    activePet?.activityLevel,
    activePet?.dietNotes,
    activePet?.dob,
    activePet?.heightCm,
    activePet?.identification,
    activePet?.microchipId,
    activePet?.name,
    activePet?.species,
    activePet?.neutered,
    activePet?.sex,
    activePet?.weightKg,
    activePet?.temperamentTags,
    activePet?.walkBadge,
    activePet?.walkVisible,
    activePet?.healthProfile,
    activePet?.vetContact,
    activePet?.currentFood,
  ]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeDocuments(activePetId, setDocs);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) {
      setWow(null);
      return;
    }
    try {
      const raw = localStorage.getItem("lifepet:wowPetCreated");
      if (!raw) {
        setWow(null);
        return;
      }
      const j = JSON.parse(raw) as { petId?: unknown; at?: unknown };
      const petId = typeof j.petId === "string" ? j.petId : "";
      const at = typeof j.at === "number" && Number.isFinite(j.at) ? j.at : 0;
      if (!petId || petId !== activePetId) {
        setWow(null);
        return;
      }
      setWow({ petId, at });
    } catch {
      setWow(null);
    }
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const toMs = Date.now();
    const fromMs = toMs - 365 * 24 * 60 * 60 * 1000;
    const unsub = subscribeLogsRange(activePetId, user.uid, fromMs, toMs, (all) => {
      const recent30d = all.filter((l) => l.occurredAt >= toMs - 30 * 24 * 60 * 60 * 1000);
      setLogs30d(recent30d);
      const points = all
        .filter((l) => l.type === "weight")
        .map((l) => ({ at: l.occurredAt, kg: Number(l.value?.amount) }))
        .filter((p) => Number.isFinite(p.kg) && p.kg > 0)
        .sort((a, b) => a.at - b.at);
      setWeightLogs(points);

      const withIds = all
        .filter((l) => l.type === "weight")
        .map((l) => ({ id: l.id, at: l.occurredAt, kg: Number(l.value?.amount) }))
        .filter((p) => Number.isFinite(p.kg) && p.kg > 0)
        .sort((a, b) => b.at - a.at)
        .slice(0, 10);
      setWeightLogIds(withIds);
    });
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const unsub = subscribeTasks(activePetId, user.uid, setTasks);
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId || !user) return;
    const unsub = subscribeRecentHealthEvents(activePetId, user.uid, 30, setHealthEvents);
    return () => unsub();
  }, [activePetId, user]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeVaccines(activePetId, setVaccines);
    return () => unsub();
  }, [activePetId]);

  const petStatus = useMemo(() => {
    return computePetStatus({
      pet: activePet,
      logs30d,
      tasks,
      healthEvents,
      vaccines,
      nowMs: Date.now(),
    });
  }, [activePet, healthEvents, logs30d, tasks, vaccines]);

  const profileCompletion = useMemo(() => {
    const items = [
      { done: Boolean(activePet?.photoPath), label: "Foto profilo" },
      { done: Boolean((dob || "").trim()), label: "Data di nascita" },
      { done: Boolean((microchipId || "").trim()), label: "Microchip" },
      { done: Boolean((vetClinicName || "").trim() || (vetPhone || "").trim() || (vetEmergencyPhone || "").trim()), label: "Contatto veterinario" },
      { done: Boolean((foodLabel || "").trim() || (dietNotes || "").trim()), label: "Alimentazione" },
      { done: docs.length > 0, label: "1 documento" },
      { done: vaccines.length > 0, label: "1 vaccino" },
    ];
    const total = items.length;
    const doneCount = items.filter((i) => i.done).length;
    const percent = Math.round((doneCount / total) * 100);
    const missing = items.filter((i) => !i.done).map((i) => i.label);
    return { percent, missing, doneCount, total };
  }, [activePet?.photoPath, dietNotes, dob, docs.length, foodLabel, microchipId, vaccines.length, vetClinicName, vetEmergencyPhone, vetPhone]);

  const weightSpark = useMemo(() => {
    if (weightLogs.length < 2) return null;
    const values = weightLogs.map((p) => p.kg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = 320;
    const h = 90;
    const pad = 8;
    const step = (w - pad * 2) / (weightLogs.length - 1);
    const d = weightLogs
      .map((p, i) => {
        const x = pad + i * step;
        const y = pad + (1 - (p.kg - min) / span) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { d, w, h, min, max };
  }, [weightLogs]);

  async function addWeightLog() {
    if (!user || !activePetId) return;
    const v = parseNumber(newWeight);
    if (!v || v <= 0) {
      pushToast({ type: "error", title: "Peso non valido", message: "Inserisci un valore maggiore di 0." });
      return;
    }
    setAddingWeight(true);
    setInlineError(null);
    try {
      await createLog(activePetId, {
        petId: activePetId,
        type: "weight",
        occurredAt: Date.now(),
        value: { amount: v, unit: "kg" },
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      await updatePet(activePetId, { weightKg: v });
      setNewWeight("");
      pushToast({ type: "success", title: "Peso salvato", message: "Registrazione aggiunta." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Salvataggio peso fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio peso fallito" });
    } finally {
      setAddingWeight(false);
    }
  }

  async function removeWeightLog(logId: string) {
    if (!activePetId) return;
    const ok = await confirmDialog({
      title: "Elimina peso",
      description: "Vuoi eliminare questa registrazione peso?",
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setInlineError(null);
    try {
      await deleteLog(activePetId, logId);
      pushToast({ type: "success", title: "Peso eliminato", message: "Registrazione rimossa." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
    }
  }

  async function onSave() {
    if (!activePetId) return;
    const n = name.trim();
    const sp = String(species || "").trim() || "dog";
    if (!n) {
      pushToast({ type: "error", title: "Nome obbligatorio", message: "Inserisci il nome del pet." });
      return;
    }
    setSaving(true);
    setInlineError(null);
    try {
      const weight = Number(weightKg);
      const bcs = Number(bodyConditionScore);
      const height = Number(heightCm);
      const kcalPerG = Number(foodKcalPerG);
      const toList = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
      const compact = <T extends Record<string, unknown>>(obj: T) => {
        const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
        return entries.length ? (Object.fromEntries(entries) as Record<string, unknown>) : null;
      };

      const identification = compact({
        passportId: passportId.trim() || undefined,
        registry: registry.trim() || undefined,
      });

      const currentFood = compact({
        label: foodLabel.trim() || undefined,
        kcalPerG: Number.isFinite(kcalPerG) && kcalPerG > 0 ? kcalPerG : undefined,
        notes: foodNotes.trim() || undefined,
      });

      const vetContact = compact({
        clinicName: vetClinicName.trim() || undefined,
        phone: vetPhone.trim() || undefined,
        emergencyPhone: vetEmergencyPhone.trim() || undefined,
        address: vetAddress.trim() || undefined,
      });

      const allergiesList = toList(allergies);
      const conditionsList = toList(conditions);
      const medicationsList = toList(medications);
      const healthProfile = allergiesList.length || conditionsList.length || medicationsList.length
        ? { allergies: allergiesList, conditions: conditionsList, medications: medicationsList }
        : null;

      await updatePet(activePetId, {
        name: n,
        species: sp,
        breed: breed.trim() ? breed.trim() : deleteField(),
        dob: dob.trim() ? dob.trim() : deleteField(),
        weightKg: Number.isFinite(weight) && weight > 0 ? weight : deleteField(),
        sex: sex as Pet["sex"],
        neutered,
        activityLevel: activityLevel as Pet["activityLevel"],
        bodyConditionScore: Number.isFinite(bcs) && bcs >= 1 && bcs <= 9 ? bcs : deleteField(),
        heightCm: Number.isFinite(height) && height > 0 ? height : deleteField(),
        temperamentTags: toList(temperamentTags),
        walkBadge,
        walkVisible,
        identification: identification ?? deleteField(),
        currentFood: currentFood ?? deleteField(),
        healthProfile: healthProfile ?? deleteField(),
        vetContact: vetContact ?? deleteField(),
        microchipId: microchipId.trim() ? microchipId.trim() : deleteField(),
        dietNotes: dietNotes.trim() ? dietNotes.trim() : deleteField(),
      });

      if (activePet?.petProtection?.enabled) {
        await syncPetCardFromPet({
          ...activePet,
          name: n,
          species: sp,
        });
      }
      pushToast({ type: "success", title: "Salvato", message: "Profilo aggiornato." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Salvataggio fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
    } finally {
      setSaving(false);
    }
  }

  async function onDeletePet() {
    if (!activePetId || !activePet) return;
    const ok = await confirmDialog({
      title: "Elimina pet",
      description: `Eliminare definitivamente ${activePet.name}? Questa azione cancella anche dati e documenti.`,
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setInlineError(null);
    try {
      await deletePetCascade(activePetId);
      setActivePetId(null);
      navigate("/app/dashboard", { replace: true });
      pushToast({ type: "success", title: "Pet eliminato", message: "Dati rimossi." });
    } catch {
      setInlineError("Eliminazione fallita");
      pushToast({ type: "error", title: "Errore", message: "Eliminazione fallita" });
    }
  }

  async function onUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePetId) return;
    const validation = validateUpload(file, 10);
    if (validation) {
      pushToast({ type: "error", title: "File non valido", message: validation });
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      pushToast({ type: "error", title: "File non valido", message: "Carica un’immagine." });
      e.target.value = "";
      return;
    }
    setPhotoBusy(true);
    setInlineError(null);
    try {
      const res = await uploadPetPhoto(activePetId, file);
      if (activePet?.petProtection?.enabled) {
        await syncPetCardFromPet({
          ...activePet,
          photoPath: res.photoPath,
        });
      }
      e.target.value = "";
      pushToast({ type: "success", title: "Foto", message: "Foto aggiornata." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Upload foto fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Upload foto fallito" });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    if (!activePetId || !activePet?.photoPath) return;
    setPhotoBusy(true);
    setInlineError(null);
    try {
      await deletePetPhoto(activePetId, activePet.photoPath);
      if (activePet?.petProtection?.enabled) {
        await syncPetCardFromPet({
          ...activePet,
          photoPath: undefined,
        });
      }
      pushToast({ type: "success", title: "Foto", message: "Foto rimossa." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Rimozione foto fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Rimozione foto fallita" });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePetId || !user) return;
    const validation = validateUpload(file, 20);
    if (validation) {
      pushToast({ type: "error", title: "File non valido", message: validation });
      e.target.value = "";
      return;
    }
    setUploading(true);
    setInlineError(null);
    try {
      await uploadPetDocument(activePetId, user.uid, file);
      e.target.value = "";
      pushToast({ type: "success", title: "Documento", message: "Caricato." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Upload documento fallito");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Upload documento fallito" });
    } finally {
      setUploading(false);
    }
  }

  if (!activePet) {
    if (activePetId) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Profilo Pet"
            description="Caricamento profilo…"
            imagePrompt="minimal clean illustration, pet profile card with paw icon, airy background, accent color, premium, no text, no watermark"
            imageAlt="Profilo pet"
          />
          <Card>
            <CardContent>
              <div className="py-10">
                <div className="h-4 w-40 lp-skeleton" />
                <div className="mt-3 h-3 w-64 lp-skeleton" />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <EmptyState
        icon={ShieldPlus}
        title="Crea o seleziona un pet"
        description="Crea il tuo primo profilo: sblocchi subito Salute, Planner, Agenda e Documenti."
        action={
          <button type="button" onClick={openCreatePet} className="lp-btn-primary inline-flex items-center justify-center">
            Crea pet
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profilo Pet"
        description="Dettagli, salute, contatti veterinario, foto e documenti."
        imagePrompt="minimal clean illustration, dog and cat portrait with profile card UI, airy background, accent color, premium, no text, no watermark"
        imageAlt="Profilo pet"
        actions={
          <>
            <button
              type="button"
              className="lp-btn-secondary inline-flex items-center gap-2"
              onClick={() => {
                openWithDraft(
                  `Aiutami a completare e rendere coerente il profilo di ${name || activePet.name}. Dimmi quali campi compilare per primi (salute, contatti vet, dieta) e cosa chiedere al veterinario. Se utile, proponi una checklist in 10 punti.`
                );
              }}
            >
              <Sparkles className="w-4 h-4" />
              AI profilo
            </button>
            <Link to="/app/status" className="lp-btn-secondary">
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(petStatus.overall)}`}>
                <span>{statusEmoji(petStatus.overall)}</span>
                {statusLabel(petStatus.overall)}
              </span>
            </Link>
          </>
        }
      />

      {activePet ? <PetKeyDataCard pet={activePet} docsCount={docs.length} vaccinesCount={vaccines.length} /> : null}

      {wow && wow.petId === activePet.id ? (
        <Card className="border border-emerald-200/70 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Da ora non dimenticherai più nulla</CardTitle>
            <CardDescription>Hai creato il profilo: aggiungi un primo dato (vaccino, promemoria o documento) per attivare il monitoraggio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Esempio timeline</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2 lp-panel px-3 py-2">
                    <div className="text-sm">Vaccino (esempio)</div>
                    <div className="text-xs lp-muted">oggi</div>
                  </div>
                  <div className="flex items-center justify-between gap-2 lp-panel px-3 py-2">
                    <div className="text-sm">Visita veterinaria (esempio)</div>
                    <div className="text-xs lp-muted">settimana</div>
                  </div>
                </div>
              </div>
              <div className="lp-panel p-3">
                <div className="text-xs lp-muted">Prossima azione</div>
                <div className="mt-2 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Completa il setup in 30 secondi</div>
                <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Scegli un’azione: puoi farle anche tutte più tardi.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/vaccines")}>Aggiungi vaccino</button>
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/planner")}>Crea promemoria</button>
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => {
                      try {
                        localStorage.removeItem("lifepet:wowPetCreated");
                      } catch {
                        void 0;
                      }
                      setWow(null);
                    }}
                  >
                    Ok
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Completezza profilo</CardTitle>
          <CardDescription>Più dati = più sicurezza e più utilità ogni giorno.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{profileCompletion.percent}%</div>
            <div className="text-xs lp-muted">{profileCompletion.doneCount}/{profileCompletion.total} completati</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200/60 overflow-hidden">
            <div className="h-full bg-sky-500" style={{ width: `${profileCompletion.percent}%` }} />
          </div>
          {profileCompletion.missing.length ? (
            <div className="mt-3">
              <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
                Prossimi passi: <span className="lp-muted">{profileCompletion.missing.slice(0, 3).join(" · ")}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {docs.length === 0 ? (
                  <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/documents")}>Aggiungi documento</button>
                ) : null}
                {vaccines.length === 0 ? (
                  <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/vaccines")}>Aggiungi vaccino</button>
                ) : null}
                <button type="button" className="lp-btn-secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Completa dati
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>Ottimo: profilo completo.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {inlineError ? (
            <Alert variant="danger" title="Errore">
              {inlineError}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Status</div>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${statusClass(petStatus.overall)}`}>
                  <span>{statusEmoji(petStatus.overall)}</span>
                  {statusLabel(petStatus.overall)}
                </span>
              </div>
              <div className="text-[11px] mt-2" style={{ color: "rgb(var(--lp-muted))" }}>
                Vaccini, eventi e task recenti.
              </div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Peso attuale</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{activePet.weightKg ? `${activePet.weightKg} kg` : "—"}</div>
              <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>Condizione corporea: {activePet.bodyConditionScore ?? "—"} / 9</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs lp-muted">Azioni rapide</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to={{ pathname: "/app/health", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-btn-icon">Salute</Link>
                <Link to={{ pathname: "/app/planner", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-btn-icon">Planner</Link>
                <Link to={{ pathname: "/app/documents", search: `?petId=${encodeURIComponent(activePetId)}` }} className="lp-btn-icon">Documenti</Link>
              </div>
              <div className="text-[11px] mt-2" style={{ color: "rgb(var(--lp-muted))" }}>Tutto resta collegato allo stesso pet.</div>
            </div>
          </div>

          <PetBasicsCard
            name={name}
            setName={setName}
            species={species}
            setSpecies={setSpecies}
            breed={breed}
            setBreed={setBreed}
            dob={dob}
            setDob={setDob}
            weightKg={weightKg}
            setWeightKg={setWeightKg}
            sex={sex as Pet["sex"]}
            setSex={setSex}
            neutered={neutered}
            setNeutered={setNeutered}
            activityLevel={activityLevel as Pet["activityLevel"]}
            setActivityLevel={setActivityLevel}
            bodyConditionScore={bodyConditionScore}
            setBodyConditionScore={setBodyConditionScore}
            heightCm={heightCm}
            setHeightCm={setHeightCm}
            temperamentTags={temperamentTags}
            setTemperamentTags={setTemperamentTags}
            microchipId={microchipId}
            setMicrochipId={setMicrochipId}
            passportId={passportId}
            setPassportId={setPassportId}
            registry={registry}
            setRegistry={setRegistry}
          />

          {activePet ? <PetProtectionCard pet={activePet} /> : null}

          <PetWalkCard walkBadge={walkBadge} setWalkBadge={setWalkBadge} walkVisible={walkVisible} setWalkVisible={setWalkVisible} />

          <PetFoodCard
            foodLabel={foodLabel}
            setFoodLabel={setFoodLabel}
            foodKcalPerG={foodKcalPerG}
            setFoodKcalPerG={setFoodKcalPerG}
            foodNotes={foodNotes}
            setFoodNotes={setFoodNotes}
            dietNotes={dietNotes}
            setDietNotes={setDietNotes}
          />

          <PetHealthProfileCard allergies={allergies} setAllergies={setAllergies} conditions={conditions} setConditions={setConditions} medications={medications} setMedications={setMedications} />

          <PetVetCard
            vetClinicName={vetClinicName}
            setVetClinicName={setVetClinicName}
            vetPhone={vetPhone}
            setVetPhone={setVetPhone}
            vetEmergencyPhone={vetEmergencyPhone}
            setVetEmergencyPhone={setVetEmergencyPhone}
            vetAddress={vetAddress}
            setVetAddress={setVetAddress}
          />

          <div className="lg:sticky lg:bottom-6">
            <Card className="relative overflow-hidden">
              <div className="lp-card-accent" aria-hidden="true" />
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Salva e sincronizza</div>
                    <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Le modifiche si riflettono in Salute, Planner e Documenti.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={onSave} disabled={saving} className="lp-btn-primary">
                      <span className="inline-flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        {saving ? "Salvataggio…" : "Salva"}
                      </span>
                    </button>
                    <button onClick={onDeletePet} type="button" className="lp-btn-primary" style={ConfirmStyles.dangerButtonStyle}>
                      Elimina
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Crescita</CardTitle>
              <CardDescription>Peso nel tempo (ultimi 12 mesi).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <div className="lp-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs lp-muted">Peso attuale (profilo)</div>
                      <div className="text-lg font-semibold">{activePet.weightKg ? `${activePet.weightKg} kg` : "—"}</div>
                      <div className="text-xs lp-muted">BCS: {activePet.bodyConditionScore ?? "—"} / 9</div>
                    </div>
                    <LineChart className="w-5 h-5 lp-icon-primary" />
                  </div>

                  {weightSpark ? (
                    <div className="mt-3">
                      <svg width={weightSpark.w} height={weightSpark.h} className="w-full">
                        <path d={weightSpark.d} fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgb(var(--lp-primary))" }} />
                      </svg>
                      <div className="mt-1 text-[11px] lp-muted">Range: {weightSpark.min.toFixed(1)}–{weightSpark.max.toFixed(1)} kg</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm lp-muted">Aggiungi 2+ pesate per vedere il grafico.</div>
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <label className="block flex-1">
                    <div className="text-xs lp-muted mb-1">Aggiungi peso (kg)</div>
                    <input value={newWeight} onChange={(e) => setNewWeight(e.target.value)} inputMode="decimal" className="lp-input" />
                  </label>
                  <button onClick={addWeightLog} disabled={addingWeight || !user} className="lp-btn-primary">
                    {addingWeight ? "…" : "Salva"}
                  </button>
                </div>

                {weightLogIds.length > 0 ? (
                  <div className="lp-panel p-3">
                    <div className="text-xs lp-muted">Ultime pesate</div>
                    <div className="mt-2 space-y-2">
                      {weightLogIds.map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <span className="font-medium">{w.kg.toFixed(1)} kg</span>
                            <span className="text-xs lp-muted"> · {new Date(w.at).toLocaleString()}</span>
                          </div>
                          <button
                            onClick={() => removeWeightLog(w.id)}
                            className="lp-btn-icon"
                            type="button"
                            aria-label="Elimina pesata"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="text-xs lp-muted">Consiglio: una pesata ogni 2–4 settimane rende l’indice longevità più accurato.</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Foto</CardTitle>
              <CardDescription>Mostrata nel selettore pet e nelle schermate principali.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="flex items-center gap-3">
              <PetAvatar photoPath={activePet.photoPath} name={activePet.name} className="w-16 h-16 rounded-2xl" />
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadPhoto}
                  disabled={photoBusy}
                  className="lp-file-input"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={onRemovePhoto}
                    disabled={photoBusy || !activePet.photoPath}
                    className="lp-btn-secondary"
                  >
                    Rimuovi
                  </button>
                  <div className="text-xs lp-muted">Salvata su Firebase Storage.</div>
                </div>
              </div>
            </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Documenti</CardTitle>
                  <CardDescription>Carica e apri referti e allegati.</CardDescription>
                </div>
                <Link to="/app/documents" className="lp-btn-icon">
                  Apri libreria
                </Link>
              </div>
            </CardHeader>
            <CardContent>
          <input
            type="file"
            onChange={onUpload}
            disabled={uploading}
            className="lp-file-input"
          />
          <div className="mt-3 space-y-2">
            {docs.length === 0 ? (
              <EmptyState icon={FileText} title="Nessun documento" description="Carica il primo referto per averlo sempre con te." />
            ) : (
              docs.map((d) => (
                <div key={d.id} className="lp-panel px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                          <div className="text-xs lp-muted">Caricato: {new Date(d.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const url = await getPetDocumentDownloadUrl(d.storagePath);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch {
                              pushToast({ type: "error", title: "Documento", message: "Impossibile aprire il documento." });
                        }
                      }}
                      className="lp-btn-icon"
                    >
                      Apri
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-xs lp-muted">File su Storage, metadati su Firestore.</div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { useAuthStore } from "@/stores/authStore";
import { deletePetCascade, updatePet } from "@/data/pets";
import { createLog, deleteLog, subscribeLogsRange } from "@/data/logs";
import { getPetDocumentDownloadUrl, subscribeDocuments, uploadPetDocument } from "@/data/documents";
import { deletePetPhoto, uploadPetPhoto } from "@/data/profilePhotos";
import { PetAvatar } from "@/components/PetAvatar";
import { useEffect } from "react";
import { deleteField } from "firebase/firestore";
import type { Pet, PetDocument } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExternalLink, FileText, LineChart, PhoneCall, Save, ShieldPlus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Pets() {
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const user = useAuthStore((s) => s.user);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [name, setName] = useState(activePet?.name ?? "");
  const [breed, setBreed] = useState(activePet?.breed ?? "");
  const [dob, setDob] = useState(activePet?.dob ?? "");
  const [weightKg, setWeightKg] = useState(activePet?.weightKg?.toString() ?? "");
  const [sex, setSex] = useState(activePet?.sex ?? "unknown");
  const [neutered, setNeutered] = useState(Boolean(activePet?.neutered));
  const [activityLevel, setActivityLevel] = useState(activePet?.activityLevel ?? "medium");
  const [bodyConditionScore, setBodyConditionScore] = useState(activePet?.bodyConditionScore?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(activePet?.heightCm?.toString() ?? "");
  const [temperamentTags, setTemperamentTags] = useState((activePet?.temperamentTags ?? []).join(", "));
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
  const [weightLogs, setWeightLogs] = useState<{ at: number; kg: number }[]>([]);
  const [weightLogIds, setWeightLogIds] = useState<{ id: string; at: number; kg: number }[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [addingWeight, setAddingWeight] = useState(false);

  useEffect(() => {
    setName(activePet?.name ?? "");
    setBreed(activePet?.breed ?? "");
    setDob(activePet?.dob ?? "");
    setWeightKg(activePet?.weightKg?.toString() ?? "");
    setSex(activePet?.sex ?? "unknown");
    setNeutered(Boolean(activePet?.neutered));
    setActivityLevel(activePet?.activityLevel ?? "medium");
    setBodyConditionScore(activePet?.bodyConditionScore?.toString() ?? "");
    setHeightCm(activePet?.heightCm?.toString() ?? "");
    setTemperamentTags((activePet?.temperamentTags ?? []).join(", "));
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
    activePet?.neutered,
    activePet?.sex,
    activePet?.weightKg,
    activePet?.temperamentTags,
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
    if (!activePetId) return;
    const toMs = Date.now();
    const fromMs = toMs - 365 * 24 * 60 * 60 * 1000;
    const unsub = subscribeLogsRange(activePetId, fromMs, toMs, (all) => {
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
  }, [activePetId]);

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
    const v = Number(newWeight);
    if (!Number.isFinite(v) || v <= 0) return;
    setAddingWeight(true);
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
    } finally {
      setAddingWeight(false);
    }
  }

  async function removeWeightLog(logId: string) {
    if (!activePetId) return;
    await deleteLog(activePetId, logId);
  }

  async function onSave() {
    if (!activePetId) return;
    setSaving(true);
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
        name: name.trim(),
        breed: breed.trim() ? breed.trim() : deleteField(),
        dob: dob.trim() ? dob.trim() : deleteField(),
        weightKg: Number.isFinite(weight) && weight > 0 ? weight : deleteField(),
        sex: sex as Pet["sex"],
        neutered,
        activityLevel: activityLevel as Pet["activityLevel"],
        bodyConditionScore: Number.isFinite(bcs) && bcs >= 1 && bcs <= 9 ? bcs : deleteField(),
        heightCm: Number.isFinite(height) && height > 0 ? height : deleteField(),
        temperamentTags: toList(temperamentTags),
        identification: identification ?? deleteField(),
        currentFood: currentFood ?? deleteField(),
        healthProfile: healthProfile ?? deleteField(),
        vetContact: vetContact ?? deleteField(),
        microchipId: microchipId.trim() ? microchipId.trim() : deleteField(),
        dietNotes: dietNotes.trim() ? dietNotes.trim() : deleteField(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDeletePet() {
    if (!activePetId || !activePet) return;
    if (!confirm(`Eliminare definitivamente ${activePet.name}? Questa azione cancella anche dati e documenti.`)) return;
    try {
      await deletePetCascade(activePetId);
      window.location.href = "/app/dashboard";
    } catch {
      return;
    }
  }

  async function onUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePetId) return;
    setPhotoBusy(true);
    try {
      await uploadPetPhoto(activePetId, file);
      e.target.value = "";
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    if (!activePetId || !activePet?.photoPath) return;
    setPhotoBusy(true);
    try {
      await deletePetPhoto(activePetId, activePet.photoPath);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePetId || !user) return;
    setUploading(true);
    try {
      await uploadPetDocument(activePetId, user.uid, file);
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  if (!activePet) {
    return (
      <EmptyState
        icon={ShieldPlus}
        title="Crea o seleziona un pet"
        description="Aggiungi il primo profilo dal Dashboard, poi torna qui per completare i dettagli."
        action={
          <Link
            to="/app/dashboard#create-pet"
            className="lp-btn-primary inline-flex items-center justify-center"
          >
            Vai al Dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profilo Pet" description="Dettagli, salute, contatti veterinario, foto e documenti." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Dettagli</CardTitle>
            <CardDescription>Informazioni principali del tuo animale.</CardDescription>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Nome</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Razza</div>
              <input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Data di nascita</div>
              <input
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="AAAA-MM-GG"
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Peso (kg)</div>
              <input
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                inputMode="decimal"
                className="lp-input"
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Sesso</div>
              <select value={sex} onChange={(e) => setSex(e.target.value as Pet["sex"])} className="lp-select">
                <option value="unknown">Non specificato</option>
                <option value="male">Maschio</option>
                <option value="female">Femmina</option>
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Attività</div>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Pet["activityLevel"])} className="lp-select">
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={neutered} onChange={(e) => setNeutered(e.target.checked)} />
              Sterilizzato/a
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">BCS (1–9)</div>
              <input value={bodyConditionScore} onChange={(e) => setBodyConditionScore(e.target.value)} inputMode="numeric" className="lp-input" />
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Altezza (cm)</div>
              <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" className="lp-input" />
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Microchip</div>
              <input
                value={microchipId}
                onChange={(e) => setMicrochipId(e.target.value)}
                className="lp-input"
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Passaporto (opz.)</div>
              <input value={passportId} onChange={(e) => setPassportId(e.target.value)} className="lp-input" />
            </label>

            <label className="block md:col-span-2">
              <div className="text-xs text-slate-600 mb-1">Registro / Identificazione (opz.)</div>
              <input value={registry} onChange={(e) => setRegistry(e.target.value)} className="lp-input" />
            </label>

            <label className="block md:col-span-2">
              <div className="text-xs text-slate-600 mb-1">Carattere (tag separati da virgola)</div>
              <input
                value={temperamentTags}
                onChange={(e) => setTemperamentTags(e.target.value)}
                placeholder="socievole, ansioso, energico"
                className="lp-input"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
            <div className="font-semibold">Alimentazione attuale</div>
            <div className="text-xs text-slate-600 mt-1">Serve anche per stimare quantità e reminder pasti.</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Cibo (nome)</div>
                <input value={foodLabel} onChange={(e) => setFoodLabel(e.target.value)} className="lp-input" />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Kcal per grammo</div>
                <input value={foodKcalPerG} onChange={(e) => setFoodKcalPerG(e.target.value)} inputMode="decimal" className="lp-input" />
              </label>
              <label className="block md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Note cibo</div>
                <input value={foodNotes} onChange={(e) => setFoodNotes(e.target.value)} className="lp-input" />
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Allergie (separate da virgola)</div>
              <input
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="pollo, polline"
                className="lp-input"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Condizioni (separate da virgola)</div>
              <input
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="artrite, dermatite"
                className="lp-input"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-slate-600 mb-1">Farmaci (separati da virgola)</div>
              <input
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="nome farmaco, dosaggio"
                className="lp-input"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Contatti veterinario</div>
                <div className="text-xs text-slate-600 mt-1">Utili anche in emergenza.</div>
              </div>
              <div className="flex items-center gap-2">
                {vetPhone.trim() ? (
                  <a
                    href={`tel:${vetPhone.trim()}`}
                    className="lp-btn-icon inline-flex items-center gap-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Chiama
                  </a>
                ) : null}
                {vetEmergencyPhone.trim() ? (
                  <a
                    href={`tel:${vetEmergencyPhone.trim()}`}
                    className="rounded-xl bg-rose-500 text-white px-3 py-2 text-xs font-medium hover:bg-rose-400 inline-flex items-center gap-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Emergenza
                  </a>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Clinica</div>
                <input
                  value={vetClinicName}
                  onChange={(e) => setVetClinicName(e.target.value)}
                  className="lp-input"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Telefono</div>
                <input
                  value={vetPhone}
                  onChange={(e) => setVetPhone(e.target.value)}
                  placeholder="+39..."
                  className="lp-input"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Telefono emergenza</div>
                <input
                  value={vetEmergencyPhone}
                  onChange={(e) => setVetEmergencyPhone(e.target.value)}
                  placeholder="+39..."
                  className="lp-input"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Indirizzo</div>
                <input
                  value={vetAddress}
                  onChange={(e) => setVetAddress(e.target.value)}
                  className="lp-input"
                />
              </label>
            </div>
            {vetAddress.trim() ? (
              <div className="mt-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vetAddress.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn-icon inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri su Maps
                </a>
              </div>
            ) : null}
          </div>
          <label className="block mt-3">
            <div className="text-xs text-slate-600 mb-1">Note alimentazione</div>
            <textarea
              value={dietNotes}
              onChange={(e) => setDietNotes(e.target.value)}
              rows={4}
              className="lp-textarea"
            />
          </label>
          <button
            onClick={onSave}
            disabled={saving}
            className="mt-4 lp-btn-primary"
          >
            <span className="inline-flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Salvataggio…" : "Salva"}
            </span>
          </button>

          <div className="mt-3">
            <button onClick={onDeletePet} type="button" className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-medium hover:bg-rose-400">
              Elimina pet
            </button>
          </div>
          </CardContent>
        </Card>

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
                      <div className="text-xs text-slate-600">Peso attuale (profilo)</div>
                      <div className="text-lg font-semibold">{activePet.weightKg ? `${activePet.weightKg} kg` : "—"}</div>
                      <div className="text-xs text-slate-600">BCS: {activePet.bodyConditionScore ?? "—"} / 9</div>
                    </div>
                    <LineChart className="w-5 h-5 text-sky-700" />
                  </div>

                  {weightSpark ? (
                    <div className="mt-3">
                      <svg width={weightSpark.w} height={weightSpark.h} className="w-full">
                        <path d={weightSpark.d} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-600" />
                      </svg>
                      <div className="mt-1 text-[11px] text-slate-600">Range: {weightSpark.min.toFixed(1)}–{weightSpark.max.toFixed(1)} kg</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">Aggiungi 2+ pesate per vedere il grafico.</div>
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <label className="block flex-1">
                    <div className="text-xs text-slate-600 mb-1">Aggiungi peso (kg)</div>
                    <input value={newWeight} onChange={(e) => setNewWeight(e.target.value)} inputMode="decimal" className="lp-input" />
                  </label>
                  <button onClick={addWeightLog} disabled={addingWeight || !user} className="lp-btn-primary">
                    {addingWeight ? "…" : "Salva"}
                  </button>
                </div>

                {weightLogIds.length > 0 ? (
                  <div className="lp-panel p-3">
                    <div className="text-xs text-slate-600">Ultime pesate</div>
                    <div className="mt-2 space-y-2">
                      {weightLogIds.map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <span className="font-medium">{w.kg.toFixed(1)} kg</span>
                            <span className="text-xs text-slate-600"> · {new Date(w.at).toLocaleString()}</span>
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

                <div className="text-xs text-slate-600">Consiglio: una pesata ogni 2–4 settimane rende l’indice longevità più accurato.</div>
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
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-sky-500"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={onRemovePhoto}
                    disabled={photoBusy || !activePet.photoPath}
                    className="lp-btn-secondary"
                  >
                    Rimuovi
                  </button>
                  <div className="text-xs text-slate-600">Salvata su Firebase Storage.</div>
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
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-sky-500"
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
                      <div className="text-xs text-slate-600">Caricato: {new Date(d.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const url = await getPetDocumentDownloadUrl(d.storagePath);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch {
                          return;
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
          <div className="mt-3 text-xs text-slate-600">File su Storage, metadati su Firestore.</div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

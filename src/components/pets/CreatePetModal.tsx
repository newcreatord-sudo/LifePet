import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { createPet } from "@/data/pets";
import { uploadPetPhoto } from "@/data/profilePhotos";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { usePetCreateStore } from "@/stores/petCreateStore";
import { useToastStore } from "@/stores/toastStore";
import { markOnboardingStep } from "@/lib/onboardingV2";
import type { Pet } from "@/types";

function splitCsv(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNum(v: string) {
  const t = String(v || "").trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const SPECIES: Array<{ value: string; label: string }> = [
  { value: "dog", label: "Cane" },
  { value: "cat", label: "Gatto" },
  { value: "other", label: "Altro" },
];

export function CreatePetModal() {
  const open = usePetCreateStore((s) => s.open);
  const closeDialog = usePetCreateStore((s) => s.closeDialog);
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [detailsToggleTick, setDetailsToggleTick] = useState(0);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<Pet["sex"]>("unknown");
  const [dob, setDob] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState<Pet["activityLevel"]>("medium");
  const [neutered, setNeutered] = useState(false);
  const [bodyConditionScore, setBodyConditionScore] = useState("");

  const [microchipId, setMicrochipId] = useState("");
  const [passportId, setPassportId] = useState("");
  const [registry, setRegistry] = useState("");
  const [temperamentTags, setTemperamentTags] = useState("");

  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");

  const [foodLabel, setFoodLabel] = useState("");
  const [dietNotes, setDietNotes] = useState("");
  const [budgetMonthly, setBudgetMonthly] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("EUR");

  const [vetClinicName, setVetClinicName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [vetEmergencyPhone, setVetEmergencyPhone] = useState("");
  const [vetAddress, setVetAddress] = useState("");

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (!name.trim()) return false;
    return true;
  }, [name, user]);

  function reset() {
    setBusy(false);
    setShowDetails(false);
    setName("");
    setSpecies("dog");
    setBreed("");
    setSex("unknown");
    setDob("");
    setWeightKg("");
    setHeightCm("");
    setActivityLevel("medium");
    setNeutered(false);
    setBodyConditionScore("");
    setMicrochipId("");
    setPassportId("");
    setRegistry("");
    setTemperamentTags("");
    setAllergies("");
    setConditions("");
    setMedications("");
    setFoodLabel("");
    setDietNotes("");
    setBudgetMonthly("");
    setBudgetCurrency("EUR");
    setVetClinicName("");
    setVetPhone("");
    setVetEmergencyPhone("");
    setVetAddress("");
    setPhotoFile(null);
    setPhotoPreviewUrl("");
  }

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        return;
      }
    };
  }, [photoFile]);

  useEffect(() => {
    if (!showDetails) return;
    try {
      const el = document.getElementById("create-pet-details-anchor");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      return;
    }
  }, [detailsToggleTick, showDetails]);

  async function onSubmit() {
    if (!user) {
      pushToast({ type: "error", title: "Accesso richiesto", message: "Accedi per creare un pet." });
      return;
    }
    if (!canSubmit) return;
    setBusy(true);
    try {
      const withTimeout = async <T,>(label: string, p: Promise<T>, timeoutMs: number) => {
        return (await Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label}: tempo scaduto, riprova`)), timeoutMs)
          ),
        ])) as T;
      };

      const input: Omit<Pet, "id"> = {
        ownerId: user.uid,
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        dob: dob.trim() || undefined,
        weightKg: parseNum(weightKg),
        heightCm: parseNum(heightCm),
        sex,
        neutered,
        activityLevel,
        bodyConditionScore: parseNum(bodyConditionScore),
        temperamentTags: splitCsv(temperamentTags),
        microchipId: microchipId.trim() || undefined,
        identification: {
          passportId: passportId.trim() || undefined,
          registry: registry.trim() || undefined,
        },
        healthProfile: {
          allergies: splitCsv(allergies),
          conditions: splitCsv(conditions),
          medications: splitCsv(medications),
        },
        currentFood: {
          label: foodLabel.trim() || undefined,
          notes: dietNotes.trim() || undefined,
        },
        dietNotes: dietNotes.trim() || undefined,
        budgetMonthly: parseNum(budgetMonthly),
        budgetCurrency: budgetCurrency.trim() || undefined,
        vetContact: {
          clinicName: vetClinicName.trim() || undefined,
          phone: vetPhone.trim() || undefined,
          emergencyPhone: vetEmergencyPhone.trim() || undefined,
          address: vetAddress.trim() || undefined,
        },
        createdAt: Date.now(),
      };

      const id = await withTimeout("Creazione profilo", createPet(input), 12_000);
      setActivePetId(id);
      markOnboardingStep("petCreated");

      try {
        localStorage.setItem("lifepet:wowPetCreated", JSON.stringify({ petId: id, at: Date.now() }));
      } catch {
        void 0;
      }


      if (photoFile) {
        try {
          await withTimeout("Upload foto", uploadPetPhoto(id, photoFile), 20_000);
        } catch (e) {
          pushToast({ type: "error", title: "Foto profilo", message: e instanceof Error ? e.message : "Impossibile caricare la foto" });
        }
      } else {
        pushToast({ type: "info", title: "Foto profilo", message: "Puoi aggiungere la foto in un secondo momento." });
      }

      pushToast({ type: "success", title: "Pet creato", message: "Profilo creato correttamente." });
      closeDialog();
      reset();
      navigate("/app/pets");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore imprevisto";
      pushToast({ type: "error", title: "Impossibile creare", message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Crea pet"
      description="Inserisci i dati principali. Puoi compilare anche i dettagli (opzionali) subito."
      onClose={() => {
        if (busy) return;
        closeDialog();
      }}
      panelClassName="max-w-2xl"
    >
      <div spellCheck={false} className="space-y-4">
        <div className="lp-panel p-4">
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Creazione ultra veloce</div>
          <div className="text-xs lp-muted mt-1">Nome e tipo animale. La foto è consigliata ma puoi aggiungerla dopo.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Nome</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="lp-input" placeholder="Es. Leo" required />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Specie</div>
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className="lp-select">
              {SPECIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Foto (consigliata)</div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="lp-input"
                data-testid="create-pet-photo-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setPhotoFile(f);
                }}
              />
              {photoPreviewUrl ? (
                <div className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(var(--lp-ink),0.10)" }}>
                  <img src={photoPreviewUrl} alt="Anteprima foto" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center lp-panel" style={{ color: "rgb(var(--lp-muted))" }}>
                  +
                </div>
              )}
            </div>
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Razza (opzionale)</div>
            <input value={breed} onChange={(e) => setBreed(e.target.value)} className="lp-input" placeholder="Es. meticcio" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Sesso (opzionale)</div>
            <select value={sex} onChange={(e) => setSex(e.target.value as Pet["sex"])} className="lp-select">
              <option value="unknown">Non specificato</option>
              <option value="male">Maschio</option>
              <option value="female">Femmina</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="lp-btn-secondary"
            onClick={() => {
              setShowDetails((v) => !v);
              setDetailsToggleTick((x) => x + 1);
            }}
          >
            {showDetails ? "Nascondi dettagli" : "Mostra dettagli (opzionale)"}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="lp-btn-secondary" disabled={busy} onClick={() => { reset(); closeDialog(); }}>
              Annulla
            </button>
            <button type="button" className="lp-btn-primary" disabled={!canSubmit || busy} onClick={onSubmit}>
              {busy ? "Salvo…" : "Crea pet"}
            </button>
          </div>
        </div>

        {showDetails ? (
          <div id="create-pet-details-anchor" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="lp-panel p-3">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Misure</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Peso (kg)</div>
                  <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 12,4" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Altezza (cm)</div>
                  <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 42" />
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs lp-muted mb-1">Condizione corporea (scala 1–9, opzionale)</div>
                  <input value={bodyConditionScore} onChange={(e) => setBodyConditionScore(e.target.value)} inputMode="numeric" className="lp-input" placeholder="Es. 5 (ideale)" />
                  <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>1 molto magro · 5 ideale · 9 molto sovrappeso</div>
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs lp-muted mb-1">Attività</div>
                  <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Pet["activityLevel"])} className="lp-select">
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="lp-panel p-3">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Identificazione</div>
              <div className="grid grid-cols-1 gap-3 mt-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Microchip (opzionale)</div>
                  <input value={microchipId} onChange={(e) => setMicrochipId(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Passaporto (opzionale)</div>
                  <input value={passportId} onChange={(e) => setPassportId(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Registro / identificazione (opzionale)</div>
                  <input value={registry} onChange={(e) => setRegistry(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Carattere (tag separati da virgola)</div>
                  <input value={temperamentTags} onChange={(e) => setTemperamentTags(e.target.value)} className="lp-input" placeholder="socievole, energico" />
                </label>
              </div>
            </div>

            <div className="lp-panel p-3">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Salute</div>
              <div className="grid grid-cols-1 gap-3 mt-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Allergie (separate da virgola)</div>
                  <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="lp-input" placeholder="pollo, polline" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Condizioni (separate da virgola)</div>
                  <input value={conditions} onChange={(e) => setConditions(e.target.value)} className="lp-input" placeholder="dermatite, artrite" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Farmaci (separati da virgola)</div>
                  <input value={medications} onChange={(e) => setMedications(e.target.value)} className="lp-input" placeholder="nome, dose" />
                </label>
              </div>
            </div>

            <div className="lp-panel p-3">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Alimentazione e budget</div>
              <div className="grid grid-cols-1 gap-3 mt-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Cibo attuale (opzionale)</div>
                  <input value={foodLabel} onChange={(e) => setFoodLabel(e.target.value)} className="lp-input" placeholder="Marca / linea" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Note dieta (opzionale)</div>
                  <textarea value={dietNotes} onChange={(e) => setDietNotes(e.target.value)} className="lp-textarea" rows={3} placeholder="Allergie, porzioni, orari…" />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Budget mensile (opzionale)</div>
                    <input value={budgetMonthly} onChange={(e) => setBudgetMonthly(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 80" />
                  </label>
                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Valuta</div>
                    <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className="lp-select">
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="lp-panel p-3 lg:col-span-2">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Veterinario (opzionale)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Clinica</div>
                  <input value={vetClinicName} onChange={(e) => setVetClinicName(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Telefono</div>
                  <input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} className="lp-input" inputMode="tel" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Emergenze</div>
                  <input value={vetEmergencyPhone} onChange={(e) => setVetEmergencyPhone(e.target.value)} className="lp-input" inputMode="tel" />
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs lp-muted mb-1">Indirizzo</div>
                  <input value={vetAddress} onChange={(e) => setVetAddress(e.target.value)} className="lp-input" />
                </label>
              </div>
            </div>

            <div className="lg:col-span-2 flex items-center justify-between gap-3">
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  setShowDetails(false);
                  setDetailsToggleTick((v) => v + 1);
                }}
              >
                Indietro
              </button>
              <div className="flex items-center gap-2">
                <button type="button" className="lp-btn-secondary" disabled={busy} onClick={() => { reset(); closeDialog(); }}>
                  Annulla
                </button>
                <button type="button" className="lp-btn-primary" disabled={!canSubmit || busy} onClick={onSubmit}>
                  {busy ? "Salvo…" : "Crea pet"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

import type { Pet } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PawPrint } from "lucide-react";

function formatAgeFromDob(dob: string) {
  const m = String(dob || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const birth = new Date(y, mo - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const mDiff = now.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 0 || years > 60) return null;
  return years === 0 ? "< 1 anno" : years === 1 ? "1 anno" : `${years} anni`;
}

export function PetBasicsCard({
  name,
  setName,
  species,
  setSpecies,
  breed,
  setBreed,
  dob,
  setDob,
  weightKg,
  setWeightKg,
  sex,
  setSex,
  neutered,
  setNeutered,
  activityLevel,
  setActivityLevel,
  bodyConditionScore,
  setBodyConditionScore,
  heightCm,
  setHeightCm,
  temperamentTags,
  setTemperamentTags,
  microchipId,
  setMicrochipId,
  passportId,
  setPassportId,
  registry,
  setRegistry,
}: {
  name: string;
  setName: (v: string) => void;
  species: string;
  setSpecies: (v: string) => void;
  breed: string;
  setBreed: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  weightKg: string;
  setWeightKg: (v: string) => void;
  sex: Pet["sex"];
  setSex: (v: Pet["sex"]) => void;
  neutered: boolean;
  setNeutered: (v: boolean) => void;
  activityLevel: Pet["activityLevel"];
  setActivityLevel: (v: Pet["activityLevel"]) => void;
  bodyConditionScore: string;
  setBodyConditionScore: (v: string) => void;
  heightCm: string;
  setHeightCm: (v: string) => void;
  temperamentTags: string;
  setTemperamentTags: (v: string) => void;
  microchipId: string;
  setMicrochipId: (v: string) => void;
  passportId: string;
  setPassportId: (v: string) => void;
  registry: string;
  setRegistry: (v: string) => void;
}) {
  const age = formatAgeFromDob(dob);

  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Profilo base</CardTitle>
            <CardDescription>Dati essenziali per stime, reminder e condivisione.</CardDescription>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.22)" }}>
            <PawPrint className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Nome</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="lp-input" required />
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Specie</div>
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className="lp-select">
              <option value="dog">Cane</option>
              <option value="cat">Gatto</option>
              <option value="other">Altro</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Razza</div>
            <input value={breed} onChange={(e) => setBreed(e.target.value)} className="lp-input" placeholder="Es. meticcio" />
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Data di nascita</div>
            <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="AAAA-MM-GG" className="lp-input" />
            {age ? <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>Età stimata: {age}</div> : null}
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Peso (kg)</div>
            <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 12,4" />
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Sesso</div>
            <select value={sex} onChange={(e) => setSex(e.target.value as Pet["sex"])} className="lp-select">
              <option value="unknown">Non specificato</option>
              <option value="male">Maschio</option>
              <option value="female">Femmina</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs lp-muted mb-1">Attività</div>
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Pet["activityLevel"])} className="lp-select">
              <option value="low">Bassa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm md:col-span-2 lp-panel px-3 py-2">
            <input type="checkbox" checked={neutered} onChange={(e) => setNeutered(e.target.checked)} />
            Sterilizzato/a
          </label>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs lp-muted mb-1">Condizione corporea (scala 1–9)</div>
              <input value={bodyConditionScore} onChange={(e) => setBodyConditionScore(e.target.value)} inputMode="numeric" className="lp-input" placeholder="Es. 5 (ideale)" />
              <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>1 molto magro · 5 ideale · 9 molto sovrappeso</div>
            </label>
            <label className="block">
              <div className="text-xs lp-muted mb-1">Altezza (cm)</div>
              <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 42" />
            </label>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs lp-muted mb-1">Microchip</div>
              <input value={microchipId} onChange={(e) => setMicrochipId(e.target.value)} className="lp-input" placeholder="Codice" />
            </label>
            <label className="block">
              <div className="text-xs lp-muted mb-1">Passaporto (opz.)</div>
              <input value={passportId} onChange={(e) => setPassportId(e.target.value)} className="lp-input" />
            </label>
          </div>

          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Registro / identificazione (opz.)</div>
            <input value={registry} onChange={(e) => setRegistry(e.target.value)} className="lp-input" />
          </label>

          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Carattere (tag separati da virgola)</div>
            <input value={temperamentTags} onChange={(e) => setTemperamentTags(e.target.value)} placeholder="socievole, energico" className="lp-input" />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

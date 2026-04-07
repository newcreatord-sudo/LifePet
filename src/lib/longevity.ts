import type { Pet, PetLog, PetTask } from "@/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSpecies(species: string | undefined) {
  return String(species ?? "").trim().toLowerCase();
}

export function petAgeYears(pet: Pick<Pet, "dob">, nowMs: number) {
  if (!pet.dob) return null;
  const t = new Date(pet.dob).getTime();
  if (!Number.isFinite(t)) return null;
  const years = (nowMs - t) / (365.25 * 24 * 60 * 60 * 1000);
  return years >= 0 ? years : null;
}

export function estimateLifeExpectancyYears(pet: Pick<Pet, "species" | "weightKg">) {
  const s = normalizeSpecies(pet.species);
  const w = typeof pet.weightKg === "number" && Number.isFinite(pet.weightKg) ? pet.weightKg : null;

  if (s.includes("cat") || s.includes("gatto")) return 15;
  if (s.includes("dog") || s.includes("cane")) {
    if (w === null) return 13;
    if (w < 10) return 15;
    if (w < 25) return 13;
    if (w < 40) return 11;
    return 9;
  }
  if (s.includes("rabbit") || s.includes("coniglio")) return 10;
  if (s.includes("hamster") || s.includes("criceto")) return 2.5;
  if (s.includes("parrot") || s.includes("pappagallo")) return 25;
  if (s.includes("duck") || s.includes("anatra")) return 10;
  if (s.includes("turtle") || s.includes("tartaruga")) return 30;

  return 12;
}

export type LongevityStatus = "green" | "yellow" | "red";

export type LongevitySnapshot = {
  longevityScore: number;
  status: LongevityStatus;
  ageYears: number | null;
  expectancyYears: number;
  remainingYears: number | null;
  confidence: "low" | "medium";
  factors: {
    symptoms30d: number;
    weightLogs30d: number;
    activity7d: number;
    water7d: number;
    adherence7d: number;
    overdueTasks7d: number;
  };
  suggestions: string[];
};

export function computeLongevitySnapshot(input: {
  pet: Pick<Pet, "species" | "weightKg" | "dob" | "healthProfile">;
  logs30d: PetLog[];
  tasks: PetTask[];
  nowMs: number;
}) {
  const { pet, logs30d, tasks, nowMs } = input;
  const from7d = nowMs - 7 * 24 * 60 * 60 * 1000;

  const symptoms30d = logs30d.filter((l) => l.type === "symptom").length;
  const weightLogs30d = logs30d.filter((l) => l.type === "weight").length;
  const activity7d = logs30d.filter((l) => l.type === "activity" && l.occurredAt >= from7d).length;
  const water7d = logs30d.filter((l) => l.type === "water" && l.occurredAt >= from7d).length;

  const due7d = tasks.filter((t) => (t.dueAt ?? 0) >= from7d && (t.dueAt ?? 0) <= nowMs && t.status === "due").length;
  const done7d = tasks.filter((t) => (t.completedAt ?? 0) >= from7d && (t.completedAt ?? 0) <= nowMs && t.status === "done").length;
  const adherence7d = due7d + done7d === 0 ? 0.7 : clamp(done7d / (due7d + done7d), 0, 1);
  const overdueTasks7d = tasks.filter((t) => (t.dueAt ?? 0) >= from7d && (t.dueAt ?? 0) <= nowMs && t.status === "due").length;

  const expectancyYears = estimateLifeExpectancyYears(pet);
  const ageYears = petAgeYears(pet, nowMs);

  const chronicFactor = (pet.healthProfile?.conditions?.length ?? 0) > 0 ? 0.9 : 1;
  const symptomPenalty = clamp(symptoms30d * 6, 0, 45);
  const trackingBonus = clamp(weightLogs30d * 3, 0, 18);
  const activityBonus = clamp(activity7d * 2, 0, 14);
  const hydrationBonus = clamp(water7d * 1, 0, 10);
  const adherenceBonus = Math.round(adherence7d * 28);
  const overduePenalty = clamp(overdueTasks7d * 3, 0, 18);

  const base = 55;
  const longevityScore = clamp(Math.round((base + trackingBonus + activityBonus + hydrationBonus + adherenceBonus - symptomPenalty - overduePenalty) * chronicFactor), 0, 100);

  const status: LongevityStatus = longevityScore >= 75 ? "green" : longevityScore >= 45 ? "yellow" : "red";

  const confidence: "low" | "medium" = ageYears === null ? "low" : "medium";
  const remainingYears = ageYears === null ? null : clamp(expectancyYears - ageYears, 0, 99);

  const suggestions: string[] = [];
  if (confidence === "low") suggestions.push("Aggiungi la data di nascita per stimare età e aspettativa in modo più accurato.");
  if ((pet.healthProfile?.conditions?.length ?? 0) > 0) suggestions.push("Con condizioni note, punta su routine stabili e controlli programmati.");
  if (symptoms30d >= 3) suggestions.push("Sintomi ricorrenti: registra dettagli e valuta confronto col veterinario.");
  if (water7d === 0) suggestions.push("Idratazione: aggiungi un check quotidiano e registra l’acqua.");
  if (activity7d === 0) suggestions.push("Attività: anche 10–15 minuti al giorno fanno differenza sul lungo periodo.");
  if (weightLogs30d === 0) suggestions.push("Peso: una pesata ogni 2–4 settimane aiuta a prevenire problemi.");
  if (due7d > 0 && adherence7d < 0.6) suggestions.push("Aderenza bassa: semplifica i task o spostali in orari più comodi.");
  if (suggestions.length === 0) suggestions.push("Ottimo: continua con log regolari e routine sostenibili.");

  return {
    longevityScore,
    status,
    ageYears,
    expectancyYears,
    remainingYears,
    confidence,
    factors: { symptoms30d, weightLogs30d, activity7d, water7d, adherence7d, overdueTasks7d },
    suggestions,
  } satisfies LongevitySnapshot;
}


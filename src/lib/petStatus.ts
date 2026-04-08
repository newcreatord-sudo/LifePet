import type { HealthEvent, HealthStatus, Pet, PetLog, PetTask, PetVaccine } from "@/types";

export type PetStatusSnapshot = {
  overall: HealthStatus;
  food: HealthStatus;
  activity: HealthStatus;
  health: HealthStatus;
  score: number;
  metrics: {
    food24h: number;
    food7d: number;
    activity7d: number;
    symptom30d: number;
    weight30d: number;
    highSymptom72h: boolean;
    water24h: number;
    due7d: number;
    done7d: number;
    overdueVaccines: number;
  };
  suggestions: string[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 75) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

export function computePetStatus(input: {
  pet: Pet | null;
  logs30d: PetLog[];
  tasks: PetTask[];
  healthEvents: HealthEvent[];
  vaccines: PetVaccine[];
  nowMs: number;
}): PetStatusSnapshot {
  const { pet, logs30d, tasks, healthEvents, vaccines, nowMs } = input;
  const from24h = nowMs - 24 * 60 * 60 * 1000;
  const from72h = nowMs - 72 * 60 * 60 * 1000;
  const from7d = nowMs - 7 * 24 * 60 * 60 * 1000;
  const from30d = nowMs - 30 * 24 * 60 * 60 * 1000;

  const food24h = logs30d.filter((l) => l.type === "food" && l.occurredAt >= from24h).length;
  const food7d = logs30d.filter((l) => l.type === "food" && l.occurredAt >= from7d).length;
  const activity7d = logs30d.filter((l) => l.type === "activity" && l.occurredAt >= from7d).length;
  const water24h = logs30d.filter((l) => l.type === "water" && l.occurredAt >= from24h).length;
  const symptom30d = logs30d.filter((l) => l.type === "symptom" && l.occurredAt >= from30d).length;
  const weight30d = logs30d.filter((l) => l.type === "weight" && l.occurredAt >= from30d).length;

  const highSymptom72h = healthEvents.some(
    (e) => e.type === "symptom" && e.severity === "high" && e.occurredAt >= from72h
  );

  const due7d = tasks.filter((t) => (t.dueAt ?? 0) >= from7d && (t.dueAt ?? 0) <= nowMs && t.status === "due").length;
  const done7d = tasks.filter(
    (t) => (t.completedAt ?? 0) >= from7d && (t.completedAt ?? 0) <= nowMs && t.status === "done"
  ).length;

  const overdueVaccines = vaccines.filter((v) => (v.nextDueAt ?? 0) > 0 && (v.nextDueAt ?? 0) <= nowMs).length;

  const hasDietProfile = Boolean(pet?.currentFood?.label || pet?.dietNotes);
  let food: HealthStatus = "green";
  if (food24h === 0 && food7d === 0 && !hasDietProfile) food = "yellow";
  else if (food24h === 0) food = "yellow";

  let activity: HealthStatus = "green";
  if (activity7d === 0) activity = pet?.activityLevel ? "yellow" : "yellow";
  else if (activity7d < 3) activity = "yellow";

  let health: HealthStatus = "green";
  if (highSymptom72h) health = "red";
  else if (symptom30d >= 6) health = "red";
  else if (symptom30d >= 3) health = "yellow";
  else if (overdueVaccines > 0) health = "yellow";

  const adherence = due7d === 0 ? 0.7 : clamp(done7d / (done7d + due7d), 0, 1);
  const base = 62;
  const symptomPenalty = clamp(symptom30d * 7, 0, 50);
  const foodPenalty = clamp(food24h === 0 ? 7 : 0, 0, 10) + clamp(food7d === 0 ? 10 : 0, 0, 12);
  const activityBonus = clamp(activity7d * 2, 0, 12);
  const hydrationBonus = clamp(water24h > 0 ? 6 : 0, 0, 10);
  const adherenceScore = Math.round(adherence * 30);
  const vaccinePenalty = clamp(overdueVaccines * 6, 0, 18);
  const score = clamp(base + activityBonus + hydrationBonus + adherenceScore - symptomPenalty - foodPenalty - vaccinePenalty, 0, 100);

  let overall = statusFromScore(score);
  if (health === "red") overall = "red";
  else if (food === "yellow" || activity === "yellow" || health === "yellow") overall = overall === "red" ? "red" : "yellow";

  const suggestions: string[] = [];
  if (health === "red" && highSymptom72h) suggestions.push("Sintomo severità alta negli ultimi 3 giorni: valuta contatto veterinario.");
  if (overdueVaccines > 0) suggestions.push("Vaccini scaduti o in ritardo: controlla e pianifica richiamo.");
  if (food24h === 0) suggestions.push("Nessun log alimentazione nelle ultime 24h: registra pasti e porzioni.");
  if (!hasDietProfile) suggestions.push("Imposta alimentazione: marca/cibo, note e kcal per migliorare il monitoraggio.");
  if (activity7d === 0) suggestions.push("Nessun log attività negli ultimi 7 giorni: aggiungi movimento leggero e registra.");
  if (water24h === 0) suggestions.push("Nessun log acqua nelle ultime 24h: controlla idratazione e ciotola.");
  if (due7d > 0 && adherence < 0.6) suggestions.push("Aderenza routine bassa: semplifica task o cambia orari.");
  if (symptom30d >= 3) suggestions.push("Sintomi ricorrenti: registra dettagli e monitora trend.");
  if (suggestions.length === 0) suggestions.push("Continua così: routine e log regolari migliorano la prevenzione.");

  return {
    overall,
    food,
    activity,
    health,
    score,
    metrics: { food24h, food7d, activity7d, symptom30d, weight30d, highSymptom72h, water24h, due7d, done7d, overdueVaccines },
    suggestions,
  };
}

export function statusLabel(s: HealthStatus) {
  if (s === "green") return "Sano";
  if (s === "yellow") return "Attenzione";
  return "Rischio";
}

export function statusEmoji(s: HealthStatus) {
  if (s === "green") return "🟢";
  if (s === "yellow") return "🟡";
  return "🔴";
}

export function statusClass(s: HealthStatus) {
  if (s === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-800";
  if (s === "yellow") return "border-amber-400/30 bg-amber-400/10 text-amber-900";
  return "border-rose-400/30 bg-rose-500/10 text-rose-900";
}

import type { AdoptionPost } from "@/types";

export type QuizPreference = "any" | "dog" | "cat";
export type QuizHome = "apartment" | "house_small_yard" | "house_big_yard";
export type QuizActivity = "low" | "medium" | "high";
export type QuizTime = "low" | "medium" | "high";
export type QuizExperience = "none" | "some" | "expert";
export type QuizKids = "none" | "young" | "teens";
export type QuizOtherPets = "none" | "dog" | "cat" | "both";
export type QuizAgePref = "any" | "puppy_kitten" | "adult" | "senior";

export type AdoptionQuiz = {
  preference: QuizPreference;
  home: QuizHome;
  space: "small" | "medium" | "large";
  time: QuizTime;
  activity: QuizActivity;
  experience: QuizExperience;
  kids: QuizKids;
  otherPets: QuizOtherPets;
  aloneTime: QuizTime;
  noiseTolerance: QuizActivity;
  groomingTolerance: QuizActivity;
  agePreference: QuizAgePref;
};

export const DEFAULT_ADOPTION_QUIZ: AdoptionQuiz = {
  preference: "any",
  home: "apartment",
  space: "medium",
  time: "medium",
  activity: "medium",
  experience: "some",
  kids: "none",
  otherPets: "none",
  aloneTime: "medium",
  noiseTolerance: "medium",
  groomingTolerance: "medium",
  agePreference: "any",
};

export type MatchResult = {
  score: number;
  reasons: string[];
  tags: string[];
};

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normToken(s: string) {
  return stripAccents(String(s || "").trim().toLowerCase())
    .replace(/[@]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function addTag(out: Set<string>, raw: string) {
  const t = normToken(raw);
  if (!t) return;

  const map: Array<[RegExp, string]> = [
    [/^(kids_ok|adatto_ai_bambini|bambini_ok|ok_bambini)$/i, "kids_ok"],
    [/^(no_kids|non_adatto_ai_bambini|senza_bambini|no_bambini)$/i, "no_kids"],
    [/^(cats_ok|ok_gatti|adatto_ai_gatti)$/i, "cats_ok"],
    [/^(no_cats|non_adatto_ai_gatti)$/i, "no_cats"],
    [/^(dogs_ok|ok_cani|adatto_ai_cani)$/i, "dogs_ok"],
    [/^(no_dogs|non_adatto_ai_cani)$/i, "no_dogs"],
    [/^(only_pet|figlio_unico|solo_pet|solo_in_casa)$/i, "only_pet"],
    [/^(energy_low|calmo|tranquillo|bassa_energia)$/i, "energy_low"],
    [/^(energy_med|energia_media)$/i, "energy_med"],
    [/^(energy_high|attivo|iperattivo|alta_energia)$/i, "energy_high"],
    [/^(apt_ok|appartamento_ok|indoor_ok|casa_ok)$/i, "apt_ok"],
    [/^(needs_yard|giardino_richiesto|preferisce_giardino)$/i, "needs_yard"],
    [/^(first_time_ok|prima_esperienza_ok|principianti_ok)$/i, "first_time_ok"],
    [/^(experienced_owner|esperti|solo_esperti)$/i, "experienced_owner"],
    [/^(quiet|silenzioso|poco_vocale)$/i, "quiet"],
    [/^(vocal|abbaia|miagola|molto_vocale)$/i, "vocal"],
    [/^(grooming_low|pelo_corto|bassa_manutenzione)$/i, "grooming_low"],
    [/^(grooming_high|pelo_lungo|alta_manutenzione)$/i, "grooming_high"],
    [/^(puppy|cucciolo|kitten|gattino)$/i, "age_puppy"],
    [/^(adult|adulto)$/i, "age_adult"],
    [/^(senior|anziano)$/i, "age_senior"],
    [/^(special_needs|bisogni_speciali|terapia|cure)$/i, "special_needs"],
    [/^(shy|timido)$/i, "shy"],
    [/^(social|socievole)$/i, "social"],
  ];

  for (const [re, canon] of map) {
    if (re.test(t)) {
      out.add(canon);
      return;
    }
  }

  out.add(t.slice(0, 24));
}

function extractTags(p: AdoptionPost) {
  const out = new Set<string>();
  for (const t of p.temperamentTags ?? []) addTag(out, t);

  const text = stripAccents(
    `${p.description || ""} ${(p.name ?? "")} ${(p.ageLabel ?? "")} ${(p.locationLabel ?? "")} ${(p.shelterLabel ?? "")}`.toLowerCase()
  );

  const patterns: Array<[RegExp, string]> = [
    [/non\s+adatto\s+ai\s+bambini|no\s+bambini/, "no_kids"],
    [/adatto\s+ai\s+bambini|ok\s+bambini/, "kids_ok"],
    [/ok\s+con\s+gatti|adatto\s+ai\s+gatti/, "cats_ok"],
    [/non\s+adatto\s+ai\s+gatti|no\s+gatti/, "no_cats"],
    [/ok\s+con\s+cani|adatto\s+ai\s+cani/, "dogs_ok"],
    [/non\s+adatto\s+ai\s+cani|no\s+cani/, "no_dogs"],
    [/figlio\s+unico|solo\s+in\s+casa/, "only_pet"],
    [/alta\s+energia|molto\s+attivo/, "energy_high"],
    [/bassa\s+energia|tranquillo|calmo/, "energy_low"],
    [/appartamento|indoor/, "apt_ok"],
    [/giardino\s+(necessario|richiesto)|serve\s+giardino/, "needs_yard"],
    [/prima\s+esperienza\s+ok|adatto\s+ai\s+principianti/, "first_time_ok"],
    [/solo\s+esperti|richiede\s+esperienza/, "experienced_owner"],
    [/bisogni\s+speciali|terapia|cure\s+continue/, "special_needs"],
    [/cucciolo|gattino/, "age_puppy"],
    [/anziano|senior/, "age_senior"],
  ];

  for (const [re, tag] of patterns) {
    if (re.test(text)) out.add(tag);
  }

  return Array.from(out);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function scoreAgePref(p: AdoptionPost, tags: Set<string>, pref: QuizAgePref) {
  if (pref === "any") return 0;
  const isPuppy = tags.has("age_puppy") || /cucciol|gattin/i.test(p.ageLabel || "") || /(mesi|month)/i.test(p.ageLabel || "");
  const isSenior = tags.has("age_senior") || /senior|anzian/i.test(p.ageLabel || "");
  const isAdult = tags.has("age_adult") || (!isPuppy && !isSenior);
  if (pref === "puppy_kitten") return isPuppy ? 10 : -10;
  if (pref === "senior") return isSenior ? 10 : -10;
  if (pref === "adult") return isAdult ? 8 : -8;
  return 0;
}

export function scoreAdoption(p: AdoptionPost, quiz: AdoptionQuiz): MatchResult {
  const tagsArr = extractTags(p);
  const tags = new Set(tagsArr);
  const reasons: string[] = [];

  let score = 50;

  const sp = normToken(p.species);
  const isDog = sp === "dog" || sp === "cane";
  const isCat = sp === "cat" || sp === "gatto";

  if (quiz.preference === "dog" && !isDog) return { score: -100, reasons: ["Preferisci un cane"], tags: tagsArr };
  if (quiz.preference === "cat" && !isCat) return { score: -100, reasons: ["Preferisci un gatto"], tags: tagsArr };

  if (isDog) score += 10;
  if (isCat) score += 10;

  if (quiz.kids !== "none") {
    if (tags.has("no_kids")) {
      score -= 60;
      reasons.push("Non adatto a bambini");
    } else if (tags.has("kids_ok")) {
      score += 18;
      reasons.push("Adatto a bambini");
    }
  }

  if (quiz.otherPets !== "none") {
    if (tags.has("only_pet")) {
      score -= 45;
      reasons.push("Preferisce essere figlio unico");
    }
    if (quiz.otherPets === "cat" || quiz.otherPets === "both") {
      if (tags.has("no_cats")) {
        score -= 45;
        reasons.push("Non adatto con gatti");
      } else if (tags.has("cats_ok")) {
        score += 14;
        reasons.push("Ok con gatti");
      }
    }
    if (quiz.otherPets === "dog" || quiz.otherPets === "both") {
      if (tags.has("no_dogs")) {
        score -= 45;
        reasons.push("Non adatto con cani");
      } else if (tags.has("dogs_ok")) {
        score += 14;
        reasons.push("Ok con cani");
      }
    }
  }

  const energy = tags.has("energy_high") ? "high" : tags.has("energy_low") ? "low" : tags.has("energy_med") ? "medium" : null;
  if (energy) {
    if (quiz.activity === energy) {
      score += 12;
      reasons.push(energy === "high" ? "Energia alta" : energy === "low" ? "Molto tranquillo" : "Energia media");
    } else if (quiz.activity === "low" && energy === "high") {
      score -= 18;
      reasons.push("Richiede molta attività");
    } else if (quiz.activity === "high" && energy === "low") {
      score -= 8;
      reasons.push("Molto tranquillo per il tuo livello attività");
    }
  }

  if (quiz.time === "low" && (energy === "high" || tags.has("special_needs"))) {
    score -= 18;
    if (tags.has("special_needs")) reasons.push("Bisogni speciali");
  }

  if (quiz.experience === "none") {
    if (tags.has("experienced_owner")) {
      score -= 15;
      reasons.push("Richiede esperienza");
    }
    if (tags.has("first_time_ok")) {
      score += 10;
      reasons.push("Ok per prima esperienza");
    }
  }

  if (quiz.home === "apartment") {
    if (tags.has("needs_yard")) {
      score -= 25;
      reasons.push("Preferisce giardino");
    } else if (tags.has("apt_ok")) {
      score += 10;
      reasons.push("Ok in appartamento");
    }
  }

  if (quiz.noiseTolerance === "low") {
    if (tags.has("vocal")) {
      score -= 10;
      reasons.push("Molto vocale");
    } else if (tags.has("quiet")) {
      score += 6;
      reasons.push("Poco vocale");
    }
  }

  if (quiz.groomingTolerance === "low" && tags.has("grooming_high")) {
    score -= 8;
    reasons.push("Richiede cura del pelo");
  }

  score += scoreAgePref(p, tags, quiz.agePreference);

  const size = p.size;
  if (quiz.space === "small" && size === "large") {
    score -= 8;
    reasons.push("Taglia grande");
  }
  if (quiz.space === "large" && size === "small" && quiz.activity === "high") {
    score -= 4;
  }

  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);
  return { score: clamp(score, 0, 100), reasons: uniqueReasons, tags: tagsArr };
}

export function mergeTemperamentTags(freeInput: string, selected: string[]) {
  const out = new Set<string>();
  for (const s of selected) addTag(out, s);
  for (const t of String(freeInput || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    addTag(out, t);
  }
  return Array.from(out).slice(0, 12);
}

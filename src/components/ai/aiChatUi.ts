export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
  streaming?: boolean;
};

export function uid() {
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function storageKey(petId: string, scopeKey: string) {
  return `lifepet:ai:uiChat:${petId}:${scopeKey}`;
}

export function buildContext(section: string, petName: string) {
  return (
    "Sei PetLyon AI, assistente per la gestione del benessere degli animali domestici. " +
    "Risposte informative, non sostituiscono il veterinario. " +
    "Se emergono segnali urgenti, suggerisci pronto intervento.\n" +
    `Contesto: sezione ${section}. Pet: ${petName}.\n` +
    "Stile: pratico, breve e rassicurante. " +
    "Formato: sintesi breve, prossimi passi (bullet), cosa monitorare, quando contattare un professionista."
  );
}

export function extractTaskCandidates(answer: string) {
  const lines = answer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 14);
  const out: string[] = [];
  for (const l of lines) {
    const clean = l.replace(/^[-*\d.)]\s+/, "").trim();
    if (clean.length < 8) continue;
    out.push(clean.slice(0, 90));
    if (out.length >= 4) break;
  }
  return out;
}

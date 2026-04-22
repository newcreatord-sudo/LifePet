import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoId } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { extractJsonValue } from "@/lib/aiJson";
import { getApiBase } from "@/lib/apiBase";
import type { AgendaEvent, AiChatResponse, AiSummaryResponse } from "@/types";

function callableMessage(e: unknown) {
  const anyErr = e as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
  const details = typeof anyErr?.details === "string" ? anyErr.details : "";
  const combined = [code, msg, details].filter(Boolean).join(" ");

  if (/functions\/unavailable|\bunavailable\b/i.test(combined) || /service\s+is\s+unavailable/i.test(combined)) {
    return "Servizio AI non disponibile. Riprova tra poco.";
  }

  const parts = [code, msg, details].filter(Boolean);
  return parts.length ? parts.join(" · ") : "AI request failed";
}

function shouldFallbackToVercel(e: unknown) {
  const anyErr = e as { code?: unknown; message?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  if (
    code === "functions/not-found" ||
    code === "functions/unimplemented" ||
    code === "functions/unavailable" ||
    code === "functions/internal" ||
    code === "functions/deadline-exceeded" ||
    code === "functions/unknown" ||
    code === "failed-precondition"
  )
    return true;
  const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
  return (
    /function(s)?\s+not\s+found/i.test(msg) ||
    /unimplemented/i.test(msg) ||
    /OPENAI_API_KEY/i.test(msg) ||
    /INTERNAL/i.test(msg)
  );
}

async function getIdToken() {
  const u = getFirebase().auth.currentUser;
  if (!u) return "";
  try {
    return await u.getIdToken();
  } catch {
    return "";
  }
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function localKey(conversationId: string) {
  return `lifepet:ai:chat:${conversationId}`;
}

function loadLocalMessages(conversationId: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(localKey(conversationId));
    const json = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(json) ? (json as ChatMsg[]).filter((m) => m && typeof m.content === "string" && typeof m.role === "string") : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(conversationId: string, messages: ChatMsg[]) {
  try {
    localStorage.setItem(localKey(conversationId), JSON.stringify(messages));
  } catch {
    return;
  }
}

async function vercelFetch(path: string, payload: unknown) {
  const base = getApiBase();

  const token = await getIdToken();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Devi accedere per usare l’AI.");
      }
      if (res.status === 503) {
        try {
          const json = text ? (JSON.parse(text) as unknown) : null;
          const err = json as { error?: unknown };
          const msg = typeof err?.error === "string" ? err.error : "";
          if (msg) throw new Error(msg);
        } catch {
          await Promise.resolve();
        }
        throw new Error("Servizio AI non disponibile. Riprova tra poco.");
      }
      if (res.status === 429) {
        throw new Error("Servizio AI temporaneamente limitato (troppi tentativi). Riprova tra poco.");
      }
      try {
        const json = text ? (JSON.parse(text) as unknown) : null;
        const err = json as { error?: unknown };
        const msg = typeof err?.error === "string" ? err.error : text;
        if (/service\s+is\s+unavailable/i.test(String(msg || ""))) {
          throw new Error("Servizio AI non disponibile. Riprova tra poco.");
        }
        throw new Error(String(msg || "AI request failed"));
      } catch {
        if (/service\s+is\s+unavailable/i.test(String(text || ""))) {
          throw new Error("Servizio AI non disponibile. Riprova tra poco.");
        }
        throw new Error(text || "AI request failed");
      }
    }
    return text ? (JSON.parse(text) as unknown) : null;
  } finally {
    clearTimeout(t);
  }
}

export async function aiGenerateSummary(petId: string, days: number) {
  if (shouldUseDemoData()) {
    const res: AiSummaryResponse = {
      summary:
        `Riassunto demo degli ultimi ${days} giorni (pet ${petId}):\n\n` +
        "• Mantieni i pasti regolari e controlla il peso 1 volta a settimana.\n" +
        "• Se i sintomi persistono o peggiorano, contatta il veterinario.\n" +
        "• Aggiungi un task giornaliero per monitorare l’idratazione.",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiGenerateSummary");
  try {
    const res = await fn({ petId, days });
    return res.data as AiSummaryResponse;
  } catch (e) {
    if (!shouldFallbackToVercel(e)) throw new Error(callableMessage(e));
    const prompt =
      `Genera un riassunto del benessere del pet per gli ultimi ${days} giorni. ` +
      "Metti la salute al primo posto: segnali di allarme, cosa monitorare a casa, quando contattare il veterinario.\n" +
      "Formato: punti elenco brevi, massimo 10.";
    const r = await aiChat(petId, null, prompt);
    return { summary: r.answer || "", citations: [] };
  }
}

export async function aiChat(petId: string, conversationId: string | null, message: string) {
  if (shouldUseDemoData()) {
    const res: AiChatResponse & { conversationId: string } = {
      conversationId: conversationId ?? demoId(),
      answer:
        "Risposta demo AI (non è un parere veterinario):\n\n" +
        "1) Registra il sintomo con intensità e orario.\n" +
        "2) Monitora acqua e attività per 24 ore.\n" +
        "3) Se cala l’appetito, compaiono vomito/diarrea o cambia il respiro: contatta il veterinario.",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiChat");
  try {
    const timeoutMs = 20_000;
    const res = await Promise.race([
      fn({ petId, conversationId, message }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject({ code: "functions/deadline-exceeded", message: "timeout" }),
          timeoutMs
        )
      ),
    ]);
    return (res as { data: unknown }).data as AiChatResponse & { conversationId: string };
  } catch (e) {
    if (!shouldFallbackToVercel(e)) throw new Error(callableMessage(e));
    const cid = conversationId && conversationId.startsWith("local_") ? conversationId : `local_${Date.now()}`;
    const base = conversationId && conversationId.startsWith("local_") ? loadLocalMessages(cid) : [];
    const messages: ChatMsg[] = [
      {
        role: "system",
        content:
          "Sei un assistente veterinario. Fai domande mirate. Non sostituire il veterinario. Se ci sono segnali di emergenza, suggerisci pronto intervento.",
      },
      ...base,
      { role: "user", content: message },
    ];
    let answer = "";
    try {
      const json = (await vercelFetch("/api/ai-chat", { messages })) as { answer?: string };
      answer = String(json.answer || "");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      const safeReason = (() => {
        const r = String(reason || "").trim();
        if (!r) return "";
        if (/\bsk-[A-Za-z0-9_-]+/i.test(r)) return "";
        if (/\bvck_[A-Za-z0-9_-]+/i.test(r)) return "";
        return r.slice(0, 280);
      })();

      const hintMissingKey = /AI_DISABLED|AI\s+non\s+configurata|AI_GATEWAY_API_KEY|OPENAI_API_KEY|missing/i.test(reason);
      const hintAuth = /Auth\s+non\s+configurata|FIREBASE_PROJECT_ID|Unauthorized|Devi\s+accedere/i.test(reason);
      const hintRate = /\b429\b|limitato|troppi\s+tentativi/i.test(reason);

      const hint =
        (hintMissingKey
          ? "\n\nNota tecnica: il backend AI non è configurato. Su Vercel imposta `AI_GATEWAY_API_KEY` (consigliata) oppure `OPENAI_API_KEY`, poi fai redeploy."
          : "") +
        (hintAuth
          ? "\n\nNota tecnica: autenticazione server non configurata o sessione non valida. Su Vercel verifica `FIREBASE_PROJECT_ID` e fai redeploy, poi ricarica e accedi di nuovo."
          : "") +
        (hintRate ? "\n\nNota tecnica: troppe richieste (rate limit). Riprova tra poco." : "") +
        (safeReason ? `\n\nDettaglio: ${safeReason}` : "");
      answer =
        "Non riesco a contattare il servizio AI in questo momento.\n\n" +
        "Priorità: sicurezza del tuo animale.\n\n" +
        "Se c’è uno di questi segnali: respiro difficile, collasso, convulsioni, sanguinamento importante, trauma, sospetta intossicazione, addome gonfio doloroso → pronto intervento veterinario.\n\n" +
        "Nel frattempo, dimmi: specie/razza, età e peso, da quanto dura, appetito e acqua, vomito/diarrea, temperatura (se disponibile), livello di energia, dolore evidente, farmaci assunti.\n\n" +
        "Consigli generali sicuri: acqua disponibile, ambiente tranquillo, evita farmaci umani, monitora respirazione e idratazione." +
        hint;
    }
    saveLocalMessages(cid, [...base, { role: "user", content: message }, { role: "assistant", content: answer }]);
    return { conversationId: cid, answer, citations: [] };
  }
}

type ExtractVisitResult = {
  visit: null | {
    scheduledAt: number;
    providerName?: string;
    notes?: string;
  };
  confidence: number;
};

function extractJsonObject(raw: string) {
  const v = extractJsonValue(raw);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v;
}

export async function aiExtractVisit(petId: string, text: string, nowMs: number) {
  const t = String(text || "").trim();
  if (!t) return { visit: null, confidence: 0 } as ExtractVisitResult;
  if (shouldUseDemoData()) return { visit: null, confidence: 0 } as ExtractVisitResult;

  const sys =
    "Sei un estrattore di eventi per PetLyon.\n" +
    "Obiettivo: estrarre una VISITA/PRENOTAZIONE dal testo del proprietario.\n" +
    "Restituisci SOLO JSON valido (senza markdown, senza testo extra).\n" +
    "Schema: {\"visit\": null | {\"scheduledAt\": number, \"providerName\"?: string, \"notes\"?: string}, \"confidence\": number}.\n" +
    "scheduledAt deve essere un timestamp ms (epoch).\n" +
    "Interpreta date relative (oggi/domani/tra X) usando nowMs e fuso Europe/Rome.\n" +
    "Se manca una data/ora abbastanza chiara, metti visit=null e confidence=0.";

  try {
    const json = (await vercelFetch("/api/ai-chat", {
      messages: [
        { role: "system", content: `${sys}\nnowMs=${nowMs}` },
        { role: "user", content: t },
      ],
    })) as { answer?: unknown };
    const parsed = extractJsonObject(String(json?.answer ?? ""));
    const v = parsed as ExtractVisitResult;
    const conf = typeof v?.confidence === "number" && Number.isFinite(v.confidence) ? v.confidence : 0;
    const scheduledAt = typeof v?.visit?.scheduledAt === "number" && Number.isFinite(v.visit.scheduledAt) ? v.visit.scheduledAt : 0;
    if (!v?.visit || !scheduledAt || scheduledAt < nowMs - 5 * 60_000) return { visit: null, confidence: 0 } as ExtractVisitResult;
    return {
      visit: {
        scheduledAt,
        providerName: typeof v.visit.providerName === "string" ? v.visit.providerName : undefined,
        notes: typeof v.visit.notes === "string" ? v.visit.notes : undefined,
      },
      confidence: Math.max(0, Math.min(1, conf)),
    } as ExtractVisitResult;
  } catch {
    return { visit: null, confidence: 0 } as ExtractVisitResult;
  }
}

type ExtractActionsResult = {
  confidence: {
    visit: number;
    vaccine: number;
    medication: number;
    expense: number;
  };
  visit: null | {
    scheduledAt: number;
    providerName?: string;
    notes?: string;
  };
  vaccine: null | {
    name: string;
    lastAt?: number | null;
    intervalDays?: number | null;
    reminderDaysBefore?: number | null;
    notes?: string;
  };
  medication: null | {
    name: string;
    dose?: string;
    unit?: string;
    route?: string;
    times?: string[];
    startAt: number;
    endAt?: number | null;
    notes?: string;
  };
  expense: null | {
    amount: number;
    currency?: string;
    category?: string;
    occurredAt?: number;
    note?: string;
  };
};

export async function aiExtractActions(petId: string, text: string, nowMs: number) {
  const t = String(text || "").trim();
  if (!t) {
    return {
      confidence: { visit: 0, vaccine: 0, medication: 0, expense: 0 },
      visit: null,
      vaccine: null,
      medication: null,
      expense: null,
    } as ExtractActionsResult;
  }
  if (shouldUseDemoData()) {
    return {
      confidence: { visit: 0, vaccine: 0, medication: 0, expense: 0 },
      visit: null,
      vaccine: null,
      medication: null,
      expense: null,
    } as ExtractActionsResult;
  }

  const sys =
    "Sei un estrattore di eventi per PetLyon.\n" +
    "Estrai SOLO se nel testo ci sono dettagli abbastanza chiari.\n" +
    "Restituisci SOLO JSON valido (senza markdown).\n" +
    "Schema: {\n" +
    "  \"confidence\": {\"visit\": number, \"vaccine\": number, \"medication\": number, \"expense\": number},\n" +
    "  \"visit\": null | {\"scheduledAt\": number, \"providerName\"?: string, \"notes\"?: string},\n" +
    "  \"vaccine\": null | {\"name\": string, \"lastAt\"?: number|null, \"intervalDays\"?: number|null, \"reminderDaysBefore\"?: number|null, \"notes\"?: string},\n" +
    "  \"medication\": null | {\"name\": string, \"dose\"?: string, \"unit\"?: string, \"route\"?: string, \"times\"?: string[], \"startAt\": number, \"endAt\"?: number|null, \"notes\"?: string},\n" +
    "  \"expense\": null | {\"amount\": number, \"currency\"?: string, \"category\"?: string, \"occurredAt\"?: number, \"note\"?: string}\n" +
    "}.\n" +
    "Regole: timestamp in ms (epoch). Usa nowMs e fuso Europe/Rome.\n" +
    "confidence è 0..1. Se manca una data/ora per visit/med, metti null e confidence=0.\n" +
    "Per expense: se manca data usa nowMs. Se manca valuta usa EUR. category deve essere una tra: food, vet, grooming, training, accessories, medicine, other.\n" +
    "Per vaccine: se manca intervalDays o reminderDaysBefore puoi lasciarli null.";

  try {
    const json = (await vercelFetch("/api/ai-chat", {
      messages: [
        { role: "system", content: `${sys}\nnowMs=${nowMs}` },
        { role: "user", content: t },
      ],
    })) as { answer?: unknown };
    const parsed = extractJsonObject(String(json?.answer ?? ""));
    const v = parsed as ExtractActionsResult;
    const confAny = (v && typeof v === "object" ? (v as { confidence?: unknown }).confidence : null) as unknown;
    const conf = (confAny && typeof confAny === "object" ? (confAny as Record<string, unknown>) : {}) as Record<string, unknown>;
    const clamp = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
    return {
      confidence: {
        visit: clamp(conf.visit),
        vaccine: clamp(conf.vaccine),
        medication: clamp(conf.medication),
        expense: clamp(conf.expense),
      },
      visit: v?.visit ?? null,
      vaccine: v?.vaccine ?? null,
      medication: v?.medication ?? null,
      expense: v?.expense ?? null,
    } as ExtractActionsResult;
  } catch {
    return {
      confidence: { visit: 0, vaccine: 0, medication: 0, expense: 0 },
      visit: null,
      vaccine: null,
      medication: null,
      expense: null,
    } as ExtractActionsResult;
  }
}

export async function aiVisionAnalyze(petId: string, imageDataUrl: string, prompt: string) {
  if (shouldUseDemoData()) {
    const res: AiChatResponse & { conversationId: string } = {
      conversationId: demoId(),
      answer: "Risposta demo AI visione (non è un parere veterinario).",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiVisionAnalyze");
  try {
    const res = await fn({ petId, imageDataUrl, prompt });
    return res.data as AiChatResponse & { conversationId?: string };
  } catch (e) {
    if (!shouldFallbackToVercel(e)) throw new Error(callableMessage(e));
    try {
      const json = (await vercelFetch("/api/ai-vision", { imageDataUrl, prompt })) as { answer?: string };
      return { answer: String(json.answer || ""), citations: [] };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      const hint = /AI_GATEWAY_API_KEY|OPENAI_API_KEY|missing/i.test(reason)
        ? "\n\nNota tecnica: il backend AI non è configurato (manca una chiave su Vercel)."
        : "";
      return {
        answer:
          "Non riesco a contattare il servizio AI per analizzare la foto.\n\n" +
          "Se l’animale è in dolore, sanguina, non respira bene o peggiora rapidamente → veterinario urgente.\n\n" +
          "Nel frattempo: descrivi cosa vedi (zona, arrossamento, gonfiore, ferita, secrezioni), da quando, e se l’animale zoppica o si gratta.\n" +
          "Puoi anche aggiungere una foto più ravvicinata con buona luce." +
          hint,
        citations: [],
      };
    }
  }
}

export async function aiVisionAnalyzeMulti(petId: string, imageDataUrls: string[], prompt: string) {
  if (shouldUseDemoData()) {
    const res: AiChatResponse & { conversationId: string } = {
      conversationId: demoId(),
      answer: "Risposta demo AI video (non è un parere veterinario).",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiVisionAnalyzeMulti");
  try {
    const res = await fn({ petId, imageDataUrls, prompt });
    return res.data as AiChatResponse & { conversationId?: string };
  } catch (e) {
    if (!shouldFallbackToVercel(e)) throw new Error(callableMessage(e));
    try {
      const json = (await vercelFetch("/api/ai-vision-multi", { imageDataUrls, prompt })) as { answer?: string };
      return { answer: String(json.answer || ""), citations: [] };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      const hint = /AI_GATEWAY_API_KEY|OPENAI_API_KEY|missing/i.test(reason)
        ? "\n\nNota tecnica: il backend AI non è configurato (manca una chiave su Vercel)."
        : "";
      return {
        answer:
          "Non riesco a contattare il servizio AI per analizzare il video.\n\n" +
          "Se noti respiro affannoso, collasso, tremori/convulsioni, dolore intenso o trauma → veterinario urgente.\n\n" +
          "Descrivi: cosa succede nel video (andatura, respiro, tosse, comportamento), durata, e cosa ha scatenato il problema." +
          hint,
        citations: [],
      };
    }
  }
}

type SuggestReminderResult = {
  reminder: null | {
    title: string;
    dueAt: number;
    kind: AgendaEvent["kind"];
    reminderMinutesBefore?: number | null;
    notes?: string;
  };
  confidence: number;
};

export async function aiSuggestReminder(petId: string, inputText: string, nowMs: number) {
  const t = String(inputText || "").trim();
  if (!t) return { reminder: null, confidence: 0 } as SuggestReminderResult;
  if (shouldUseDemoData()) return { reminder: null, confidence: 0 } as SuggestReminderResult;

  const sys =
    "Sei un estrattore di promemoria per PetLyon.\n" +
    "Obiettivo: proporre UN singolo promemoria/appuntamento in agenda, se il testo lo richiede.\n" +
    "Restituisci SOLO JSON valido (senza markdown, senza testo extra).\n" +
    "Schema: {\"reminder\": null | {\"title\": string, \"dueAt\": number, \"kind\": \"vet\"|\"grooming\"|\"training\"|\"cleaning\"|\"other\", \"reminderMinutesBefore\"?: number|null, \"notes\"?: string}, \"confidence\": number}.\n" +
    "dueAt è timestamp ms. Usa nowMs e fuso Europe/Rome.\n" +
    "Se manca una data/ora abbastanza chiara, metti reminder=null e confidence=0.\n" +
    "title deve essere breve e in italiano.";

  try {
    const json = (await vercelFetch("/api/ai-chat", {
      messages: [
        { role: "system", content: `${sys}\nnowMs=${nowMs}` },
        { role: "user", content: t },
      ],
    })) as { answer?: unknown };
    const parsed = extractJsonObject(String(json?.answer ?? ""));
    const v = parsed as SuggestReminderResult;
    const conf = typeof v?.confidence === "number" && Number.isFinite(v.confidence) ? Math.max(0, Math.min(1, v.confidence)) : 0;
    const dueAt = typeof v?.reminder?.dueAt === "number" && Number.isFinite(v.reminder.dueAt) ? v.reminder.dueAt : 0;
    const title = typeof v?.reminder?.title === "string" ? v.reminder.title.trim() : "";
    const kind = String((v?.reminder as { kind?: unknown } | null)?.kind || "other").trim();
    const allowed: Array<AgendaEvent["kind"]> = ["vet", "grooming", "training", "cleaning", "other"];
    const safeKind = (allowed.includes(kind as AgendaEvent["kind"]) ? kind : "other") as AgendaEvent["kind"];
    if (!title || !dueAt || dueAt < nowMs - 5 * 60_000 || conf <= 0) return { reminder: null, confidence: 0 } as SuggestReminderResult;

    const minutesRaw = (v?.reminder as { reminderMinutesBefore?: unknown } | null)?.reminderMinutesBefore;
    const reminderMinutesBefore =
      typeof minutesRaw === "number" && Number.isFinite(minutesRaw) ? Math.max(0, Math.round(minutesRaw)) : null;
    const notes = typeof (v?.reminder as { notes?: unknown } | null)?.notes === "string" ? (v.reminder!.notes || "").trim() : "";

    return {
      reminder: {
        title,
        dueAt,
        kind: safeKind,
        reminderMinutesBefore,
        notes: notes || undefined,
      },
      confidence: conf,
    } as SuggestReminderResult;
  } catch {
    return { reminder: null, confidence: 0 } as SuggestReminderResult;
  }
}

type SuggestAgendaEventsResult = {
  events: Array<{
    title: string;
    dueAt: number;
    kind: AgendaEvent["kind"];
    reminderMinutesBefore?: number | null;
    notes?: string;
  }>;
  confidence: number;
};

export async function aiSuggestAgendaEvents(petId: string, inputText: string, nowMs: number, maxEvents: number) {
  const t = String(inputText || "").trim();
  if (!t) return { events: [], confidence: 0 } as SuggestAgendaEventsResult;
  if (shouldUseDemoData()) return { events: [], confidence: 0 } as SuggestAgendaEventsResult;

  const safeMax = Math.max(1, Math.min(10, Math.floor(maxEvents || 6)));
  const sys =
    "Sei un estrattore di eventi agenda per PetLyon.\n" +
    "Obiettivo: proporre PIÙ eventi/promemoria a partire dal testo dell’utente.\n" +
    "Restituisci SOLO JSON valido (senza markdown, senza testo extra).\n" +
    `Massimo eventi: ${safeMax}.\n` +
    "Schema: {\"events\": Array<{\"title\": string, \"dueAt\": number, \"kind\": \"vet\"|\"grooming\"|\"training\"|\"cleaning\"|\"other\", \"reminderMinutesBefore\"?: number|null, \"notes\"?: string}>, \"confidence\": number}.\n" +
    "dueAt è timestamp ms. Usa nowMs e fuso Europe/Rome.\n" +
    "Regole: title breve in italiano; kind coerente; reminderMinutesBefore opzionale (0..10080).\n" +
    "Se un evento non ha data/ora abbastanza chiara, NON includerlo.\n" +
    "confidence è 0..1 (quanto sei sicuro che la lista sia corretta).";

  try {
    const json = (await vercelFetch("/api/ai-chat", {
      messages: [
        { role: "system", content: `${sys}\nnowMs=${nowMs}` },
        { role: "user", content: t },
      ],
    })) as { answer?: unknown };

    const parsed = extractJsonObject(String(json?.answer ?? ""));
    const v = parsed as SuggestAgendaEventsResult;
    const conf = typeof v?.confidence === "number" && Number.isFinite(v.confidence) ? Math.max(0, Math.min(1, v.confidence)) : 0;
    const rawEvents = Array.isArray(v?.events) ? v.events : [];

    const allowed: Array<AgendaEvent["kind"]> = ["vet", "grooming", "training", "cleaning", "other"];
    const normalized = rawEvents
      .map((e) => {
        const title = typeof e?.title === "string" ? e.title.trim() : "";
        const dueAt = typeof e?.dueAt === "number" && Number.isFinite(e.dueAt) ? e.dueAt : 0;
        const kindRaw = typeof (e as { kind?: unknown })?.kind === "string" ? String((e as { kind?: unknown }).kind).trim() : "other";
        const kind = (allowed.includes(kindRaw as AgendaEvent["kind"]) ? kindRaw : "other") as AgendaEvent["kind"];
        const minutesRaw = (e as { reminderMinutesBefore?: unknown })?.reminderMinutesBefore;
        const reminderMinutesBefore =
          typeof minutesRaw === "number" && Number.isFinite(minutesRaw) ? Math.max(0, Math.min(10080, Math.round(minutesRaw))) : null;
        const notes = typeof (e as { notes?: unknown })?.notes === "string" ? String((e as { notes?: unknown }).notes || "").trim() : "";
        return { title, dueAt, kind, reminderMinutesBefore, notes: notes || undefined };
      })
      .filter((e) => e.title && e.dueAt && e.dueAt >= nowMs - 5 * 60_000)
      .slice(0, safeMax);

    return { events: normalized, confidence: conf } as SuggestAgendaEventsResult;
  } catch {
    return { events: [], confidence: 0 } as SuggestAgendaEventsResult;
  }
}

type SuggestAgendaPlanResult = {
  series: Array<{
    title: string;
    kind: AgendaEvent["kind"];
    startAt: number;
    timeOfDay: string;
    recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] };
    reminderMinutesBefore?: number | null;
    notes?: string;
  }>;
  events: SuggestAgendaEventsResult["events"];
  confidence: number;
};

export async function aiSuggestAgendaPlan(
  petId: string,
  inputText: string,
  nowMs: number,
  maxEvents: number,
  maxSeries: number
) {
  const t = String(inputText || "").trim();
  if (!t) return { series: [], events: [], confidence: 0 } as SuggestAgendaPlanResult;
  if (shouldUseDemoData()) return { series: [], events: [], confidence: 0 } as SuggestAgendaPlanResult;

  const safeMaxEvents = Math.max(0, Math.min(10, Math.floor(maxEvents || 6)));
  const safeMaxSeries = Math.max(0, Math.min(8, Math.floor(maxSeries || 4)));

  const sys =
    "Sei un estrattore di piano agenda per PetLyon.\n" +
    "Obiettivo: proporre EVENTI singoli e RICORRENZE (serie) a partire dal testo dell’utente.\n" +
    "Restituisci SOLO JSON valido (senza markdown, senza testo extra).\n" +
    `Massimo eventi: ${safeMaxEvents}. Massimo serie: ${safeMaxSeries}.\n` +
    "Schema: {\n" +
    "  \"series\": Array<{\n" +
    "    \"title\": string,\n" +
    "    \"kind\": \"vet\"|\"grooming\"|\"training\"|\"cleaning\"|\"other\",\n" +
    "    \"startAt\": number,\n" +
    "    \"timeOfDay\": string,\n" +
    "    \"recurrence\": {\"type\":\"daily\"} | {\"type\":\"weekly\",\"weekdays\": number[]},\n" +
    "    \"reminderMinutesBefore\"?: number|null,\n" +
    "    \"notes\"?: string\n" +
    "  }>,\n" +
    "  \"events\": Array<{\"title\": string, \"dueAt\": number, \"kind\": \"vet\"|\"grooming\"|\"training\"|\"cleaning\"|\"other\", \"reminderMinutesBefore\"?: number|null, \"notes\"?: string}>,\n" +
    "  \"confidence\": number\n" +
    "}.\n" +
    "Regole: timestamp ms; usa nowMs e fuso Europe/Rome.\n" +
    "Per series: timeOfDay deve essere HH:MM (24h). startAt può essere oggi o futuro; se incerto NON includere.\n" +
    "Per weekly weekdays: 0=Dom ... 6=Sab. Includi solo 0..6, senza duplicati.\n" +
    "Se un elemento non ha data/ora abbastanza chiara, NON includerlo.";

  try {
    const json = (await vercelFetch("/api/ai-chat", {
      messages: [
        { role: "system", content: `${sys}\nnowMs=${nowMs}` },
        { role: "user", content: t },
      ],
    })) as { answer?: unknown };

    const parsed = extractJsonObject(String(json?.answer ?? ""));
    const v = parsed as SuggestAgendaPlanResult;
    const conf = typeof v?.confidence === "number" && Number.isFinite(v.confidence) ? Math.max(0, Math.min(1, v.confidence)) : 0;

    const allowed: Array<AgendaEvent["kind"]> = ["vet", "grooming", "training", "cleaning", "other"];

    const eventsRaw = Array.isArray(v?.events) ? v.events : [];
    const events = eventsRaw
      .map((e) => {
        const title = typeof e?.title === "string" ? e.title.trim() : "";
        const dueAt = typeof e?.dueAt === "number" && Number.isFinite(e.dueAt) ? e.dueAt : 0;
        const kindRaw = typeof (e as { kind?: unknown })?.kind === "string" ? String((e as { kind?: unknown }).kind).trim() : "other";
        const kind = (allowed.includes(kindRaw as AgendaEvent["kind"]) ? kindRaw : "other") as AgendaEvent["kind"];
        const minutesRaw = (e as { reminderMinutesBefore?: unknown })?.reminderMinutesBefore;
        const reminderMinutesBefore =
          typeof minutesRaw === "number" && Number.isFinite(minutesRaw) ? Math.max(0, Math.min(10080, Math.round(minutesRaw))) : null;
        const notes = typeof (e as { notes?: unknown })?.notes === "string" ? String((e as { notes?: unknown }).notes || "").trim() : "";
        return { title, dueAt, kind, reminderMinutesBefore, notes: notes || undefined };
      })
      .filter((e) => e.title && e.dueAt && e.dueAt >= nowMs - 5 * 60_000)
      .slice(0, safeMaxEvents);

    const seriesRaw = Array.isArray(v?.series) ? v.series : [];
    const series = seriesRaw
      .map((s) => {
        const title = typeof s?.title === "string" ? s.title.trim() : "";
        const startAt = typeof (s as { startAt?: unknown })?.startAt === "number" && Number.isFinite((s as { startAt?: unknown }).startAt)
          ? Number((s as { startAt?: unknown }).startAt)
          : 0;
        const timeOfDay = typeof (s as { timeOfDay?: unknown })?.timeOfDay === "string" ? String((s as { timeOfDay?: unknown }).timeOfDay).trim() : "";
        const kindRaw = typeof (s as { kind?: unknown })?.kind === "string" ? String((s as { kind?: unknown }).kind).trim() : "other";
        const kind = (allowed.includes(kindRaw as AgendaEvent["kind"]) ? kindRaw : "other") as AgendaEvent["kind"];
        const recAny = (s as { recurrence?: unknown })?.recurrence;
        const recObj = recAny && typeof recAny === "object" && !Array.isArray(recAny) ? (recAny as Record<string, unknown>) : null;
        const type = typeof recObj?.type === "string" ? recObj.type : "daily";
        const minutesRaw = (s as { reminderMinutesBefore?: unknown })?.reminderMinutesBefore;
        const reminderMinutesBefore =
          typeof minutesRaw === "number" && Number.isFinite(minutesRaw) ? Math.max(0, Math.min(10080, Math.round(minutesRaw))) : null;
        const notes = typeof (s as { notes?: unknown })?.notes === "string" ? String((s as { notes?: unknown }).notes || "").trim() : "";

        const recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] } =
          type === "weekly"
            ? {
                type: "weekly",
                weekdays: Array.isArray(recObj?.weekdays)
                  ? Array.from(
                      new Set(
                        (recObj!.weekdays as unknown[])
                          .map((x) => (typeof x === "number" ? Math.floor(x) : NaN))
                          .filter((x) => Number.isFinite(x) && x >= 0 && x <= 6)
                      )
                    ).sort((a, b) => a - b)
                  : [],
              }
            : { type: "daily" };

        return { title, kind, startAt, timeOfDay, recurrence, reminderMinutesBefore, notes: notes || undefined };
      })
      .filter((s) => {
        if (!s.title) return false;
        if (!s.startAt || s.startAt < nowMs - 30 * 24 * 60 * 60 * 1000) return false;
        if (!/^\d{2}:\d{2}$/.test(s.timeOfDay)) return false;
        if (s.recurrence.type === "weekly" && (!s.recurrence.weekdays || s.recurrence.weekdays.length === 0)) return false;
        return true;
      })
      .slice(0, safeMaxSeries);

    return { series, events, confidence: conf } as SuggestAgendaPlanResult;
  } catch {
    return { series: [], events: [], confidence: 0 } as SuggestAgendaPlanResult;
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, CornerDownLeft, FileImage, Film, ListPlus, NotebookPen, RefreshCcw, Trash2, X } from "lucide-react";
import { aiChat, aiExtractActions } from "@/data/ai";
import { aiGenerateSummary, aiVisionAnalyze, aiVisionAnalyzeMulti } from "@/data/ai";
import { createHealthEvent } from "@/data/health";
import { createAgendaEvent } from "@/data/agenda";
import { createBooking } from "@/data/bookings";
import { createNotification } from "@/data/notifications";
import { createProvider } from "@/data/providers";
import { createVaccine } from "@/data/vaccines";
import { createMedication } from "@/data/medications";
import { createExpense } from "@/data/expenses";
import { createTask } from "@/data/tasks";
import type { ExpenseCategory } from "@/types";
import { isDemoModeEnabled } from "@/lib/runtimeMode";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { AiChatMessageList } from "@/components/ai/AiChatMessageList";
import { buildContext, extractTaskCandidates, storageKey, uid, type ChatMessage } from "@/components/ai/aiChatUi";
import { extractFramesFromVideoFile, readAsDataUrl } from "@/lib/media";
import { upsertAiSave } from "@/data/aiSaves";
import { getApiBase } from "@/lib/apiBase";
import { getFirebase } from "@/lib/firebase";

export function AiChatWidget(props: {
  petId: string;
  petName: string;
  section: string;
  scopeKey: string;
  quickPrompts: Array<{ label: string; text: string }>;
  navigateOnSave?: boolean;
  onLastErrorChange?: (msg: string | null) => void;
  enableAttachments?: boolean;
  enableInsights?: boolean;
  draft?: string;
  onDraftConsumed?: () => void;
}) {
  const {
    petId,
    petName,
    section,
    scopeKey,
    quickPrompts,
    navigateOnSave,
    onLastErrorChange,
    enableAttachments,
    enableInsights,
    draft,
    onDraftConsumed,
  } = props;
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();

  const canUse = Boolean(user && petId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const [attachment, setAttachment] = useState<null | { kind: "image" | "video"; file: File }>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const didSeedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(petId, scopeKey));
      const json = raw ? (JSON.parse(raw) as unknown) : null;
      const data = json as { conversationId?: unknown; messages?: unknown };
      const cid = typeof data?.conversationId === "string" ? data.conversationId : null;
      const msgs = Array.isArray(data?.messages)
        ? (data.messages as ChatMessage[]).filter((m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.text === "string" &&
            typeof m.id === "string" &&
            typeof m.ts === "number"
          )
        : [];
      setConversationId(cid);
      setMessages(msgs.slice(-40));
      didSeedRef.current = Boolean(cid);
    } catch {
      return;
    }
  }, [petId, scopeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(petId, scopeKey),
        JSON.stringify({ conversationId, messages: messages.slice(-60) })
      );
    } catch {
      return;
    }
  }, [conversationId, messages, petId, scopeKey]);

  useEffect(() => {
    onLastErrorChange?.(lastError);
  }, [lastError, onLastErrorChange]);

  useEffect(() => {
    const d = String(draft || "").trim();
    if (!d) return;
    setInput((prev) => (prev.trim() ? prev : d));
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const allowAttachments = enableAttachments !== false;
  const allowInsights = enableInsights !== false;

  function dedupeKey(parts: Array<string | number | null | undefined>) {
    const compact = parts
      .map((p) => (p === null || p === undefined ? "" : String(p).trim().toLowerCase()))
      .filter(Boolean)
      .join("|");
    return `lifepet:auto:${petId}:${compact}`;
  }

  function shouldSkipDedupe(key: string, ttlMs: number) {
    try {
      const raw = localStorage.getItem(key);
      const ts = raw ? Number(raw) : 0;
      if (!ts || !Number.isFinite(ts)) return false;
      return Date.now() - ts < ttlMs;
    } catch {
      return false;
    }
  }

  function markDedupe(key: string) {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      return;
    }
  }

  function shouldUseLocalFallback(err: unknown) {
    if (isDemoModeEnabled()) return true;
    const anyErr = err as { code?: unknown; message?: unknown };
    const code = typeof anyErr?.code === "string" ? anyErr.code : "";
    const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
    return (
      code === "permission-denied" ||
      code === "unauthenticated" ||
      code === "unavailable" ||
      /Missing\s+or\s+insufficient\s+permissions/i.test(msg) ||
      /permission\s*denied/i.test(msg) ||
      /unauthenticated/i.test(msg) ||
      /net::ERR_ABORTED/i.test(msg) ||
      /Failed to fetch/i.test(msg) ||
      /client is offline/i.test(msg)
    );
  }

  function isReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function aiApiBase() {
    return getApiBase();
  }

  async function send(text: string) {
    if (!canUse || !user) return;
    const t = text.trim();
    if (!t && !attachment) return;
    setLastError(null);

    if (t) {
      const userMsg: ChatMessage = { id: uid(), role: "user", text: t, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg].slice(-60));
    }
    setInput("");
    setBusy(true);
    try {
      const nowMs = Date.now();
      const shouldTryCapture = /\b(appuntamento|prenotat|visita|veterinari|vet|clinica|vaccin|terapia|farmac|medicine|pillol|antibiotic|spes[ao]|pagat|€|euro)\b/i.test(
        t
      );
      const capturePromise = shouldTryCapture
        ? aiExtractActions(petId, t, nowMs)
        : Promise.resolve({
            confidence: { visit: 0, vaccine: 0, medication: 0, expense: 0 },
            visit: null,
            vaccine: null,
            medication: null,
            expense: null,
          });

      if (attachment) {
        const id = uid();
        const assistantMsg: ChatMessage = { id, role: "assistant", text: "Analisi in corso…", ts: Date.now(), streaming: true };
        setMessages((prev) => [...prev, assistantMsg].slice(-60));
        const notes = t ? `Note proprietario: ${t}` : "";
        const base = [
          "Sei PetLyon AI.",
          "Rispondi in italiano.",
          "NON fare diagnosi e NON prescrivere farmaci.",
          "Restituisci: 1) Osservazioni possibili 2) Cosa monitorare 24-48h 3) Segnali di allarme (contatta vet) 4) Cosa fare oggi 5) Come ottenere dati migliori.",
          `Contesto: sezione ${section}. Pet: ${petName}.`,
          attachment.kind === "image" ? "Allegato: immagine." : "Allegato: video (estratti alcuni frame).",
          notes,
        ]
          .filter(Boolean)
          .join("\n");

        let answer = "";
        if (attachment.kind === "image") {
          const dataUrl = await readAsDataUrl(attachment.file);
          const res = await aiVisionAnalyze(petId, dataUrl, base);
          answer = String(res.answer || "").trim();
        } else {
          const frames = await extractFramesFromVideoFile(attachment.file, 8);
          const res = await aiVisionAnalyzeMulti(petId, frames, base);
          answer = String(res.answer || "").trim();
        }
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: answer || "(Nessuna risposta)", streaming: false } : m)));
        setAttachment(null);
        setBusy(false);
        return;
      }

      const cid = conversationId ?? `local_${Date.now()}`;
      if (!conversationId) setConversationId(cid);

      const history = messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.text }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());

      const seed = didSeedRef.current || conversationId ? null : buildContext(section, petName);
      const payload = {
        messages: [
          ...(seed ? [{ role: "system" as const, content: seed }] : []),
          ...history,
          { role: "user" as const, content: t },
        ],
      };

      didSeedRef.current = true;
      const id = uid();
      const assistantMsg: ChatMessage = { id, role: "assistant", text: "", ts: Date.now(), streaming: true };
      setMessages((prev) => [...prev, assistantMsg].slice(-60));

      if (isReducedMotion()) {
        const res = await aiChat(petId, cid, t);
        const a = String(res.answer || "").trim() || "(Nessuna risposta)";
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: a, streaming: false } : m)));
        setBusy(false);
        return;
      }

      if (user && (user as { isDemo?: boolean }).isDemo) {
        const res = await aiChat(petId, cid, t);
        const a = String(res.answer || "").trim() || "(Nessuna risposta)";
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: a, streaming: false } : m)));
        setBusy(false);
        return;
      }

      let finalText: string | null = null;
      try {
        const ctrl = new AbortController();
        const timeoutMs = 22_000;
        const tt = window.setTimeout(() => ctrl.abort(), timeoutMs);
        const token = await (async () => {
          try {
            const u = getFirebase().auth.currentUser;
            if (!u) return "";
            return await u.getIdToken();
          } catch {
            return "";
          }
        })();
        const res = await fetch(`${aiApiBase()}/api/ai-chat-stream`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        }).finally(() => window.clearTimeout(tt));
        if (!res.ok || !res.body) throw new Error(await res.text());

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let pending = "";
        let lastFlush = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          pending += chunk;
          const now = performance.now();
          if (now - lastFlush > 40) {
            full += pending;
            pending = "";
            lastFlush = now;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: full, streaming: true } : m)));
          }
        }

        full += pending;
        const m = full.match(/\n\n\[AI_ERROR\]\s*([\s\S]*)$/);
        if (m && m[1]) {
          const errMsg = String(m[1]).trim();
          if (errMsg) setLastError(errMsg);
          finalText = full.replace(/\n\n\[AI_ERROR\][\s\S]*$/, "").trim() || "(Nessuna risposta)";
        } else {
          finalText = full.trim() || "(Nessuna risposta)";
        }
      } catch {
        const res = await aiChat(petId, cid, t);
        finalText = String(res.answer || "").trim() || "(Nessuna risposta)";
      }

      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: finalText || "(Nessuna risposta)", streaming: false } : m)));
      setBusy(false);

      try {
        const saveId = `${cid}_${id}`;
        await upsertAiSave(petId, saveId, {
          conversationId: cid,
          section,
          userText: t,
          assistantText: finalText || "(Nessuna risposta)",
          status: "succeeded",
          createdAt: Date.now(),
          createdBy: user.uid,
        });
      } catch (e) {
        if (shouldUseLocalFallback(e)) {
          pushToast({ type: "info", title: "Salvataggio non disponibile", message: "Connessione instabile: ho mantenuto la chat localmente." });
        }
      }

      try {
        const extracted = await capturePromise;
        const createdAt = Date.now();
        const savedLines: string[] = [];
        const ttlMs = 12 * 60 * 60 * 1000;
        const autoSaveErrors: string[] = [];

        if (extracted.visit && extracted.confidence.visit >= 0.7) {
          const providerName = String(extracted.visit.providerName || "Veterinario").trim() || "Veterinario";
          const scheduledAt = extracted.visit.scheduledAt;
          const k = dedupeKey(["visit", providerName, scheduledAt]);
          if (shouldSkipDedupe(k, ttlMs)) {
            savedLines.push(`Visita: ${providerName} (${new Date(scheduledAt).toLocaleString()}) (già salvata)`);
          } else {
            try {
              const providerId = await createProvider({
                name: providerName,
                kind: "vet",
                createdAt,
                createdBy: user.uid,
              });

              const bookingId = await createBooking(
                petId,
                user.uid,
                { id: providerId, name: providerName, kind: "vet", createdAt, createdBy: user.uid },
                scheduledAt,
                null,
                extracted.visit.notes
              );

              await createAgendaEvent(petId, {
                petId,
                title: `Visita: ${providerName}`,
                dueAt: scheduledAt,
                kind: "vet",
                reminderMinutesBefore: 60,
                createdAt,
                createdBy: user.uid,
              });

              await createTask(petId, {
                petId,
                title: `Promemoria: visita ${providerName}`,
                status: "due",
                dueAt: Math.max(createdAt, scheduledAt - 60 * 60 * 1000),
                createdAt,
                createdBy: user.uid,
              });

              await createHealthEvent(petId, {
                petId,
                type: "visit",
                occurredAt: scheduledAt,
                title: `Visita: ${providerName}`,
                note: extracted.visit.notes,
                createdAt,
                createdBy: user.uid,
              });

              await createNotification(petId, {
                petId,
                createdBy: user.uid,
                type: `booking_created:${bookingId}`,
                title: "Visita salvata",
                body: `Ho salvato la visita con ${providerName} (${new Date(scheduledAt).toLocaleString()}).`,
                severity: "info",
                createdAt,
                read: false,
              });

              pushToast({ type: "success", title: "Visita salvata", message: `${providerName} · ${new Date(scheduledAt).toLocaleString()}` });
              savedLines.push(`Visita: ${providerName} (${new Date(scheduledAt).toLocaleString()})`);
              markDedupe(k);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Salvataggio visita fallito";
              autoSaveErrors.push(`Visita: ${msg}`);
              if (shouldUseLocalFallback(e)) {
                pushToast({ type: "info", title: "Connessione instabile", message: "Non riesco a salvare automaticamente. Riprova tra poco." });
              }
            }
          }
        }

        if (extracted.vaccine && extracted.confidence.vaccine >= 0.72) {
          const name = String(extracted.vaccine.name || "").trim();
          if (name) {
            const lastAt = typeof extracted.vaccine.lastAt === "number" ? extracted.vaccine.lastAt : null;
            const k = dedupeKey(["vaccine", name, lastAt ?? 0]);
            if (shouldSkipDedupe(k, ttlMs)) {
              savedLines.push(`Vaccino: ${name} (già salvato)`);
            } else {
              try {
                const intervalDays =
                  typeof extracted.vaccine.intervalDays === "number" && Number.isFinite(extracted.vaccine.intervalDays)
                    ? Math.max(7, Math.floor(extracted.vaccine.intervalDays))
                    : 365;
                const reminderDaysBefore =
                  typeof extracted.vaccine.reminderDaysBefore === "number" && Number.isFinite(extracted.vaccine.reminderDaysBefore)
                    ? Math.max(0, Math.floor(extracted.vaccine.reminderDaysBefore))
                    : 14;
                const notes = [
                  extracted.vaccine.notes,
                  extracted.vaccine.intervalDays ? null : "Intervallo predefinito 365g (modifica se diverso).",
                ]
                  .filter(Boolean)
                  .join("\n");
                const vaccineId = await createVaccine(petId, {
                  petId,
                  name,
                  lastAt,
                  intervalDays,
                  reminderDaysBefore,
                  notes: notes || undefined,
                  createdBy: user.uid,
                  createdAt,
                });
                await createHealthEvent(petId, {
                  petId,
                  type: "vaccine",
                  occurredAt: lastAt ?? createdAt,
                  title: `Vaccino: ${name}`,
                  note: notes || undefined,
                  createdAt,
                  createdBy: user.uid,
                });
                await createNotification(petId, {
                  petId,
                  createdBy: user.uid,
                  type: `vaccine_created:${vaccineId}`,
                  title: "Vaccino salvato",
                  body: `Ho salvato il vaccino “${name}”. Prossima scadenza calcolata automaticamente.`,
                  severity: "info",
                  createdAt,
                  read: false,
                });
                pushToast({ type: "success", title: "Vaccino salvato", message: name });
                savedLines.push(`Vaccino: ${name}`);
                markDedupe(k);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Salvataggio vaccino fallito";
                autoSaveErrors.push(`Vaccino: ${msg}`);
                if (shouldUseLocalFallback(e)) {
                  pushToast({ type: "info", title: "Connessione instabile", message: "Non riesco a salvare automaticamente. Riprova tra poco." });
                }
              }
            }
          }
        }

        if (extracted.medication && extracted.confidence.medication >= 0.72) {
          const name = String(extracted.medication.name || "").trim();
          const startAt = extracted.medication.startAt;
          if (name && typeof startAt === "number" && Number.isFinite(startAt)) {
            const timesRaw = Array.isArray(extracted.medication.times) ? extracted.medication.times : [];
            const times = timesRaw.filter((x) => typeof x === "string" && /^\d{2}:\d{2}$/.test(x)).slice(0, 6);
            const k = dedupeKey(["med", name, startAt, times.join(",")]);
            if (shouldSkipDedupe(k, ttlMs)) {
              savedLines.push(`Terapia: ${name} (già salvata)`);
            } else {
              try {
                const medId = await createMedication(petId, {
                  petId,
                  name,
                  dose: extracted.medication.dose,
                  unit: extracted.medication.unit,
                  route: extracted.medication.route,
                  times: times.length ? times : ["09:00"],
                  startAt,
                  endAt: typeof extracted.medication.endAt === "number" ? extracted.medication.endAt : undefined,
                  enabled: true,
                  notes: extracted.medication.notes,
                  createdAt,
                  createdBy: user.uid,
                });
                await createHealthEvent(petId, {
                  petId,
                  type: "med",
                  occurredAt: startAt,
                  title: `Terapia: ${name}`,
                  note: extracted.medication.notes,
                  createdAt,
                  createdBy: user.uid,
                });
                await createNotification(petId, {
                  petId,
                  createdBy: user.uid,
                  type: `med_created:${medId}`,
                  title: "Terapia salvata",
                  body: `Ho salvato la terapia “${name}” e creato i promemoria nel planner.`,
                  severity: "info",
                  createdAt,
                  read: false,
                });
                pushToast({ type: "success", title: "Terapia salvata", message: name });
                savedLines.push(`Terapia: ${name}`);
                markDedupe(k);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Salvataggio terapia fallito";
                autoSaveErrors.push(`Terapia: ${msg}`);
                if (shouldUseLocalFallback(e)) {
                  pushToast({ type: "info", title: "Connessione instabile", message: "Non riesco a salvare automaticamente. Riprova tra poco." });
                }
              }
            }
          }
        }

        if (extracted.expense && extracted.confidence.expense >= 0.75) {
          const amount = extracted.expense.amount;
          if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
            const currency = String(extracted.expense.currency || "EUR").trim().toUpperCase() || "EUR";
            const occurredAt =
              typeof extracted.expense.occurredAt === "number" && Number.isFinite(extracted.expense.occurredAt)
                ? extracted.expense.occurredAt
                : createdAt;
            const category = String(extracted.expense.category || "other").trim().toLowerCase();
            const allowed: ExpenseCategory[] = ["food", "vet", "grooming", "training", "accessories", "medicine", "other"];
            const cat = (allowed.includes(category as ExpenseCategory) ? category : "other") as ExpenseCategory;
            const k = dedupeKey(["expense", amount, currency, occurredAt, cat]);
            if (shouldSkipDedupe(k, ttlMs)) {
              savedLines.push(`Spesa: ${amount} ${currency} (già salvata)`);
            } else {
              try {
                const expenseId = await createExpense(petId, {
                  petId,
                  amount,
                  currency,
                  category: cat,
                  occurredAt,
                  note: extracted.expense.note,
                  createdAt,
                  createdBy: user.uid,
                });
                await createNotification(petId, {
                  petId,
                  createdBy: user.uid,
                  type: `expense_created:${expenseId}`,
                  title: "Spesa salvata",
                  body: `Ho salvato una spesa di ${amount} ${currency}.`,
                  severity: "info",
                  createdAt,
                  read: false,
                });
                pushToast({ type: "success", title: "Spesa salvata", message: `${amount} ${currency}` });
                savedLines.push(`Spesa: ${amount} ${currency}`);
                markDedupe(k);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Salvataggio spesa fallito";
                autoSaveErrors.push(`Spesa: ${msg}`);
                if (shouldUseLocalFallback(e)) {
                  pushToast({ type: "info", title: "Connessione instabile", message: "Non riesco a salvare automaticamente. Riprova tra poco." });
                }
              }
            }
          }
        }

        if (savedLines.length) {
          const summary = `Ho salvato automaticamente:\n${savedLines.map((x) => `• ${x}`).join("\n")}`;
          setMessages((prev) => [...prev, { id: uid(), role: "assistant" as const, text: summary, ts: Date.now() }].slice(-60));
        }

        if (autoSaveErrors.length) {
          const msg = `Auto-salvataggio non riuscito:\n${autoSaveErrors.map((x) => `• ${x}`).join("\n")}`;
          setMessages((prev) => [...prev, { id: uid(), role: "assistant" as const, text: msg, ts: Date.now() }].slice(-60));
          pushToast({ type: "error", title: "Auto-salvataggio", message: "Non sono riuscito a salvare tutto. Apri il dettaglio nella chat." });
        }
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operazione fallita";
      setLastError(msg);
      setMessages((prev) =>
        [...prev, { id: uid(), role: "assistant" as const, text: `Errore: ${msg}`, ts: Date.now(), streaming: false }].slice(-60)
      );
      setBusy(false);
    }
  }

  async function runInsights(days: number) {
    if (!canUse || busy) return;
    setBusy(true);
    setLastError(null);
    const id = uid();
    const assistantMsg: ChatMessage = { id, role: "assistant", text: "Sto creando gli insights…", ts: Date.now(), streaming: true };
    setMessages((prev) => [...prev, assistantMsg].slice(-60));
    try {
      const res = await aiGenerateSummary(petId, days);
      const s = String(res.summary || "").trim();
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: s || "(Nessun dato)", streaming: false } : m)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operazione fallita";
      setLastError(msg);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: `Errore: ${msg}`, streaming: false } : m)));
    } finally {
      setBusy(false);
    }
  }

  async function saveToHealthMessage(m: ChatMessage) {
    if (!user) return;
    try {
      const now = Date.now();
      await createHealthEvent(petId, {
        petId,
        createdBy: user.uid,
        type: "note",
        title: `AI · ${section}`,
        note: m.text,
        severity: "low",
        occurredAt: now,
        createdAt: now,
      });
      pushToast({ type: "success", title: "Cartella clinica", message: "Salvato." });
      if (navigateOnSave) navigate("/app/records");
    } catch (e) {
      pushToast({ type: "error", title: "Cartella clinica", message: e instanceof Error ? e.message : "Salvataggio fallito" });
    }
  }

  async function createTasksFromMessage(m: ChatMessage) {
    if (!user) return;
    const candidates = extractTaskCandidates(m.text);
    if (!candidates.length) {
      pushToast({ type: "error", title: "Planner", message: "Non trovo task chiari da creare." });
      return;
    }
    try {
      const now = Date.now();
      for (const title of candidates) {
        await createTask(petId, {
          petId,
          title: `AI: ${title}`,
          status: "due",
          createdAt: now,
          createdBy: user.uid,
        });
      }
      pushToast({ type: "success", title: "Planner", message: `Creati ${candidates.length} task.` });
      navigate("/app/planner");
    } catch (e) {
      pushToast({ type: "error", title: "Planner", message: e instanceof Error ? e.message : "Creazione task fallita" });
    }
  }

  function resetChat() {
    setConversationId(null);
    didSeedRef.current = false;
    setMessages([]);
    setLastError(null);
    setBusy(false);
    setAttachment(null);
    try {
      localStorage.removeItem(storageKey(petId, scopeKey));
    } catch {
      return;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((p) => (
          <button
            key={p.label}
            type="button"
            className="lp-chip"
            disabled={busy}
            onClick={() => void send(p.text)}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="lp-chip" disabled={busy} onClick={() => navigate("/app/ai")}>AI avanzata</button>
        {allowInsights ? (
          <button type="button" className="lp-chip" disabled={busy} onClick={() => void runInsights(7)}>
            Insights 7g
          </button>
        ) : null}
        <button
          type="button"
          className="lp-chip"
          disabled={busy}
          onClick={resetChat}
        >
          <span className="inline-flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            Reset
          </span>
        </button>
      </div>

      <AiChatMessageList
        ref={listRef}
        messages={messages}
        busy={busy}
        disableActions={busy}
        onCopy={(m) => {
          void navigator.clipboard.writeText(m.text);
          pushToast({ type: "success", title: "Copiato", message: "Messaggio copiato." });
        }}
        onSave={(m) => void saveToHealthMessage(m)}
        onTasks={(m) => void createTasksFromMessage(m)}
      />

      <div className="grid grid-cols-1 gap-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            className="lp-textarea"
            placeholder={canUse ? "Scrivi una domanda…" : "Accedi e seleziona un pet…"}
            disabled={!canUse || busy}
          />
          {allowAttachments ? (
            <div className="flex flex-col gap-2">
              <label className="lp-btn-secondary px-3 py-2 inline-flex items-center justify-center" aria-label="Allega immagine">
                <FileImage className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!canUse || busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) return;
                    setAttachment({ kind: "image", file: f });
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <label className="lp-btn-secondary px-3 py-2 inline-flex items-center justify-center" aria-label="Allega video">
                <Film className="w-4 h-4" />
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={!canUse || busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) return;
                    setAttachment({ kind: "video", file: f });
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          ) : null}
          <button
            type="button"
            className="lp-btn-primary px-3"
            onClick={() => void send(input)}
            disabled={!canUse || busy || (!input.trim() && !attachment)}
            aria-label="Invia"
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </div>

        {attachment ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
            <div className="text-sm text-slate-800">
              <span className="font-medium">Allegato:</span> {attachment.file.name}
            </div>
            <button type="button" className="lp-btn-icon" onClick={() => setAttachment(null)} disabled={busy} aria-label="Rimuovi allegato">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            disabled={!canUse || !lastAssistant || busy}
            onClick={() => {
              if (!lastAssistant) return;
              void saveToHealthMessage(lastAssistant);
            }}
          >
            <NotebookPen className="w-4 h-4" />
            Salva in cartella clinica
          </button>
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            disabled={!canUse || !lastAssistant || busy}
            onClick={() => {
              if (!lastAssistant) return;
              void createTasksFromMessage(lastAssistant);
            }}
          >
            <ListPlus className="w-4 h-4" />
            Crea task
          </button>
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            disabled={!canUse || !lastAssistant}
            onClick={() => {
              if (!lastAssistant) return;
              void navigator.clipboard.writeText(lastAssistant.text);
              pushToast({ type: "success", title: "Copiato", message: "Risposta copiata." });
            }}
          >
            <ClipboardCheck className="w-4 h-4" />
            Copia
          </button>
          <button
            type="button"
            className="lp-btn-secondary inline-flex items-center gap-2"
            disabled={!canUse || !lastAssistant || busy}
            onClick={() => {
              const lastUser = [...messages].reverse().find((m) => m.role === "user");
              if (!lastUser) return;
              setInput(lastUser.text);
              setLastError(null);
              setMessages((prev) => prev.slice(0, Math.max(0, prev.length - 2)));
              setConversationId(null);
              didSeedRef.current = false;
            }}
          >
            <RefreshCcw className="w-4 h-4" />
            Riprova
          </button>
        </div>

        {lastError ? (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-950 whitespace-pre-wrap break-words">
            {lastError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

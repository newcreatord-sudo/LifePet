import { useEffect, useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { useAuthStore } from "@/stores/authStore";
import { subscribeUserProfile } from "@/data/users";
import { aiChat, aiGenerateSummary } from "@/data/ai";
import { Sparkles } from "lucide-react";
import { aiUserMessage } from "@/lib/aiErrors";
import { createHealthEvent } from "@/data/health";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AiCitation } from "@/types";

type ChatMsg = { role: "user" | "assistant"; text: string };

export default function Insights() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [aiAllowed, setAiAllowed] = useState(true);
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryCitations, setSummaryCitations] = useState<AiCitation[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatCitations, setChatCitations] = useState<AiCitation[]>([]);
  const disclaimer = useMemo(() => "LifePet AI è solo informativa e non sostituisce il veterinario.", []);

  useEffect(() => {
    if (!user || user.isDemo) {
      setAiAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setAiAllowed(p?.preferences?.aiEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  async function onGenerateSummary() {
    if (!activePetId) return;
    setSummaryLoading(true);
    setSummaryCitations([]);
    try {
      const res = await aiGenerateSummary(activePetId, days);
      setSummary(res.summary);
      setSummaryCitations(res.citations ?? []);
    } catch (e) {
      setSummary(aiUserMessage(e));
    } finally {
      setSummaryLoading(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activePetId) return;
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setChatLoading(true);
    setChatCitations([]);
    try {
      const res = await aiChat(activePetId, conversationId, text);
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
      setChatCitations(res.citations ?? []);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: aiUserMessage(e) }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function saveInsightNote(title: string, note: string) {
    if (!user || !activePetId) return;
    await createHealthEvent(activePetId, {
      petId: activePetId,
      type: "note",
      title,
      note,
      occurredAt: Date.now(),
      createdAt: Date.now(),
      createdBy: user.uid,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description="Sintesi AI e domande/risposte basate sui log del tuo pet." />

      {!aiAllowed ? (
        <EmptyState
          title="AI disattivata"
          description="Riattivala in Impostazioni → Preferenze per usare Insights."
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Sintesi</CardTitle>
            <CardDescription>Generazione manuale</CardDescription>
          </CardHeader>
          <CardContent>
          {!aiAllowed ? null : !activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per generare la sintesi." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="lp-select"
                >
                  <option value={7}>Ultimi 7 giorni</option>
                  <option value={30}>Ultimi 30 giorni</option>
                  <option value={90}>Ultimi 90 giorni</option>
                </select>
                <button
                  onClick={onGenerateSummary}
                  disabled={summaryLoading}
                  className="lp-btn-primary inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {summaryLoading ? "Generazione…" : "Genera"}
                </button>

                {user && summary ? (
                  <button type="button" onClick={() => saveInsightNote(`Insight AI (${days}g)`, summary)} className="lp-btn-secondary">
                    Salva in Salute
                  </button>
                ) : null}
              </div>

              <div className="lp-panel p-3 text-sm whitespace-pre-wrap min-h-28">
                {summary ?? "Genera una sintesi per vedere punti chiave e azioni suggerite."}
              </div>

              {summaryCitations.length ? (
                <div className="text-xs text-slate-600">Citazioni: {summaryCitations.map((c) => `${c.kind}:${c.type ?? c.id}`).join(" · ")}</div>
              ) : null}
              <div className="text-xs text-slate-500">{disclaimer}</div>
            </div>
          )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>Chiedi trend, routine o eventi recenti.</CardDescription>
          </CardHeader>
          <CardContent>
          {!aiAllowed ? (
            <EmptyState title="AI disattivata" description="Riattivala in Impostazioni → Preferenze per usare la chat." />
          ) : !activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare la chat." />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 h-80 overflow-auto space-y-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-slate-600">Chiedi di trend, routine o eventi recenti.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[85%] rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-sm"
                          : "mr-auto max-w-[85%] rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-sm"
                      }
                    >
                      {m.text}
                    </div>
                  ))
                )}
              </div>

              {chatCitations.length ? (
                <div className="text-xs text-slate-600">Citazioni: {chatCitations.map((c) => `${c.kind}:${c.type ?? c.id}`).join(" · ")}</div>
              ) : null}

              {user && messages.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const last = [...messages].reverse().find((m) => m.role === "assistant")?.text;
                    if (!last) return;
                    void saveInsightNote("Insight AI (chat)", last);
                  }}
                  className="lp-btn-secondary"
                >
                  Salva ultima risposta
                </button>
              ) : null}

              <form onSubmit={onSend} className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Chiedi a LifePet AI…"
                  className="flex-1 lp-input"
                />
                <button
                  disabled={chatLoading}
                  className="lp-btn-primary"
                  type="submit"
                >
                  {chatLoading ? "…" : "Invia"}
                </button>
              </form>
              <div className="text-xs text-slate-500">{disclaimer}</div>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

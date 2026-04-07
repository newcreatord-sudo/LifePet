import { useEffect, useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { useAuthStore } from "@/stores/authStore";
import { subscribeUserProfile } from "@/data/users";
import { aiChat, aiGenerateSummary } from "@/data/ai";
import { Sparkles } from "lucide-react";
import { aiUserMessage } from "@/lib/aiErrors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type ChatMsg = { role: "user" | "assistant"; text: string };

export default function Insights() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [aiAllowed, setAiAllowed] = useState(true);
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
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
    try {
      const res = await aiGenerateSummary(activePetId, days);
      setSummary(res.summary);
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
    try {
      const res = await aiChat(activePetId, conversationId, text);
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: aiUserMessage(e) }]);
    } finally {
      setChatLoading(false);
    }
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
                  className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value={7}>Ultimi 7 giorni</option>
                  <option value={30}>Ultimi 30 giorni</option>
                  <option value={90}>Ultimi 90 giorni</option>
                </select>
                <button
                  onClick={onGenerateSummary}
                  disabled={summaryLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  {summaryLoading ? "Generazione…" : "Genera"}
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm whitespace-pre-wrap min-h-28">
                {summary ?? "Genera una sintesi per vedere punti chiave e azioni suggerite."}
              </div>
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
          {!activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare la chat." />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 h-80 overflow-auto space-y-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-slate-400">Chiedi di trend, routine o eventi recenti.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[85%] rounded-xl bg-emerald-300/15 border border-emerald-300/20 px-3 py-2 text-sm"
                          : "mr-auto max-w-[85%] rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                      }
                    >
                      {m.text}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={onSend} className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Chiedi a LifePet AI…"
                  className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
                <button
                  disabled={chatLoading}
                  className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
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

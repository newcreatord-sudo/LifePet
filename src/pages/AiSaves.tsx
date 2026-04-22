import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, RefreshCcw } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { subscribeAiSaves, updateAiSave, upsertAiSave } from "@/data/aiSaves";
import type { AiSave } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToastStore } from "@/stores/toastStore";

export function AiSavesPanel({ embedded }: { embedded?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);

  const [items, setItems] = useState<AiSave[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "succeeded" | "failed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePetId) {
      setItems([]);
      setLoaded(false);
      setInlineError(null);
      return;
    }
    setLoaded(false);
    setInlineError(null);
    const unsub = subscribeAiSaves(
      activePetId,
      80,
      (next) => {
        setItems(next);
        setLoaded(true);
      },
      (e) => setInlineError(e instanceof Error ? e.message : "Caricamento fallito")
    );
    return () => unsub();
  }, [activePetId]);

  const visible = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((x) => x.status === statusFilter);
  }, [items, statusFilter]);

  const selected = useMemo(() => {
    const id = selectedId || visible[0]?.id || null;
    if (!id) return null;
    return visible.find((x) => x.id === id) ?? items.find((x) => x.id === id) ?? null;
  }, [items, selectedId, visible]);

  useEffect(() => {
    if (!selectedId && visible[0]?.id) setSelectedId(visible[0].id);
  }, [selectedId, visible]);

  if (!user) {
    return (
      <div className="space-y-4">
        {!embedded ? (
          <PageHeader
            title="Salvataggi AI"
            description="Storico delle risposte AI e degli auto-salvataggi."
            imagePrompt="minimal clean illustration, archive box with sparkle icon, airy background, accent color, premium, no text, no watermark"
            imageAlt="Salvataggi AI"
          />
        ) : null}
        <EmptyState title="Accedi" description="Per vedere i salvataggi AI devi essere autenticato." />
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded ? (
        <PageHeader
          title="Salvataggi AI"
          description="Storico affidabile delle risposte AI (con copia e riutilizzo)."
          imagePrompt="minimal clean illustration, archive box with sparkle icon, airy background, accent color, premium, no text, no watermark"
          imageAlt="Salvataggi AI"
        />
      ) : null}

      {inlineError ? <Alert variant="danger" title="Errore">{inlineError}</Alert> : null}

      {!activePetId ? (
        <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere i salvataggi." />
      ) : !loaded ? (
        <div className="grid gap-2">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title="Nessun salvataggio" description="Usa l’AI e i salvataggi appariranno qui." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Elenco</CardTitle>
              <CardDescription>Filtra e apri un salvataggio.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <button type="button" className={statusFilter === "all" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setStatusFilter("all")}>Tutti</button>
                <button type="button" className={statusFilter === "succeeded" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setStatusFilter("succeeded")}>Riusciti</button>
                <button type="button" className={statusFilter === "failed" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setStatusFilter("failed")}>Falliti</button>
              </div>

              <div className="space-y-2">
                {visible.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setSelectedId(x.id)}
                    className={
                      x.id === (selected?.id ?? null)
                        ? "w-full text-left lp-panel lp-primary-soft px-3 py-2"
                        : "w-full text-left lp-panel px-3 py-2"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{x.userText || "(senza testo)"}</div>
                      <div className="flex-1" />
                      <span className={x.status === "succeeded" ? "lp-badge lp-badge-info" : "lp-badge lp-badge-danger"}>
                        {x.status === "succeeded" ? "OK" : "Errore"}
                      </span>
                    </div>
                    <div className="text-xs lp-muted mt-1">{new Date(x.createdAt).toLocaleString()} · {x.section}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Dettaglio</CardTitle>
              <CardDescription>Prompt, risposta e azioni rapide.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <EmptyState title="Seleziona un elemento" description="Scegli un salvataggio dall’elenco." />
              ) : (
                <div className="space-y-4">
                  <div className="lp-panel p-3">
                    <div className="text-xs lp-muted">Richiesta</div>
                    <div className="text-sm whitespace-pre-wrap mt-1">{selected.userText}</div>
                  </div>

                  <div className="lp-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs lp-muted">Risposta AI</div>
                      <button
                        type="button"
                        className="lp-btn-icon"
                        onClick={() => {
                          void navigator.clipboard.writeText(selected.assistantText);
                          pushToast({ type: "success", title: "Copiato", message: "Risposta copiata." });
                        }}
                      >
                        <ClipboardCheck className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-sm whitespace-pre-wrap mt-2">{selected.assistantText}</div>
                  </div>

                  {selected.status === "failed" ? (
                    <div className="lp-panel p-3">
                      <div className="text-sm font-semibold">Sincronizzazione non riuscita</div>
                      <div className="text-xs lp-muted mt-1">{selected.error || "Errore non specificato"}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className="lp-btn-secondary inline-flex items-center gap-2"
                          onClick={async () => {
                            if (!activePetId) return;
                            try {
                              await updateAiSave(activePetId, selected.id, { status: "succeeded", error: undefined });
                              await upsertAiSave(activePetId, selected.id, {
                                conversationId: selected.conversationId,
                                section: selected.section,
                                userText: selected.userText,
                                assistantText: selected.assistantText,
                                status: "succeeded",
                                createdAt: selected.createdAt,
                                createdBy: selected.createdBy,
                              });
                              pushToast({ type: "success", title: "Salvataggi AI", message: "Ritentato." });
                            } catch (e) {
                              pushToast({ type: "error", title: "Salvataggi AI", message: e instanceof Error ? e.message : "Riprova fallita" });
                            }
                          }}
                        >
                          <RefreshCcw className="w-4 h-4" />
                          Ritenta
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      className="lp-btn-primary"
                      onClick={() => {
                        const q = new URLSearchParams();
                        q.set("ai", selected.userText);
                        navigate(`/app/agenda?${q.toString()}`);
                      }}
                    >
                      Usa per creare promemoria
                    </button>
                    <button type="button" className="lp-btn-secondary" onClick={() => navigate("/app/ai/chat")}>Vai all’AI</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AiSaves() {
  return <AiSavesPanel />;
}

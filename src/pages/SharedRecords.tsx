import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, HeartPulse, ListTodo, NotebookPen, ShieldPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { getRecordsShare, type RecordsShare } from "@/data/recordsShare";

function iconFor(kind: string) {
  if (kind === "health") return ShieldPlus;
  if (kind === "log") return NotebookPen;
  if (kind === "task") return ListTodo;
  return FileText;
}

export default function SharedRecords() {
  const { token } = useParams();
  const [share, setShare] = useState<RecordsShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = String(token ?? "");
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getRecordsShare(t);
      setShare(s);
    } catch (e) {
      setShare(null);
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const expired = useMemo(() => {
    if (!share) return false;
    return Date.now() > share.expiresAt;
  }, [share]);

  async function openAttachment(att: { url?: string; storagePath?: string; name: string }) {
    try {
      setAttachmentError(null);
      if (att.url) {
        window.open(att.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (!att.storagePath || !token) return;
      const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || "us-central1";
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;
      const usingEmulators = (import.meta.env.VITE_FIREBASE_EMULATORS as string | undefined) === "1";
      const host = (import.meta.env.VITE_FIREBASE_EMULATORS_HOST as string | undefined) || "127.0.0.1";
      const base = usingEmulators
        ? `http://${host}:5001/${projectId}/${region}/sharedRecordAttachmentUrl`
        : `https://${region}-${projectId}.cloudfunctions.net/sharedRecordAttachmentUrl`;
      const res = await fetch(`${base}?token=${encodeURIComponent(String(token))}&path=${encodeURIComponent(att.storagePath)}`);
      if (!res.ok) throw new Error("Impossibile aprire allegato");
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("URL mancante");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setAttachmentError(e instanceof Error ? e.message : "Impossibile aprire l’allegato");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--lp-app-bg)", color: "rgb(var(--lp-ink))" }}>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Cartella clinica condivisa"
          description="Vista in sola lettura"
          imagePrompt="minimal clean illustration, shared medical record cards and link icon, airy background, accent color, premium, no text, no watermark"
          imageAlt="Cartella condivisa"
          actions={
            <Link to="/" className="lp-btn-secondary inline-flex items-center justify-center">
              Home
            </Link>
          }
        />

        {!token ? (
          <EmptyState
            title="Link mancante"
            description="Apri un link di condivisione valido per visualizzare la cartella clinica."
            action={
              <Link to="/" className="lp-btn-primary inline-flex items-center justify-center">
                Vai alla Home
              </Link>
            }
          />
        ) : null}

        {loading ? <div className="text-sm lp-muted">Caricamento…</div> : null}

        {error ? (
          <Alert variant="danger" title="Errore">
            <div className="space-y-2">
              <div>{error}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="lp-btn-primary" onClick={() => void load()} disabled={loading}>
                  Riprova
                </button>
                <Link to="/" className="lp-btn-secondary inline-flex items-center justify-center">
                  Torna alla Home
                </Link>
              </div>
            </div>
          </Alert>
        ) : null}

        {attachmentError ? (
          <Alert variant="danger" title="Allegato">
            <div className="space-y-2">
              <div>{attachmentError}</div>
              <div className="text-sm lp-muted">Suggerimento: controlla connessione e riprova ad aprire.</div>
            </div>
          </Alert>
        ) : null}

        {!token ? null : !share && !loading && !error ? (
          <EmptyState
            title="Link non valido"
            description="Il link potrebbe essere scaduto o inesistente."
            action={
              <Link to="/" className="lp-btn-secondary inline-flex items-center justify-center">
                Torna alla Home
              </Link>
            }
          />
        ) : null}

        {share ? (
          <>
            {expired ? <EmptyState title="Link scaduto" description="Questo link non è più valido." /> : null}

            {!expired ? (
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>
                    Periodo: {new Date(share.range.fromMs).toLocaleDateString()} → {new Date(share.range.toMs).toLocaleDateString()} ·
                    Scade: {new Date(share.expiresAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {share.items.length === 0 ? (
                    <EmptyState title="Nessun elemento" description="Non ci sono elementi nel periodo selezionato." />
                  ) : (
                    <div className="space-y-2">
                      {share.items
                        .slice()
                        .sort((a, b) => b.ts - a.ts)
                        .map((it, idx) => {
                          const Icon = iconFor(it.kind);
                          return (
                            <div key={`${idx}:${it.kind}:${it.ts}`} className="lp-panel px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    <Icon
                                      className="w-4 h-4"
                                      style={
                                        it.kind === "health" ? { color: "rgb(var(--lp-primary-700))" } : { color: "rgb(var(--lp-muted))" }
                                      }
                                    />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">{it.title}</div>
                                    <div className="text-xs text-slate-600">{it.subtitle ?? it.kind}</div>
                                    {it.note ? (
                                      <div className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "rgb(var(--lp-ink))" }}>
                                        {it.note}
                                      </div>
                                    ) : null}
                                    {it.attachment ? (
                                      <button
                                        type="button"
                                        onClick={() => void openAttachment(it.attachment!)}
                                        className="mt-2 lp-btn-secondary inline-flex"
                                      >
                                        Apri: {it.attachment.name}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-xs lp-muted whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  <div className="mt-3 text-xs lp-muted flex items-center gap-2">
                    <HeartPulse className="w-4 h-4" />
                    Vista informativa: non sostituisce il veterinario.
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

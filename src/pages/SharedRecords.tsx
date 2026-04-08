import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, HeartPulse, ListTodo, NotebookPen, ShieldPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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

  useEffect(() => {
    const t = String(token ?? "");
    if (!t) return;
    setLoading(true);
    setError(null);
    getRecordsShare(t)
      .then((s) => setShare(s))
      .catch((e) => setError(e instanceof Error ? e.message : "Errore"))
      .finally(() => setLoading(false));
  }, [token]);

  const expired = useMemo(() => {
    if (!share) return false;
    return Date.now() > share.expiresAt;
  }, [share]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Cartella clinica condivisa"
          description="Vista in sola lettura"
          actions={
            <Link to="/" className="lp-btn-secondary inline-flex items-center justify-center">
              Home
            </Link>
          }
        />

        {loading ? <div className="text-sm text-slate-600">Caricamento…</div> : null}

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-900">{error}</div>
        ) : null}

        {!share && !loading && !error ? <EmptyState title="Link non valido" description="Il link potrebbe essere scaduto o inesistente." /> : null}

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
                                    <Icon className={it.kind === "health" ? "w-4 h-4 text-fuchsia-700" : "w-4 h-4 text-slate-700"} />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">{it.title}</div>
                                    <div className="text-xs text-slate-600">{it.subtitle ?? it.kind}</div>
                                    {it.note ? <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{it.note}</div> : null}
                                    {it.attachment ? (
                                      <a
                                        href={it.attachment.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 lp-btn-icon inline-flex"
                                      >
                                        Apri: {it.attachment.name}
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-600 whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
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

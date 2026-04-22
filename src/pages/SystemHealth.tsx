import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { fetchSystemHealth, type SystemHealth } from "@/data/systemHealth";
import { useQaStore } from "@/stores/qaStore";

function Row(props: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{props.label}</div>
        {props.detail ? <div className="text-xs lp-muted mt-0.5">{props.detail}</div> : null}
      </div>
      <div className="shrink-0">
        {props.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const events = useQaStore((s) => s.events);
  const clear = useQaStore((s) => s.clear);

  const sessionLog = useMemo(() => {
    const lines = events
      .slice()
      .reverse()
      .map((e) => {
        const t = new Date(e.at).toISOString();
        return `${t} [${e.type}] ${e.message}`;
      });
    return lines.join("\n");
  }, [events]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchSystemHealth()
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Health check failed");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={{ it: "Stato sistema", en: "System status" }}
        description={{ it: "Verifica configurazione backend, AI e integrazioni.", en: "Check backend, AI and integrations configuration." }}
        showImage={false}
      />

      {error ? <Alert variant="danger" title="Errore">{error}</Alert> : null}

      <Card>
        <CardContent className="p-4">
          {loading ? <div className="text-sm lp-muted">Caricamento…</div> : null}
          {!loading && data ? (
            <div>
              <Row
                label="Firebase (auth/server)"
                ok={data.firebase.configured}
                detail={data.firebase.configured ? `Project: ${data.firebase.projectId} · Region: ${data.firebase.region}` : "Imposta FIREBASE_PROJECT_ID su Vercel"}
              />
              <div className="h-px bg-slate-200/70" />
              <Row
                label="AI (chat/vision)"
                ok={data.ai.configured}
                detail={data.ai.configured ? `Modello: ${data.ai.model ?? "default"}` : "Imposta AI_GATEWAY_API_KEY (consigliata) o OPENAI_API_KEY su Vercel"}
              />
              <div className="h-px bg-slate-200/70" />
              <Row
                label="Multispecies webhook"
                ok={data.multispecies.webhookConfigured}
                detail={data.multispecies.webhookConfigured ? "OK" : "Imposta MS_WEBHOOK_SECRET su Vercel"}
              />
              <div className="mt-3 text-xs lp-muted">Aggiornato: {new Date(data.timestamp).toLocaleString()}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Log sessione</div>
              <div className="text-xs lp-muted mt-1">Utile quando “torna indietro” o si ricarica da sola.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(sessionLog || "(vuoto)");
                  } catch {
                    return;
                  }
                }}
              >
                Copia
              </button>
              <button type="button" className="lp-btn-secondary" onClick={() => clear()}>
                Svuota
              </button>
            </div>
          </div>
          <div className="mt-3 lp-panel p-3 text-xs whitespace-pre-wrap" style={{ color: "rgb(var(--lp-ink))" }}>
            {sessionLog || "Nessun evento ancora."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
            <CircleHelp className="w-4 h-4" />
            Come sistemare l’AI
          </div>
          <div className="mt-2 text-sm text-slate-700">
            Se l’AI mostra “service is unavailable” o “non riesco a contattare”, quasi sempre manca la chiave AI su Vercel.
          </div>
          <div className="mt-3 text-sm text-slate-700">
            Vercel → Project → Settings → Environment Variables:
            <div className="mt-2 lp-panel p-3 text-xs" style={{ color: "rgb(var(--lp-ink))" }}>
              AI_GATEWAY_API_KEY = … (consigliata)
              <br />
              oppure OPENAI_API_KEY = …
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

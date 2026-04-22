import { CheckCircle2, XCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AlertEvent } from "@/multispecies/types";

export function AlertDetail(props: {
  alert: AlertEvent | null;
  subjectNameById: Map<string, string>;
  onSetStatus: (alertId: string, status: "open" | "closed") => void;
}) {
  const location = useLocation();
  const base = location.pathname.startsWith("/app/farm")
    ? "/app/farm"
    : "/app/tech";
  const a = props.alert;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dettaglio alert</CardTitle>
        <CardDescription>Azioni rapide e stato.</CardDescription>
      </CardHeader>
      <CardContent>
        {!a ? (
          <div className="text-sm lp-muted">Seleziona un alert.</div>
        ) : (
          <div className="space-y-3">
            <div className="lp-panel px-3 py-2">
              <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{a.title}</div>
              <div className="text-xs lp-muted">
                <Link to={`${base}/subjects/${a.subjectId}`}>{props.subjectNameById.get(a.subjectId) ?? a.subjectId}</Link>
              </div>
              <div className="mt-2 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>{a.description}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(a.recommendedActions || []).slice(0, 5).map((x, idx) => (
                  <span key={idx} className="lp-chip">{x}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {a.status === "open" ? (
                <button type="button" className="lp-btn-secondary" onClick={() => props.onSetStatus(a.id, "closed")}>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Chiudi
                  </span>
                </button>
              ) : (
                <button type="button" className="lp-btn-secondary" onClick={() => props.onSetStatus(a.id, "open")}>
                  <span className="inline-flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Riapri
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

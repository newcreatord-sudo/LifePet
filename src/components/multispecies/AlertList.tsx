import { Siren } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { AlertEvent } from "@/multispecies/types";

function sevBadge(sev: AlertEvent["severity"]) {
  if (sev === "critical") return "bg-rose-500/15 text-rose-700";
  if (sev === "warning") return "bg-amber-500/15 text-amber-700";
  return "bg-sky-500/15 text-sky-700";
}

export function AlertList(props: {
  alerts: AlertEvent[];
  selectedAlertId: string | null;
  subjectNameById: Map<string, string>;
  onSelectAlertId: (id: string | null) => void;
}) {
  const openCount = props.alerts.filter((a) => a.status === "open").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Siren className="w-4 h-4" />
          Alert
        </CardTitle>
        <CardDescription>Aperti: {openCount}. Seleziona per dettaglio.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {props.alerts.slice(0, 60).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => props.onSelectAlertId(a.id)}
              className={cn("w-full text-left lp-panel px-3 py-2", props.selectedAlertId === a.id ? "ring-2 ring-sky-500/30" : "")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{a.title}</div>
                  <div className="text-xs lp-muted truncate">{props.subjectNameById.get(a.subjectId) ?? a.subjectId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("text-xs px-2 py-1 rounded-full", sevBadge(a.severity))}>{a.severity}</div>
                  <div
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-full",
                      a.status === "open" ? "bg-sky-500/15 text-sky-700" : "bg-slate-500/15 text-slate-700"
                    )}
                  >
                    {a.status}
                  </div>
                </div>
              </div>
              <div className="text-xs lp-muted truncate">{new Date(a.triggeredAt).toLocaleString()}</div>
            </button>
          ))}
          {props.alerts.length === 0 ? <div className="text-sm lp-muted">Nessun alert.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}


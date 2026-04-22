import { Plus, Siren } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { AlertRule } from "@/multispecies/types";

export function RuleList(props: {
  rules: AlertRule[];
  selectedRuleId: string | null;
  onSelectRuleId: (id: string | null) => void;
  onNew: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Siren className="w-4 h-4" />
          Regole
        </CardTitle>
        <CardDescription>Crea e gestisci regole per specie o soggetto.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <button type="button" className="w-full lp-btn-secondary" onClick={props.onNew}>
            <span className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuova regola
            </span>
          </button>
          <div className="space-y-2">
            {props.rules.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => props.onSelectRuleId(r.id)}
                className={cn("w-full text-left lp-panel px-3 py-2", props.selectedRuleId === r.id ? "ring-2 ring-sky-500/30" : "")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                    {r.title}
                  </div>
                  <div
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-full",
                      r.enabled ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-700"
                    )}
                  >
                    {r.enabled ? "on" : "off"}
                  </div>
                </div>
                <div className="text-xs lp-muted truncate">
                  {r.type} · {r.scope} · {r.metricType}
                </div>
              </button>
            ))}
            {props.rules.length === 0 ? <div className="text-sm lp-muted">Nessuna regola.</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


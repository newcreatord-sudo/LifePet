import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { aiPolicy, type AiPolicyMode } from "@/lib/aiPolicy";

export function AiSafetyBanner({ mode = "general", showSystemLink = true }: { mode?: AiPolicyMode; showSystemLink?: boolean }) {
  const m = aiPolicy.modes[mode];
  return (
    <div className="space-y-2">
      <div className="lp-panel px-3 py-2 text-sm">
        <span className="lp-badge lp-badge-info">{m.label}</span>
        <span className="ml-2">{m.message} {aiPolicy.common.disclaimer}</span>
      </div>
      <div className="lp-panel px-3 py-2 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4" style={{ color: "rgb(var(--lp-danger))" }} />
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>In caso di urgenza</div>
              <div className="text-xs lp-muted mt-0.5">{aiPolicy.common.emergency}</div>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            {showSystemLink ? (
              <Link to="/app/system" className="lp-btn-secondary inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Stato sistema
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { useBillingStore } from "@/stores/billingStore";
import { PremiumGateModal, type PremiumFeature } from "@/components/billing/PremiumGateModal";

export function RequirePro({ children, feature }: { children: ReactNode; feature: PremiumFeature }) {
  const location = useLocation();
  const billingStatus = useBillingStore((s) => s.status);
  const billingLoading = useBillingStore((s) => s.loading);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  const isPro = billingStatus?.effectivePlan === "pro";
  const title = useMemo(() => (feature === "Farm" ? "Farm" : "AI"), [feature]);

  if (billingLoading && !billingStatus) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} description="Caricamento…" imageAlt={title} />
        <Card className="p-4">
          <div className="text-sm lp-muted">Verifico il tuo piano…</div>
        </Card>
      </div>
    );
  }

  if (isPro) return <>{children}</>;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description="Disponibile con Premium" imageAlt={title} />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(var(--lp-ink),0.06)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
          >
            <Lock className="w-5 h-5" style={{ color: "rgb(var(--lp-muted))" }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Funzione Premium</div>
            <div className="mt-1 text-xs lp-muted">Sblocca questa area per continuare senza limiti.</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="lp-btn-primary"
                onClick={() => setOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Passa a Premium
                </span>
              </button>
              <Link to="/app/dashboard" className="lp-btn-secondary inline-flex items-center justify-center">
                Torna alla Dashboard
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <PremiumGateModal
        open={open}
        onClose={() => setOpen(false)}
        feature={feature}
        reason={`Stai tentando di aprire: ${location.pathname}`}
      />
    </div>
  );
}


import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Sparkles, Tractor } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { billingCreateCheckoutSession } from "@/data/billing";
import { useAuthStore } from "@/stores/authStore";
import { useBillingStore } from "@/stores/billingStore";

export type PremiumFeature = "AI" | "Farm";

export function PremiumGateModal({
  open,
  onClose,
  feature,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  feature: PremiumFeature;
  reason?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const billingStatus = useBillingStore((s) => s.status);
  const billingLoading = useBillingStore((s) => s.loading);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = billingStatus?.effectivePlan === "pro";
  const billingEnabled = billingStatus?.billingEnabled !== false;

  const title = useMemo(() => {
    if (feature === "AI") return "Sblocca AI Premium";
    return "Sblocca Farm Premium";
  }, [feature]);

  const description = useMemo(() => {
    if (feature === "AI") return "Limiti più alti e accesso alle funzioni Pro.";
    return "Area Farm completa: dispositivi, mandrie, recinti e alert.";
  }, [feature]);

  const Icon = feature === "AI" ? Sparkles : Tractor;

  if (isPro) return null;

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={() => {
        setError(null);
        onClose();
      }}
    >
      <div className="space-y-3">
        {reason ? <div className="text-sm lp-muted">{reason}</div> : null}
        {error ? <Alert variant="danger" title="Premium">{error}</Alert> : null}

        <div className="lp-panel p-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(200,162,74,0.12)", border: "1px solid rgba(200,162,74,0.28)" }}
            >
              <Icon className="w-5 h-5" style={{ color: "rgb(157, 110, 0)" }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Cosa ottieni con Premium</div>
              <div className="mt-1 text-xs lp-muted">
                {feature === "AI"
                  ? "Più richieste al giorno, meno limiti, esperienza più fluida."
                  : "Gestione avanzata: dashboard, mappa, soggetti, alert e report."}
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="lp-panel px-3 py-2">
                  <div className="text-xs lp-muted">Piano</div>
                  <div className="font-medium">Upgrade immediato</div>
                </div>
                <div className="lp-panel px-3 py-2">
                  <div className="text-xs lp-muted">Controllo</div>
                  <div className="font-medium">Gestione in Impostazioni</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {!user || user.isDemo || !billingEnabled ? (
            <button
              type="button"
              className="lp-btn-primary"
              onClick={() => {
                onClose();
                navigate("/app/settings#premium");
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Apri Premium
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="lp-btn-primary"
              disabled={busy || billingLoading}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const { url } = await billingCreateCheckoutSession();
                  if (!url) throw new Error("Checkout non disponibile");
                  window.location.href = url;
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Checkout fallito");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Crown className="w-4 h-4" />
                {busy ? "Apertura checkout…" : "Passa a Premium"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="lp-btn-secondary"
            onClick={() => {
              void refreshBilling({ force: true });
              onClose();
            }}
          >
            Non ora
          </button>
        </div>
      </div>
    </Modal>
  );
}


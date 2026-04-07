import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useMemo, useState } from "react";
import { deletePushToken, savePushToken } from "@/data/pushTokens";
import { disablePushNotifications, enablePushNotifications, getVapidKey, isPushSupported, subscribeForegroundMessages } from "@/lib/push";
import { subscribeUserProfile, type UserProfile } from "@/data/users";
import { billingCreateCheckoutSession, billingCreatePortalSession, getBillingStatus, type BillingStatus } from "@/data/billing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, Crown, LogOut } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const pushAvailable = useMemo(() => isPushSupported() && !!getVapidKey(), []);

  useEffect(() => {
    const unsub = subscribeForegroundMessages((p) => {
      const title = p.notification?.title;
      const body = p.notification?.body;
      if (title || body) {
        setPushError(`Foreground notification received: ${title ?? ""}${body ? ` — ${body}` : ""}`);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || user.isDemo) return;
    getBillingStatus()
      .then(setBilling)
      .catch(() => setBilling(null));
  }, [user]);

  const effectivePlan = billing?.effectivePlan ?? (profile?.plan ?? (user?.isDemo ? "pro" : "free"));
  return (
    <div className="space-y-4">
      <PageHeader title="Impostazioni" description="Account, piano e notifiche." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Informazioni base del tuo profilo.</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="text-sm text-slate-600">Accesso effettuato come</div>
        <div className="text-sm font-medium mt-1">{user?.email ?? "—"}</div>
        {user?.isDemo ? (
          <div className="mt-2 inline-flex items-center rounded-full border border-fuchsia-600/20 bg-fuchsia-600/10 px-2.5 py-1 text-xs text-fuchsia-800">
            Modalità demo
          </div>
        ) : null}
        <div className="mt-4">
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            className="lp-btn-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Esci
            </span>
          </button>
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Piano</CardTitle>
          <CardDescription>Funzionalità e limiti giornalieri.</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">Attuale</div>
          <div className="text-sm font-medium">{effectivePlan.toUpperCase()}</div>
        </div>
        {billing?.betaProEnabled ? (
          <div className="mt-2 text-xs text-fuchsia-700">Beta attiva: tutto gratis, feature Pro sbloccate.</div>
        ) : null}
        <div className="mt-2 text-xs text-slate-600">I limiti AI sono applicati server-side.</div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            disabled={billingBusy || !billing?.billingEnabled || billing?.betaProEnabled}
            onClick={async () => {
              setBillingBusy(true);
              setBillingError(null);
              try {
                const { url } = await billingCreateCheckoutSession();
                window.location.href = url;
              } catch (e) {
                setBillingError(e instanceof Error ? e.message : "Checkout failed");
              } finally {
                setBillingBusy(false);
              }
            }}
            className={
              billing?.billingEnabled && !billing?.betaProEnabled
                ? "lp-btn-primary"
                : "rounded-xl border border-slate-200/70 bg-white/60 px-4 py-2 text-sm text-slate-400"
            }
          >
            <span className="inline-flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Passa a Pro
            </span>
          </button>
          <button
            disabled={billingBusy || !billing?.billingEnabled || effectivePlan !== "pro"}
            onClick={async () => {
              setBillingBusy(true);
              setBillingError(null);
              try {
                const { url } = await billingCreatePortalSession();
                window.location.href = url;
              } catch (e) {
                setBillingError(e instanceof Error ? e.message : "Portal failed");
              } finally {
                setBillingBusy(false);
              }
            }}
            className="lp-btn-secondary"
          >
            Gestisci abbonamento
          </button>
        </div>

        {!billing?.billingEnabled ? (
          <div className="mt-2 text-xs text-slate-600">Billing non attivo lato backend: per ora resta tutto gratis.</div>
        ) : null}
        {billingError ? (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {billingError}
          </div>
        ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifiche</CardTitle>
          <CardDescription>Push opzionali (geofence e segnali importanti).</CardDescription>
        </CardHeader>
        <CardContent>

        {user?.isDemo ? (
          <div className="mt-3 text-sm text-slate-600">Le notifiche push sono disabilitate in modalità demo.</div>
        ) : !pushAvailable ? (
          <EmptyState
            icon={Bell}
            title="Push non disponibili"
            description="Assicurati di usare HTTPS e di impostare VITE_FIREBASE_VAPID_KEY su Vercel."
          />
        ) : (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              disabled={!user || pushBusy}
              onClick={async () => {
                if (!user) return;
                setPushBusy(true);
                setPushError(null);
                try {
                  const token = await enablePushNotifications();
                  await savePushToken(user.uid, token);
                  setPushToken(token);
                } catch (e) {
                  setPushError(e instanceof Error ? e.message : "Failed to enable push");
                } finally {
                  setPushBusy(false);
                }
              }}
              className="lp-btn-primary"
            >
              {pushBusy ? "Attivazione…" : "Attiva push"}
            </button>
            <button
              disabled={!user || pushBusy || !pushToken}
              onClick={async () => {
                if (!user || !pushToken) return;
                setPushBusy(true);
                setPushError(null);
                try {
                  await deletePushToken(user.uid, pushToken);
                  await disablePushNotifications();
                  setPushToken(null);
                } catch (e) {
                  setPushError(e instanceof Error ? e.message : "Failed to disable push");
                } finally {
                  setPushBusy(false);
                }
              }}
              className="lp-btn-secondary"
            >
              Disattiva
            </button>
          </div>
        )}

        {pushToken ? (
          <div className="mt-3 text-xs text-slate-600">Push attive</div>
        ) : null}
        {pushError ? (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {pushError}
          </div>
        ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { deletePushToken, savePushToken } from "@/data/pushTokens";
import { disablePushNotifications, enablePushNotifications, getVapidKey, isPushSupported, subscribeForegroundMessages } from "@/lib/push";
import { subscribeUserProfile, updateUserPreferences, type UserProfile } from "@/data/users";
import { billingCreateCheckoutSession, billingCreatePortalSession, getBillingStatus, type BillingStatus } from "@/data/billing";
import { exportPetData } from "@/data/export";
import { deleteAccountCascade } from "@/data/account";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, Crown, Download, LogOut, Trash2 } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pets = usePetStore((s) => s.pets);
  const navigate = useNavigate();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const prefs = profile?.preferences ?? { aiEnabled: true, gpsEnabled: true, communityEnabled: true };

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
          <CardTitle>Preferenze</CardTitle>
          <CardDescription>Controlla consensi e funzioni sensibili.</CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <EmptyState title="Accedi" description="Per gestire le preferenze devi essere autenticato." />
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">AI (informativa)</div>
                  <div className="text-xs text-slate-600">Insights, sintomi e suggerimenti (non medico).</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.aiEnabled !== false}
                  onChange={async (e) => {
                    await updateUserPreferences(user.uid, { aiEnabled: e.target.checked });
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">GPS & posizione</div>
                  <div className="text-xs text-slate-600">Tracking e geofence (puoi disattivare in qualsiasi momento).</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.gpsEnabled !== false}
                  onChange={async (e) => {
                    await updateUserPreferences(user.uid, { gpsEnabled: e.target.checked });
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Community</div>
                  <div className="text-xs text-slate-600">Post, commenti e chat gruppi.</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.communityEnabled !== false}
                  onChange={async (e) => {
                    await updateUserPreferences(user.uid, { communityEnabled: e.target.checked });
                  }}
                />
              </label>
              <div className="text-xs text-slate-600">Le funzioni disattivate vengono nascoste e bloccate nelle schermate.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy & Dati</CardTitle>
          <CardDescription>Esporta e gestisci i tuoi dati.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              disabled={!user || user.isDemo || privacyBusy}
              onClick={async () => {
                if (!user) return;
                setPrivacyBusy(true);
                setPrivacyError(null);
                try {
                  const range = { fromMs: Date.now() - 365 * 24 * 60 * 60 * 1000, toMs: Date.now() };
                  const exportedPets = await Promise.all(pets.map((p) => exportPetData(p.id, range)));
                  const payload = {
                    schemaVersion: 1,
                    exportedAt: Date.now(),
                    user: { uid: user.uid, email: user.email },
                    range,
                    pets: exportedPets,
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `lifepet-account-${user.uid}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setPrivacyError(e instanceof Error ? e.message : "Export fallito");
                } finally {
                  setPrivacyBusy(false);
                }
              }}
              className="lp-btn-secondary"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="w-4 h-4" />
                {privacyBusy ? "Esportazione…" : "Esporta dati"}
              </span>
            </button>

            <button
              disabled={!user || user.isDemo || privacyBusy}
              onClick={async () => {
                if (!user) return;
                const confirmText = prompt('Scrivi "ELIMINA" per cancellare definitivamente account e dati.');
                if (confirmText !== "ELIMINA") return;
                setPrivacyBusy(true);
                setPrivacyError(null);
                try {
                  await deleteAccountCascade();
                  await logout();
                  navigate("/login", { replace: true });
                } catch (e) {
                  setPrivacyError(e instanceof Error ? e.message : "Cancellazione fallita");
                } finally {
                  setPrivacyBusy(false);
                }
              }}
              className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-medium hover:bg-rose-400 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Elimina account
              </span>
            </button>
          </div>

          {user?.isDemo ? <div className="mt-3 text-sm text-slate-600">Privacy non disponibile in demo.</div> : null}
          {privacyError ? (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {privacyError}
            </div>
          ) : null}
          <div className="mt-3 text-xs text-slate-600">Export include dati principali degli ultimi 12 mesi (log, GPS, notifiche) + collezioni base.</div>
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

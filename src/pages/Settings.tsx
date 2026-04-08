import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useMemo, useState } from "react";
import { deletePushToken, savePushToken, subscribePushTokens } from "@/data/pushTokens";
import { disablePushNotifications, enablePushNotifications, getVapidKey, isPushSupported, subscribeForegroundMessages } from "@/lib/push";
import { subscribePublicProfile, subscribeUserProfile, updatePublicProfile, updateUserPreferences, type PublicProfile, type UserProfile } from "@/data/users";
import { deletePublicProfilePhoto, uploadPublicProfilePhoto } from "@/data/publicProfilePhotos";
import { billingCreateCheckoutSession, billingCreatePortalSession, getBillingStatus, type BillingStatus } from "@/data/billing";
import { exportAccountData } from "@/data/export";
import { deleteAccountCascade } from "@/data/account";
import { useTutorialStore } from "@/stores/tutorialStore";
import { useToastStore } from "@/stores/toastStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, CircleHelp, Crown, Download, LogOut, RotateCcw, Trash2 } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const tutorialEnabled = useTutorialStore((s) => s.enabled);
  const pushToast = useToastStore((s) => s.push);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushTokens, setPushTokens] = useState<string[]>([]);
  const [pushInitDone, setPushInitDone] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [publicName, setPublicName] = useState("");
  const [publicHandle, setPublicHandle] = useState("");
  const [savingPublic, setSavingPublic] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const prefs = profile?.preferences ?? { aiEnabled: true, gpsEnabled: true, communityEnabled: true };
  const pushPrefs = profile?.preferences ?? {};

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
    const unsub = subscribePushTokens(user.uid, setPushTokens);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setPushToken(pushTokens[0] ?? null);
  }, [pushTokens]);

  useEffect(() => {
    if (!user || user.isDemo) return;
    if (pushPrefs.pushEnabled === false) return;
    if (!pushAvailable) return;
    if (pushInitDone) return;
    if (Notification.permission !== "granted") return;
    setPushInitDone(true);
    void (async () => {
      try {
        const token = await enablePushNotifications();
        await savePushToken(user.uid, token);
      } catch (e) {
        setPushError(e instanceof Error ? e.message : "Errore push");
      }
    })();
  }, [pushAvailable, pushInitDone, pushPrefs.pushEnabled, user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePublicProfile(user.uid, (p) => {
      setPublicProfile(p);
      setPublicName(p?.displayName ?? "");
      setPublicHandle(p?.handle ?? "");
    });
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
          <div className="mt-2 inline-flex items-center rounded-full border border-sky-600/20 bg-sky-600/10 px-2.5 py-1 text-xs text-sky-800">
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
          <CardTitle>Tutorial</CardTitle>
          <CardDescription>Guida attivabile e riavviabile in qualsiasi momento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Tutorial attivo</div>
                <div className="text-xs text-slate-600">Mostra la guida sulle funzioni nelle schermate.</div>
              </div>
              <input
                type="checkbox"
                checked={tutorialEnabled}
                onChange={(e) => useTutorialStore.getState().setEnabled(e.target.checked)}
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  useTutorialStore.getState().setEnabled(true);
                  navigate("/app/settings", { replace: false });
                  useTutorialStore.getState().openForRoute("/app/settings");
                }}
                className="lp-btn-primary"
              >
                <span className="inline-flex items-center gap-2">
                  <CircleHelp className="w-4 h-4" />
                  Avvia tutorial
                </span>
              </button>
              <button
                onClick={() => useTutorialStore.getState().resetProgress()}
                className="lp-btn-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset tutorial
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-600">Puoi anche aprirlo dal pulsante “Tutorial” in basso a destra.</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profilo pubblico</CardTitle>
          <CardDescription>Nome mostrato in Community e chat.</CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <EmptyState title="Accedi" description="Per modificare il profilo pubblico devi essere autenticato." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-slate-200/70 bg-white overflow-hidden flex items-center justify-center">
                  {publicProfile?.photoURL ? (
                    <img src={publicProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-sm font-semibold text-slate-700">{(publicName || "U").slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="lp-btn-secondary">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!user || user.isDemo || uploadingAvatar}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f || !user || user.isDemo) return;
                        setUploadingAvatar(true);
                        try {
                          await uploadPublicProfilePhoto(user.uid, f, publicProfile?.photoPath);
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    />
                    {uploadingAvatar ? "Caricamento…" : "Carica avatar"}
                  </label>

                  {publicProfile?.photoPath ? (
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      disabled={!user || user.isDemo || uploadingAvatar}
                      onClick={async () => {
                        if (!user || user.isDemo || !publicProfile.photoPath) return;
                        setUploadingAvatar(true);
                        try {
                          await deletePublicProfilePhoto(user.uid, publicProfile.photoPath);
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    >
                      Rimuovi
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Nome</div>
                  <input value={publicName} onChange={(e) => setPublicName(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Handle (opzionale)</div>
                  <input value={publicHandle} onChange={(e) => setPublicHandle(e.target.value)} placeholder="@mario" className="lp-input" />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="lp-btn-primary"
                  disabled={!user || user.isDemo || savingPublic}
                  onClick={async () => {
                    if (!user || user.isDemo) return;
                    setSavingPublic(true);
                    try {
                      await updatePublicProfile(user.uid, {
                        displayName: publicName,
                        handle: publicHandle,
                      });
                    } finally {
                      setSavingPublic(false);
                    }
                  }}
                >
                  {savingPublic ? "Salvataggio…" : "Salva"}
                </button>
                {publicProfile ? <div className="text-xs text-slate-600">UID: {publicProfile.uid}</div> : null}
              </div>

              {user.isDemo ? <div className="text-xs text-slate-600">In modalità demo il profilo pubblico non viene salvato.</div> : null}
            </div>
          )}
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
                  const { url } = await exportAccountData(range);
                  if (!url) throw new Error("Export non disponibile");
                  const a = document.createElement("a");
                  a.href = url;
                  a.click();
                  pushToast({ type: "success", title: "Export", message: "Download avviato." });
                } catch (e) {
                  setPrivacyError(e instanceof Error ? e.message : "Export fallito");
                  pushToast({ type: "error", title: "Export", message: e instanceof Error ? e.message : "Export fallito" });
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
                  pushToast({ type: "error", title: "Account", message: e instanceof Error ? e.message : "Cancellazione fallita" });
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
          <div className="mt-2 text-xs text-sky-700">Beta attiva: tutto gratis, feature Pro sbloccate.</div>
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
                pushToast({ type: "info", title: "Checkout", message: "Apertura pagamento…" });
                window.location.href = url;
              } catch (e) {
                setBillingError(e instanceof Error ? e.message : "Checkout failed");
                pushToast({ type: "error", title: "Checkout", message: e instanceof Error ? e.message : "Checkout fallito" });
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
                pushToast({ type: "info", title: "Abbonamento", message: "Apertura portale…" });
                window.location.href = url;
              } catch (e) {
                setBillingError(e instanceof Error ? e.message : "Portal failed");
                pushToast({ type: "error", title: "Abbonamento", message: e instanceof Error ? e.message : "Apertura portale fallita" });
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

        {user && !user.isDemo ? (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Push server-side</div>
                <div className="text-xs text-slate-600">Se disattivo, l’inbox resta ma non arrivano push.</div>
              </div>
              <input
                type="checkbox"
                checked={pushPrefs.pushEnabled !== false}
                onChange={async (e) => {
                  await updateUserPreferences(user.uid, { pushEnabled: e.target.checked });
                }}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Quiet hours</div>
                <div className="text-xs text-slate-600">Blocca i push in una fascia oraria.</div>
              </div>
              <input
                type="checkbox"
                checked={pushPrefs.quietHoursEnabled === true}
                onChange={async (e) => {
                  await updateUserPreferences(user.uid, { quietHoursEnabled: e.target.checked });
                }}
              />
            </label>

            {pushPrefs.quietHoursEnabled ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Da</div>
                  <input
                    type="time"
                    value={pushPrefs.quietHoursStart ?? "22:00"}
                    onChange={async (e) => {
                      await updateUserPreferences(user.uid, { quietHoursStart: e.target.value });
                    }}
                    className="lp-input"
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">A</div>
                  <input
                    type="time"
                    value={pushPrefs.quietHoursEnd ?? "07:00"}
                    onChange={async (e) => {
                      await updateUserPreferences(user.uid, { quietHoursEnd: e.target.value });
                    }}
                    className="lp-input"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

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
                  pushToast({ type: "success", title: "Push", message: "Attivate." });
                } catch (e) {
                  setPushError(e instanceof Error ? e.message : "Failed to enable push");
                  pushToast({ type: "error", title: "Push", message: e instanceof Error ? e.message : "Attivazione fallita" });
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
                  pushToast({ type: "success", title: "Push", message: "Disattivate." });
                } catch (e) {
                  setPushError(e instanceof Error ? e.message : "Failed to disable push");
                  pushToast({ type: "error", title: "Push", message: e instanceof Error ? e.message : "Disattivazione fallita" });
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

        <div className="mt-3 text-xs text-slate-600">
          Stato: {pushPrefs.pushEnabled === false ? "disattivate" : pushToken ? "attive" : "non attive"}
        </div>
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

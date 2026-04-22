import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useMemo, useState } from "react";
import { deletePushToken, savePushToken, subscribePushTokens } from "@/data/pushTokens";
import { disablePushNotifications, enablePushNotifications, getVapidKey, isPushSupported, subscribeForegroundMessages } from "@/lib/push";
import { subscribePublicProfile, subscribeUserProfile, updatePublicProfile, updateUserPreferences, type PublicProfile, type UserProfile } from "@/data/users";
import { deletePublicProfilePhoto, uploadPublicProfilePhoto } from "@/data/publicProfilePhotos";
import { exportAccountData } from "@/data/export";
import { deleteAccountCascade } from "@/data/account";
import { deleteRecentTelemetry } from "@/data/telemetry";
import { useTutorialStore } from "@/stores/tutorialStore";
import { useToastStore } from "@/stores/toastStore";
import { tr } from "@/lib/i18n";
import { useI18nStore } from "@/stores/i18nStore";
import { isCommunityDemoEnabled, setCommunityDemoEnabled } from "@/lib/communityMode";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Bell, CircleHelp, Crown, Download, ExternalLink, LogOut, Palette, RotateCcw, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { useThemeStore, type ThemeBackground, type ThemePalette, type ThemeSheet } from "@/stores/themeStore";
import { ConfirmStyles } from "@/components/confirm";
import { billingCreateCheckoutSession, billingCreatePortalSession } from "@/data/billing";
import { useBillingStore } from "@/stores/billingStore";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const tutorialEnabled = useTutorialStore((s) => s.enabled);
  const pushToast = useToastStore((s) => s.push);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    try {
      return typeof Notification !== "undefined" ? Notification.permission : "default";
    } catch {
      return "default";
    }
  });
  const [pushTokens, setPushTokens] = useState<string[]>([]);

  async function triggerAppUpdate() {
    setUpdatingApp(true);
    try {
      const fn = (window as unknown as { __lifepet_updateSW?: () => void }).__lifepet_updateSW;
      if (typeof fn === "function") {
        fn();
        return;
      }
      window.location.reload();
    } finally {
      setUpdatingApp(false);
    }
  }
  const [pushInitDone, setPushInitDone] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [publicName, setPublicName] = useState("");
  const [publicHandle, setPublicHandle] = useState("");
  const [savingPublic, setSavingPublic] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [telemetryClearOpen, setTelemetryClearOpen] = useState(false);
  const [telemetryBusy, setTelemetryBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [onboardingDone, setOnboardingDone] = useState(false);

  const billingStatus = useBillingStore((s) => s.status);
  const billingLoading = useBillingStore((s) => s.loading);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const palette = useThemeStore((s) => s.palette);
  const background = useThemeStore((s) => s.background);
  const sheet = useThemeStore((s) => s.sheet);
  const setPalette = useThemeStore((s) => s.setPalette);
  const setBackground = useThemeStore((s) => s.setBackground);
  const setSheet = useThemeStore((s) => s.setSheet);
  const resetTheme = useThemeStore((s) => s.reset);

  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);
  const [communityDemo, setCommunityDemo] = useState(() => isCommunityDemoEnabled());

  async function hardReload() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload();
  }

  const prefs = profile?.preferences ?? { aiEnabled: true, gpsEnabled: true, communityEnabled: true };
  const pushPrefs = profile?.preferences ?? {};

  async function savePrefs(patch: Partial<UserProfile["preferences"]>, errorContext: string) {
    if (!user) return;
    if (prefsBusy) return;
    setPrefsBusy(true);
    try {
      await updateUserPreferences(user.uid, patch);
    } catch (e) {
      pushToast({ type: "error", title: "Impostazioni", message: `${errorContext}: ${e instanceof Error ? e.message : "salvataggio fallito"}` });
    } finally {
      setPrefsBusy(false);
    }
  }

  const vapidKey = useMemo(() => getVapidKey(), []);
  const pushAvailable = useMemo(() => isPushSupported() && !!vapidKey, [vapidKey]);

  useEffect(() => {
    if (!user) return;
    void refreshBilling();
  }, [refreshBilling, user]);

  const checkoutState = useMemo(() => {
    const v = new URLSearchParams(location.search).get("checkout");
    return v === "success" || v === "cancel" ? v : null;
  }, [location.search]);

  const isPro = billingStatus?.effectivePlan === "pro";

  useEffect(() => {
    function refresh() {
      try {
        if (typeof Notification === "undefined") return;
        setPushPermission(Notification.permission);
      } catch {
        return;
      }
    }
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    const unsub = subscribeForegroundMessages((p) => {
      const title = p.notification?.title;
      const body = p.notification?.body;
      if (title || body) {
        setPushError(`Notifica ricevuta in primo piano: ${title ?? ""}${body ? ` — ${body}` : ""}`);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      setOnboardingDone(localStorage.getItem("lifepet:onboardingCompleted") === "1");
    } catch {
      setOnboardingDone(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return () => unsub();
  }, [user]);

  function scrollToSection(id: string) {
    try {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      return;
    }
  }

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

  if (!user) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Impostazioni"
          description="Account, preferenze e notifiche."
          imagePrompt="minimal clean illustration, settings gear with sliders, airy background, accent color, premium, no text, no watermark"
          imageAlt="Impostazioni"
        />
        <EmptyState
          title="Accedi"
          description="Per gestire account e preferenze devi essere autenticato."
          action={
            <Link to="/login" className="lp-btn-primary inline-flex items-center justify-center">
              Accedi
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Impostazioni"
        description="Account, preferenze e notifiche."
        imagePrompt="minimal clean illustration, settings gear with sliders, airy background, accent color, premium, no text, no watermark"
        imageAlt="Impostazioni"
      />

      <Card>
        <CardHeader>
          <CardTitle>Stato sistema</CardTitle>
          <CardDescription>Verifica configurazione AI e backend (utile per errori “servizio non disponibile”).</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700">Controlla in pochi secondi cosa manca lato server.</div>
          <Link to="/app/system" className="lp-btn-secondary">Apri</Link>
        </CardContent>
      </Card>

      <Modal
        open={deleteOpen}
        title="Elimina account"
        description='Scrivi "ELIMINA" per cancellare definitivamente account e dati.'
        onClose={() => setDeleteOpen(false)}
      >
        <div className="grid gap-3">
          <input className="lp-input" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setDeleteOpen(false)} disabled={privacyBusy}>
              Annulla
            </button>
            <button
              type="button"
              className="lp-btn-primary"
              style={{ ...ConfirmStyles.dangerButtonStyle, borderColor: "rgba(var(--lp-danger),0.4)" }}
              disabled={privacyBusy || deleteText !== "ELIMINA"}
              onClick={async () => {
                if (!user) return;
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
                  setDeleteOpen(false);
                }
              }}
            >
              Elimina
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={telemetryClearOpen}
        title="Cancella telemetria"
        description="Rimuove fino a 200 eventi recenti salvati per migliorare il prodotto."
        onClose={() => {
          if (telemetryBusy) return;
          setTelemetryClearOpen(false);
        }}
      >
        <div className="space-y-3">
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold">Cosa viene cancellato</div>
            <div className="text-xs lp-muted mt-1">Eventi minimi (page view e click CTA), senza contenuti personali.</div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" disabled={telemetryBusy} onClick={() => setTelemetryClearOpen(false)}>
              Annulla
            </button>
            <button
              type="button"
              className="lp-btn-primary"
              disabled={telemetryBusy || user.isDemo}
              onClick={async () => {
                if (!user || user.isDemo) return;
                setTelemetryBusy(true);
                try {
                  await deleteRecentTelemetry(user.uid, 200);
                  pushToast({ type: "success", title: "Telemetria", message: "Dati cancellati." });
                  setTelemetryClearOpen(false);
                } catch (e) {
                  pushToast({ type: "error", title: "Telemetria", message: e instanceof Error ? e.message : "Operazione fallita" });
                } finally {
                  setTelemetryBusy(false);
                }
              }}
            >
              {telemetryBusy ? "Cancello…" : "Conferma"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit">
          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <CardTitle>Sezioni</CardTitle>
              <CardDescription>Navigazione rapida.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-account")}>Account</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-look")}>Aspetto</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-language")}>Lingua</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-tutorial")}>Tutorial</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-onboarding")}>Onboarding</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-public")}>Profilo pubblico</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-preferences")}>Preferenze</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-privacy")}>Privacy</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-plan")}>Piano</button>
                <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-notifications")}>Notifiche</button>
                {import.meta.env.DEV ? (
                  <button type="button" className="lp-chip" onClick={() => scrollToSection("settings-diagnostics")}>
                    Diagnostica
                  </button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
      <div id="settings-account" />
      <Card className="relative overflow-hidden">
        <div className="lp-card-accent" aria-hidden="true" />
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Informazioni base del tuo profilo.</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="text-sm lp-muted">Accesso effettuato come</div>
        <div className="text-sm font-medium mt-1">{user?.email ?? "—"}</div>
        {user?.isDemo ? (
          <div className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs lp-primary-soft">
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

      <div id="settings-look" />
      <Card>
        <CardHeader>
          <CardTitle>Aspetto</CardTitle>
          <CardDescription className="lp-muted">Temi colorati e animazioni leggere.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="lp-panel px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Tema colore</div>
                  <div className="text-sm font-medium mt-0.5" style={{ color: "rgb(var(--lp-ink))" }}>
                    {palette === "sky"
                      ? tr(lang, "Azzurro", "Sky")
                      : palette === "violet"
                        ? tr(lang, "Viola", "Violet")
                        : palette === "mint"
                          ? tr(lang, "Menta", "Mint")
                          : palette === "sunset"
                            ? tr(lang, "Tramonto", "Sunset")
                            : tr(lang, "Monocromia", "Mono")}
                  </div>
                </div>
                <Palette className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {([
                  { id: "sky", label: tr(lang, "Azzurro", "Sky"), swatch: "bg-sky-500" },
                  { id: "violet", label: tr(lang, "Viola", "Violet"), swatch: "bg-violet-500" },
                  { id: "mint", label: tr(lang, "Menta", "Mint"), swatch: "bg-emerald-500" },
                  { id: "sunset", label: tr(lang, "Tramonto", "Sunset"), swatch: "bg-amber-500" },
                  { id: "mono", label: tr(lang, "Monocromia", "Mono"), swatch: "bg-sky-500" },
                ] as Array<{ id: ThemePalette; label: string; swatch: string }>).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      palette === p.id
                        ? "lp-panel px-3 py-2 text-sm font-medium shadow-sm"
                        : "lp-panel px-3 py-2 text-sm font-medium"
                    }
                    onClick={() => setPalette(p.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${p.swatch}`} />
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="lp-badge lp-badge-info">{tr(lang, "Etichetta", "Badge")}</span>
                <span className="lp-badge lp-badge-warn">{tr(lang, "Avviso", "Warning")}</span>
                <span className="lp-badge lp-badge-danger">{tr(lang, "Critico", "Danger")}</span>
                <span className="lp-chip lp-chip-active">{tr(lang, "Pillola", "Chip")}</span>
              </div>

            </div>

            <div className="lp-panel px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Foglio (card/pannelli)</div>
                  <div className="text-sm lp-muted mt-0.5">Cambia la parte “dietro” bianca dei contenuti.</div>
                </div>
                <Sparkles className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  { id: "white", label: "Bianco" },
                  { id: "soft", label: tr(lang, "Morbido", "Soft") },
                  { id: "warm", label: tr(lang, "Caldo", "Warm") },
                ] as Array<{ id: ThemeSheet; label: string }>).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={sheet === s.id ? "lp-chip lp-chip-active" : "lp-chip"}
                    onClick={() => setSheet(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-panel px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Sfondo pagina</div>
                  <div className="text-sm lp-muted mt-0.5">Cambia lo sfondo dietro al foglio.</div>
                </div>
                <Sparkles className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  { id: "pastel", label: "Pastello" },
                  { id: "clean", label: "Pulito" },
                ] as Array<{ id: ThemeBackground; label: string }>).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={background === b.id ? "lp-chip lp-chip-active" : "lp-chip"}
                    onClick={() => setBackground(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-panel p-3">
              <div className="text-sm font-semibold">Anteprima</div>
              <div className="text-sm lp-muted">Questo riquadro usa il foglio e lo sfondo correnti.</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="lp-panel p-3">
                  <div className="text-sm font-medium">Card</div>
                  <div className="text-sm lp-muted">Testo secondario.</div>
                </div>
                <div className="lp-panel p-3">
                  <div className="text-sm font-medium">Pannello</div>
                  <div className="text-sm lp-muted">Dettagli e note.</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="lp-btn-secondary" onClick={resetTheme}>
                Ripristina aspetto
              </button>
              <button type="button" className="lp-btn-secondary" onClick={hardReload}>
                Svuota cache e ricarica
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="settings-language" />
      <Card>
        <CardHeader>
          <CardTitle>Lingua</CardTitle>
          <CardDescription className="lp-muted">Scegli la lingua dell’interfaccia.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="lp-panel px-3 py-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={lang === "it" ? "lp-chip lp-chip-active" : "lp-chip"}
                  onClick={() => setLang("it")}
              >
                Italiano
              </button>
              <button
                type="button"
                className={lang === "en" ? "lp-chip lp-chip-active" : "lp-chip"}
                  onClick={() => setLang("en")}
              >
                English
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="settings-tutorial" />
      <Card>
        <CardHeader>
          <CardTitle>Tutorial</CardTitle>
          <CardDescription>Guida attivabile e riavviabile in qualsiasi momento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
              <div>
                <div className="text-sm font-medium">Tutorial attivo</div>
                <div className="text-xs lp-muted">Mostra la guida sulle funzioni nelle schermate.</div>
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

            <div className="text-xs lp-muted">Puoi anche aprirlo dal pulsante “Tutorial” in basso a destra.</div>
          </div>
        </CardContent>
      </Card>

      <div id="settings-onboarding" />
      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>Mini-percorso iniziale per impostare tutto in modo semplice.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="lp-panel px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="lp-muted">Stato</div>
                <div className="font-medium" style={{ color: onboardingDone ? "rgb(var(--lp-accent-2))" : "rgb(var(--lp-ink))" }}>
                  {onboardingDone ? "Completato" : "Non completato"}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="lp-btn-primary"
                onClick={() => navigate("/onboarding")}
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Avvia onboarding
                </span>
              </button>
              <button
                type="button"
                className="lp-btn-secondary"
                onClick={() => {
                  try {
                    localStorage.removeItem("lifepet:onboardingCompleted");
                  } finally {
                    setOnboardingDone(false);
                    pushToast({ type: "success", title: "Onboarding", message: "Reimpostato." });
                  }
                }}
              >
                Reset onboarding
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="settings-app" />
      <Card>
        <CardHeader>
          <CardTitle>App</CardTitle>
          <CardDescription>Aggiornamenti e stabilità.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-slate-700">Se durante l’uso vedi comportamenti strani, aggiorna l’app all’ultima versione.</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className="lp-btn-primary" disabled={updatingApp} onClick={triggerAppUpdate}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {updatingApp ? "Aggiorno…" : "Aggiorna app"}
                </span>
              </button>
              <Link className="lp-btn-secondary" to="/app/system">Stato sistema</Link>
            </div>
            <div className="text-xs lp-muted">Suggerimento: su iPhone, se hai aggiunto PetLyon alla Home, aggiornare qui risolve molti “torna indietro”.</div>
          </div>
        </CardContent>
      </Card>

      <div id="settings-public" />
      <Card>
        <CardHeader>
          <CardTitle>Profilo pubblico</CardTitle>
          <CardDescription>Nome mostrato in Community e chat.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-[rgba(var(--lp-ink),0.12)] bg-white overflow-hidden flex items-center justify-center">
                  {publicProfile?.photoURL ? (
                    <img src={publicProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{(publicName || "U").slice(0, 1).toUpperCase()}</div>
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
                  <div className="text-xs lp-muted mb-1">Nome</div>
                  <input value={publicName} onChange={(e) => setPublicName(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Handle (opzionale)</div>
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
                {publicProfile ? <div className="text-xs lp-muted">UID: {publicProfile.uid}</div> : null}
              </div>

              {user.isDemo ? <div className="text-xs lp-muted">In modalità demo il profilo pubblico non viene salvato.</div> : null}
          </div>
        </CardContent>
      </Card>

      <div id="settings-preferences" />
      <Card>
        <CardHeader>
          <CardTitle>Preferenze</CardTitle>
          <CardDescription>Controlla consensi e funzioni sensibili.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
                <div>
                  <div className="text-sm font-medium">AI (informativa)</div>
                  <div className="text-xs lp-muted">Insights, sintomi e suggerimenti (non medico).</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.aiEnabled !== false}
                  onChange={async (e) => {
                    await savePrefs({ aiEnabled: e.target.checked }, "AI");
                  }}
                  disabled={prefsBusy}
                />
              </label>

              <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
                <div>
                  <div className="text-sm font-medium">GPS & posizione</div>
                  <div className="text-xs lp-muted">Tracking e geofence (puoi disattivare in qualsiasi momento).</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.gpsEnabled !== false}
                  onChange={async (e) => {
                    await savePrefs({ gpsEnabled: e.target.checked }, "GPS");
                  }}
                  disabled={prefsBusy}
                />
              </label>

              <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Community</div>
                  <div className="text-xs lp-muted">Post, commenti e chat gruppi.</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.communityEnabled !== false}
                  onChange={async (e) => {
                    await savePrefs({ communityEnabled: e.target.checked }, "Community");
                  }}
                  disabled={prefsBusy}
                />
              </label>

              <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Telemetria anonima (opt-in)</div>
                  <div className="text-xs lp-muted">Condividi eventi minimi per migliorare affidabilità e UX. Nessun contenuto personale.</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.telemetryEnabled === true}
                  onChange={async (e) => {
                    await savePrefs({ telemetryEnabled: e.target.checked }, "Telemetria");
                  }}
                  disabled={prefsBusy || user.isDemo}
                />
              </label>
              {prefs.telemetryEnabled === true ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    disabled={user.isDemo}
                    onClick={() => setTelemetryClearOpen(true)}
                  >
                    Cancella telemetria
                  </button>
                </div>
              ) : null}
              <div className="text-xs lp-muted">Le funzioni disattivate vengono nascoste e bloccate nelle schermate.</div>

              <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Community locale</div>
                  <div className="text-xs lp-muted">Se la community non carica, forza una versione locale funzionante.</div>
                </div>
                <input
                  type="checkbox"
                  checked={communityDemo}
                  onChange={(e) => {
                    setCommunityDemoEnabled(e.target.checked);
                    setCommunityDemo(e.target.checked);
                    window.location.reload();
                  }}
                />
              </label>
          </div>
        </CardContent>
      </Card>

      <div id="settings-privacy" />
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
                setDeleteText("");
                setDeleteOpen(true);
              }}
              className="lp-btn-primary disabled:opacity-60"
              style={ConfirmStyles.dangerButtonStyle}
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Elimina account
              </span>
            </button>
          </div>

          {user?.isDemo ? <div className="mt-3 text-sm lp-muted">Privacy non disponibile in demo.</div> : null}
          {privacyError ? <div className="mt-3"><Alert variant="danger" title="Errore">{privacyError}</Alert></div> : null}
          <div className="mt-3 text-xs lp-muted">Export include dati principali degli ultimi 12 mesi (log, GPS, notifiche) + collezioni base.</div>
        </CardContent>
      </Card>

      <div id="settings-plan" />
      <div id="premium" />
      <Card>
        <CardHeader>
          <CardTitle>Piano</CardTitle>
          <CardDescription>Funzionalità e limiti giornalieri.</CardDescription>
        </CardHeader>
        <CardContent>
          {checkoutState ? (
            <div className="mb-3">
              <Alert variant={checkoutState === "success" ? "success" : "warn"} title={checkoutState === "success" ? "Premium" : "Checkout"}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    {checkoutState === "success"
                      ? "Premium attivo. Bentornato!"
                      : "Operazione annullata. Puoi riprovare quando vuoi."}
                  </div>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => {
                      void refreshBilling({ force: true });
                      navigate("/app/settings#premium", { replace: true });
                    }}
                  >
                    OK
                  </button>
                </div>
              </Alert>
            </div>
          ) : null}

          {billingError ? (
            <div className="mb-3">
              <Alert variant="warn" title="Stato piano non disponibile">{billingError}</Alert>
            </div>
          ) : null}

          <div className="lp-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Crown className="w-4 h-4" style={{ color: "rgb(157, 110, 0)" }} />
                  PetLyon Premium
                  {billingLoading ? null : (
                    <span
                      className={
                        isPro
                          ? "inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-900"
                          : "inline-flex items-center rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-700"
                      }
                    >
                      {isPro ? "PRO attivo" : "FREE"}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs lp-muted">
                  {billingLoading
                    ? "Verifico lo stato del tuo piano…"
                    : isPro
                      ? "Più potenza, meno limiti."
                      : "Sblocca funzioni Pro e limiti più alti."}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => void refreshBilling({ force: true })}
                  disabled={billingLoading}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Aggiorna
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="lp-panel px-3 py-2">
                <div className="text-xs lp-muted">AI</div>
                <div className="font-medium">Limiti più alti</div>
              </div>
              <div className="lp-panel px-3 py-2">
                <div className="text-xs lp-muted">Farm</div>
                <div className="font-medium">Accesso completo</div>
              </div>
              <div className="lp-panel px-3 py-2">
                <div className="text-xs lp-muted">Export</div>
                <div className="font-medium">Funzioni avanzate</div>
              </div>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              {!isPro ? (
                <button
                  type="button"
                  className="lp-btn-primary"
                  disabled={!user || user.isDemo || billingBusy || billingStatus?.billingEnabled === false}
                  onClick={async () => {
                    if (!user) return;
                    setBillingBusy(true);
                    setBillingError(null);
                    try {
                      const { url } = await billingCreateCheckoutSession();
                      if (!url) throw new Error("Checkout non disponibile");
                      window.location.href = url;
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Checkout fallito";
                      setBillingError(msg);
                      pushToast({ type: "error", title: "Premium", message: msg });
                    } finally {
                      setBillingBusy(false);
                    }
                  }}
                >
                  {billingBusy ? "Apertura checkout…" : "Attiva Premium"}
                </button>
              ) : (
                <button
                  type="button"
                  className="lp-btn-primary"
                  disabled={!user || user.isDemo || billingBusy || billingStatus?.billingEnabled === false}
                  onClick={async () => {
                    if (!user) return;
                    setBillingBusy(true);
                    setBillingError(null);
                    try {
                      const { url } = await billingCreatePortalSession();
                      if (!url) throw new Error("Portale non disponibile");
                      window.location.href = url;
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Apertura portale fallita";
                      setBillingError(msg);
                      pushToast({ type: "error", title: "Premium", message: msg });
                    } finally {
                      setBillingBusy(false);
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Gestisci abbonamento
                  </span>
                </button>
              )}

              <Link to="/app/system" className="lp-btn-secondary inline-flex items-center justify-center">
                Stato sistema
              </Link>
            </div>

            {billingStatus?.billingEnabled === false ? (
              <div className="mt-3 text-xs lp-muted">
                Premium è in beta: checkout potrebbe essere disabilitato. Se vedi “PRO attivo”, sei già abilitato.
              </div>
            ) : null}
            {user?.isDemo ? <div className="mt-3 text-xs lp-muted">Checkout e gestione abbonamento non disponibili in demo.</div> : null}
          </div>
        </CardContent>
      </Card>

      <div id="settings-notifications" />
      <Card>
        <CardHeader>
          <CardTitle>Notifiche</CardTitle>
          <CardDescription>Push opzionali (geofence e segnali importanti).</CardDescription>
        </CardHeader>
        <CardContent>

        {user && !user.isDemo && !vapidKey ? (
          <div className="mb-3">
            <Alert variant="warn" title="Push non configurate">
              Per abilitare le push servono:
              {"\n"}- Firebase Console → Cloud Messaging → Web Push certificates (genera VAPID)
              {"\n"}- Variabile `VITE_FIREBASE_VAPID_KEY` su Vercel
            </Alert>
          </div>
        ) : null}

        {user && !user.isDemo ? (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
              <div>
                <div className="text-sm font-medium">Push server-side</div>
                <div className="text-xs lp-muted">Se disattivo, l’inbox resta ma non arrivano push.</div>
              </div>
              <input
                type="checkbox"
                checked={pushPrefs.pushEnabled !== false}
                onChange={async (e) => {
                  await savePrefs({ pushEnabled: e.target.checked }, "Push");
                }}
                disabled={prefsBusy}
              />
            </label>

            <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2">
              <div>
                  <div className="text-sm font-medium">Ore di silenzio</div>
                  <div className="text-xs lp-muted">Blocca i push in una fascia oraria.</div>
              </div>
              <input
                type="checkbox"
                checked={pushPrefs.quietHoursEnabled === true}
                onChange={async (e) => {
                  await savePrefs({ quietHoursEnabled: e.target.checked }, "Ore di silenzio");
                }}
                disabled={prefsBusy}
              />
            </label>

            {pushPrefs.quietHoursEnabled ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs lp-muted mb-1">Da</div>
                  <input
                    type="time"
                    value={pushPrefs.quietHoursStart ?? "22:00"}
                    onChange={async (e) => {
                      await savePrefs({ quietHoursStart: e.target.value }, "Ore di silenzio");
                    }}
                    disabled={prefsBusy}
                    className="lp-input"
                  />
                </label>
                <label className="block">
                  <div className="text-xs lp-muted mb-1">A</div>
                  <input
                    type="time"
                    value={pushPrefs.quietHoursEnd ?? "07:00"}
                    onChange={async (e) => {
                      await savePrefs({ quietHoursEnd: e.target.value }, "Ore di silenzio");
                    }}
                    disabled={prefsBusy}
                    className="lp-input"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {user?.isDemo ? (
          <div className="mt-3 text-sm lp-muted">Le notifiche push sono disabilitate in modalità demo.</div>
        ) : !pushAvailable ? (
          <EmptyState
            icon={Bell}
            title="Push non disponibili"
            description="Assicurati di usare HTTPS e di impostare VITE_FIREBASE_VAPID_KEY su Vercel."
          />
        ) : (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              disabled={!user || pushBusy || pushPrefs.pushEnabled === false || pushPermission === "denied"}
              onClick={async () => {
                if (!user) return;
                setPushBusy(true);
                setPushError(null);
                try {
                  if (pushPrefs.pushEnabled === false) {
                    throw new Error("Push server-side disattivate: abilita prima l'interruttore sopra.");
                  }
                  if (pushPermission === "denied") {
                    throw new Error("Permesso notifiche negato nel browser. Riabilitalo nelle impostazioni del sito.");
                  }
                  if (pushPermission === "default") {
                    const perm = await Notification.requestPermission();
                    setPushPermission(perm);
                    if (perm !== "granted") {
                      throw new Error("Permesso notifiche non concesso.");
                    }
                  }
                  const token = await enablePushNotifications();
                  await savePushToken(user.uid, token);
                  setPushToken(token);
                  pushToast({ type: "success", title: "Push", message: "Attivate." });
                } catch (e) {
                  setPushError(e instanceof Error ? e.message : "Attivazione push fallita");
                  pushToast({ type: "error", title: "Push", message: e instanceof Error ? e.message : "Attivazione fallita" });
                } finally {
                  setPushBusy(false);
                }
              }}
              className="lp-btn-primary"
            >
              {pushBusy ? "Attivazione…" : pushPermission === "default" ? "Richiedi permesso" : "Attiva push"}
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
                  setPushError(e instanceof Error ? e.message : "Disattivazione push fallita");
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

        {user?.isDemo ? null : pushPermission === "denied" ? (
          <div className="mt-3">
            <Alert variant="warn" title="Permesso notifiche negato">
              Riabilita le notifiche nelle impostazioni del browser per questo sito e poi riprova.
            </Alert>
          </div>
        ) : null}

        <div className="mt-3 text-xs lp-muted">
          Stato: {pushPrefs.pushEnabled === false ? "disattivate" : pushToken ? "attive" : "non attive"}
        </div>
        {pushError ? <div className="mt-3"><Alert variant="danger" title="Errore">{pushError}</Alert></div> : null}
        </CardContent>
      </Card>

      <div id="settings-diagnostics" />
      {import.meta.env.DEV ? (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostica</CardTitle>
            <CardDescription>Strumenti per sbloccare i tasti se qualcosa sembra non funzionare.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app/diagnostics" className="lp-btn-secondary inline-flex items-center justify-center">
              Apri diagnostica
            </Link>
          </CardContent>
        </Card>
      ) : null}
        </div>
      </div>
    </div>
  );
}

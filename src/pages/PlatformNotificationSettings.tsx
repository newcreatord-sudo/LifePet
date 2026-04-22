import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsSettingsStore } from "@/multispecies/stores/msSettingsStore";

export default function PlatformNotificationSettings() {
  useMultiSpeciesDemo();

  const prefs = useMsSettingsStore((s) => s.notifications);
  const setPrefs = useMsSettingsStore((s) => s.setNotifications);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Notifiche (Piattaforma)", en: "Notifications (Platform)" }}
        description={{ it: "Preferenze per alert pet e farm: canali, severità minima e quiet hours.", en: "Preferences for pet/farm alerts: channels, minimum severity and quiet hours." }}
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Stato
              </CardTitle>
              <CardDescription>Attiva/disattiva e filtra le notifiche.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Notifiche</div>
                  <select
                    className="w-full lp-input mt-2"
                    value={prefs.enabled ? "1" : "0"}
                    onChange={(e) => setPrefs({ ...prefs, enabled: e.target.value === "1" })}
                  >
                    <option value="1">ON</option>
                    <option value="0">OFF</option>
                  </select>
                </div>
                <div className="lp-panel p-3">
                  <div className="text-xs lp-muted">Severità minima</div>
                  <select
                    className="w-full lp-input mt-2"
                    value={prefs.minSeverity}
                    onChange={(e) => setPrefs({ ...prefs, minSeverity: e.target.value === "critical" ? "critical" : e.target.value === "info" ? "info" : "warning" })}
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 lp-panel p-3">
                <div className="text-xs lp-muted">Quiet hours (opzionale)</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="lp-input"
                    placeholder="22:00"
                    value={prefs.quietHours?.start ?? ""}
                    onChange={(e) => setPrefs({ ...prefs, quietHours: { start: e.target.value, end: prefs.quietHours?.end ?? "" } })}
                  />
                  <input
                    className="lp-input"
                    placeholder="07:00"
                    value={prefs.quietHours?.end ?? ""}
                    onChange={(e) => setPrefs({ ...prefs, quietHours: { start: prefs.quietHours?.start ?? "", end: e.target.value } })}
                  />
                </div>
                <div className="mt-2 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                  In demo impatta solo le notifiche in-app; i canali esterni richiedono backend.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Canali</CardTitle>
              <CardDescription>In-app è disponibile subito. Push/email/SMS sono predisposti.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="lp-panel p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Push</div>
                      <div className="text-xs lp-muted">FCM / APNS / Android</div>
                    </div>
                  </div>
                  <select className="lp-input" value={prefs.channels.push ? "1" : "0"} onChange={(e) => setPrefs({ ...prefs, channels: { ...prefs.channels, push: e.target.value === "1" } })}>
                    <option value="0">OFF</option>
                    <option value="1">ON</option>
                  </select>
                </div>

                <div className="lp-panel p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Email</div>
                      <div className="text-xs lp-muted">Resend/Sendgrid</div>
                    </div>
                  </div>
                  <select className="lp-input" value={prefs.channels.email ? "1" : "0"} onChange={(e) => setPrefs({ ...prefs, channels: { ...prefs.channels, email: e.target.value === "1" } })}>
                    <option value="0">OFF</option>
                    <option value="1">ON</option>
                  </select>
                </div>

                <div className="lp-panel p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>SMS</div>
                      <div className="text-xs lp-muted">Twilio</div>
                    </div>
                  </div>
                  <select className="lp-input" value={prefs.channels.sms ? "1" : "0"} onChange={(e) => setPrefs({ ...prefs, channels: { ...prefs.channels, sms: e.target.value === "1" } })}>
                    <option value="0">OFF</option>
                    <option value="1">ON</option>
                  </select>
                </div>

                <div className="lp-panel p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>In-app</div>
                      <div className="text-xs lp-muted">Inbox + toast</div>
                    </div>
                  </div>
                  <select className="lp-input" value={prefs.channels.in_app ? "1" : "0"} onChange={(e) => setPrefs({ ...prefs, channels: { ...prefs.channels, in_app: e.target.value === "1" } })}>
                    <option value="0">OFF</option>
                    <option value="1">ON</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Download, HeartPulse, MapPinned, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { subscribeBindings, subscribeDevices, subscribeRecentSamples, subscribeSubjects } from "@/multispecies/data/msData";
import type { Device, DeviceBinding, MetricSample, Subject } from "@/multispecies/types";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(samples: MetricSample[]) {
  const header = ["id", "subjectId", "deviceId", "metricType", "value", "unit", "sourceTimestamp", "receivedAt", "sourceType"];
  const rows = samples.map((s) => [
    s.id,
    s.subjectId,
    s.deviceId,
    s.metricType,
    String(s.value),
    s.unit ?? "",
    String(s.sourceTimestamp),
    String(s.receivedAt),
    s.sourceType,
  ]);
  const esc = (v: string) => {
    const needs = /[",\n\r]/.test(v);
    const safe = v.replace(/"/g, '""');
    return needs ? `"${safe}"` : safe;
  };
  return [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export default function PlatformSubjectProfile() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const location = useLocation();
  const base = location.pathname.startsWith("/app/farm")
    ? "/app/farm"
    : "/app/tech";
  const { subjectId } = useParams();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [samples, setSamples] = useState<MetricSample[]>([]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);
  useEffect(() => {
    if (!subjectId) return;
    return subscribeRecentSamples(uid, subjectId, 400, setSamples);
  }, [uid, subjectId]);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId) ?? null, [subjects, subjectId]);
  const activeBinding = useMemo(() => bindings.find((b) => b.subjectId === subjectId && b.unboundAt == null) ?? null, [bindings, subjectId]);
  const device = useMemo(() => (activeBinding ? devices.find((d) => d.id === activeBinding.deviceId) ?? null : null), [devices, activeBinding]);

  const metricsToday = useMemo(() => {
    const now = Date.now();
    const min = now - 24 * 60 * 60 * 1000;
    const recent = samples.filter((s) => s.sourceTimestamp >= min);
    const byType = new Map<string, MetricSample>();
    for (const s of recent.sort((a, b) => b.sourceTimestamp - a.sourceTimestamp)) {
      if (!byType.has(s.metricType)) byType.set(s.metricType, s);
    }
    return Array.from(byType.values()).slice(0, 12);
  }, [samples]);

  if (!subjectId) {
    return (
      <div className="space-y-4">
        <PageHeader title={{ it: "Scheda animale", en: "Subject" }} description={{ it: "ID mancante.", en: "Missing ID." }} showImage={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: subject ? subject.displayName : "Scheda animale", en: subject ? subject.displayName : "Subject" }}
        description={{ it: subject ? `${subject.type} · ${subject.species}` : "", en: subject ? `${subject.type} · ${subject.species}` : "" }}
        showImage={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={base} className="lp-btn-secondary">{base === "/app/farm" ? "Farm" : "Piattaforma"}</Link>
            <button
              type="button"
              className="lp-btn-primary inline-flex items-center gap-2"
              onClick={() => {
                const csv = toCsv(samples);
                downloadText(`lifepet_${subjectId}_telemetry.csv`, csv, "text/csv");
              }}
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="w-4 h-4" />Dispositivo</CardTitle>
              <CardDescription>Binding attivo e stato.</CardDescription>
            </CardHeader>
            <CardContent>
              {!device ? (
                <div className="text-sm lp-muted">Nessun device collegato.</div>
              ) : (
                <div className="space-y-2">
                  <div className="lp-panel p-3">
                    <div className="text-xs lp-muted">Brand / Model</div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{device.brand} · {device.model}</div>
                    <div className="mt-1 text-xs lp-muted">{device.adapterType} {device.externalDeviceId ? `· ext ${device.externalDeviceId}` : ""}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="lp-panel p-3">
                      <div className="text-xs lp-muted">Batteria</div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{device.batteryLevel ?? "—"}</div>
                    </div>
                    <div className="lp-panel p-3">
                      <div className="text-xs lp-muted">Segnale</div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{device.signalStrength ?? "—"}</div>
                    </div>
                  </div>
                  <div className="lp-panel p-3">
                    <div className="text-xs lp-muted">Stato</div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{device.status}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartPulse className="w-4 h-4" />Ultimi valori</CardTitle>
              <CardDescription>Top metriche aggiornate nelle ultime 24h.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metricsToday.map((m) => (
                  <div key={m.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="text-xs lp-muted">{m.metricType}</div>
                    <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{String(m.value)}{m.unit ? ` ${m.unit}` : ""}</div>
                  </div>
                ))}
                {metricsToday.length === 0 ? <div className="text-sm lp-muted">Nessun dato recente.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPinned className="w-4 h-4" />Telemetria (ultimi 400 campioni)</CardTitle>
              <CardDescription>Usa Export CSV per scaricare dati e usarli in BI/report.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[640px] overflow-y-auto">
                {samples
                  .slice()
                  .sort((a, b) => b.sourceTimestamp - a.sourceTimestamp)
                  .map((s) => (
                    <div key={s.id} className="lp-panel px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{s.metricType}</div>
                        <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>{String(s.value)}{s.unit ? ` ${s.unit}` : ""}</div>
                      </div>
                      <div className="mt-1 text-xs lp-muted">{new Date(s.sourceTimestamp).toLocaleString()} · {s.sourceType}</div>
                    </div>
                  ))}
                {samples.length === 0 ? <div className="text-sm lp-muted">Nessun campione.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

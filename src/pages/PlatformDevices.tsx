import { useEffect, useMemo, useState } from "react";
import { Cable, Cpu, Link2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsUiStore } from "@/multispecies/stores/msUiStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import { getAdapter } from "@/multispecies/adapters/registry";
import {
  bindDevice,
  subscribeBindings,
  subscribeDevices,
  subscribeRecentSamples,
  subscribeSubjects,
  simTick,
  updateDevice,
} from "@/multispecies/data/msData";
import { runMultiSpeciesDemoTick } from "@/multispecies/demo/simulator";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { useAuthStore } from "@/stores/authStore";
import type { Device, DeviceBinding, MetricSample, Subject } from "@/multispecies/types";
import { useLocation } from "react-router-dom";

function statusBadge(status: string) {
  if (status === "battery_low") return "bg-amber-500/15 text-amber-700";
  if (status === "offline") return "bg-slate-500/15 text-slate-700";
  if (status === "error") return "bg-rose-500/15 text-rose-700";
  return "bg-emerald-500/15 text-emerald-700";
}

export default function PlatformDevices() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const location = useLocation();
  const inFarmArea = location.pathname.startsWith("/app/farm");
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);

  const selectedDeviceId = useMsUiStore((s) => s.selectedDeviceId);
  const setSelectedDeviceId = useMsUiStore((s) => s.setSelectedDeviceId);
  const simIntensity = useMsUiStore((s) => s.simIntensity);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bindings, setBindings] = useState<DeviceBinding[]>([]);
  const [samples, setSamples] = useState<MetricSample[]>([]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeDevices(uid, setDevices), [uid]);
  useEffect(() => subscribeBindings(uid, setBindings), [uid]);

  const selectedDevice = useMemo(() => devices.find((d) => d.id === selectedDeviceId) ?? null, [devices, selectedDeviceId]);
  const boundSubjectId = useMemo(() => {
    if (!selectedDevice) return null;
    const b = bindings.find((x) => x.deviceId === selectedDevice.id && !x.unboundAt);
    return b?.subjectId ?? null;
  }, [bindings, selectedDevice]);
  const boundSubject = useMemo(() => subjects.find((s) => s.id === boundSubjectId) ?? null, [boundSubjectId, subjects]);

  useEffect(() => {
    if (!boundSubjectId) {
      setSamples([]);
      return;
    }
    return subscribeRecentSamples(uid, boundSubjectId, 40, setSamples);
  }, [boundSubjectId, uid]);

  const deviceRows = useMemo(() => {
    const subjectById = new Map(subjects.map((s) => [s.id, s] as const));
    const subjectIdByDeviceId = new Map(bindings.filter((b) => !b.unboundAt).map((b) => [b.deviceId, b.subjectId] as const));
    const rows = devices.map((d) => {
      const sid = subjectIdByDeviceId.get(d.id);
      const s = sid ? subjectById.get(sid) : undefined;
      return { device: d, subject: s };
    });
    if (!inFarmArea) return rows.filter((r) => (!r.subject ? true : r.subject.type === "pet"));
    return rows.filter((r) => {
      if (!r.subject) return true;
      if (r.subject.type === "pet") return false;
      if (activeFarmId && r.subject.farmId !== activeFarmId) return false;
      return true;
    });
  }, [activeFarmId, bindings, devices, inFarmArea, subjects]);

  const subjectOptions = useMemo(() => {
    if (inFarmArea) return subjects.filter((s) => s.type !== "pet").filter((s) => (activeFarmId ? s.farmId === activeFarmId : true));
    return subjects.filter((s) => s.type === "pet");
  }, [activeFarmId, inFarmArea, subjects]);

  const adapter = selectedDevice ? getAdapter(selectedDevice.adapterType) : null;
  const capabilities = adapter?.capabilities();
  const [externalIdDraft, setExternalIdDraft] = useState<string>("");

  useEffect(() => {
    setExternalIdDraft(selectedDevice?.externalDeviceId ? String(selectedDevice.externalDeviceId) : "");
  }, [selectedDevice?.externalDeviceId]);

  const webhookUrl = useMemo(() => {
    const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || "";
    const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string | undefined) || "us-central1";
    if (!projectId) return "";
    return `https://${region}-${projectId}.cloudfunctions.net/msIngestWebhook`;
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Dispositivi & Adapter", en: "Devices & Adapters" }}
        description={{ it: "Registro device, binding e telemetria normalizzata.", en: "Device registry, bindings and normalized telemetry." }}
        actions={
          <button
            type="button"
            className="lp-btn-secondary"
            onClick={() => {
              if (shouldUseDemoData()) {
                runMultiSpeciesDemoTick({ intensity: simIntensity });
                return;
              }
              void simTick(uid, simIntensity);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Tick
            </span>
          </button>
        }
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cable className="w-4 h-4" />
                Registro dispositivi
              </CardTitle>
              <CardDescription>Seleziona un device per vedere adapter, binding e stream.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deviceRows.map((r) => (
                  <button
                    key={r.device.id}
                    type="button"
                    onClick={() => setSelectedDeviceId(r.device.id)}
                    className={cn(
                      "w-full text-left lp-panel px-3 py-2 flex items-center justify-between gap-3",
                      selectedDeviceId === r.device.id ? "ring-2 ring-sky-500/30" : ""
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {r.device.brand} {r.device.model}
                      </div>
                      <div className="text-xs lp-muted truncate">
                        {r.device.adapterType} · {r.subject ? `${r.subject.displayName} (${r.subject.type})` : "Non associato"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("text-xs px-2 py-1 rounded-full", statusBadge(r.device.status))}>{r.device.status}</div>
                      <div className={cn("w-2 h-2 rounded-full", r.device.isOnline ? "bg-emerald-500" : "bg-slate-400")} />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Dettaglio
              </CardTitle>
              <CardDescription>{selectedDevice ? "Adapter e binding" : "Seleziona un dispositivo"}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDevice ? (
                <div className="text-sm lp-muted">Nessun device selezionato.</div>
              ) : (
                <div className="space-y-3">
                  <div className="lp-panel px-3 py-2">
                    <div className="text-xs lp-muted">Device ID</div>
                    <div className="text-sm font-medium break-all" style={{ color: "rgb(var(--lp-ink))" }}>{selectedDevice.id}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs lp-muted">Batteria</div>
                        <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>{Math.round(selectedDevice.batteryLevel ?? 0)}%</div>
                      </div>
                      <div>
                        <div className="text-xs lp-muted">Segnale</div>
                        <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>{Math.round(selectedDevice.signalStrength ?? 0)}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="lp-panel px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Binding</div>
                        <div className="text-xs lp-muted">Collega il device a un soggetto.</div>
                      </div>
                      <Link2 className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
                    </div>
                    <div className="mt-2">
                      <select
                        value={boundSubjectId ?? ""}
                        onChange={(e) => {
                          const next = e.target.value || null;
                          if (!next) return;
                          void bindDevice(uid, selectedDevice.id, next);
                        }}
                        className="w-full lp-input"
                      >
                        <option value="">Seleziona soggetto…</option>
                        {subjectOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.displayName} ({s.type})
                          </option>
                        ))}
                      </select>
                      {boundSubject ? (
                        <div className="mt-2 text-xs lp-muted">Attuale: {boundSubject.displayName}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="lp-panel px-3 py-2">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Capabilities</div>
                    <div className="text-xs lp-muted">Mock adapter pronto per integrazione reale.</div>
                    <div className="mt-2 text-xs" style={{ color: "rgb(var(--lp-ink))" }}>
                      {capabilities ? (
                        <div className="space-y-1">
                          <div>Brand: {capabilities.brand}</div>
                          <div>Livello: {capabilities.integrationLevel}</div>
                          <div>Categoria: {capabilities.deviceCategory}</div>
                          <div>Connessioni: {capabilities.connectivity.join(", ")}</div>
                          <div>Metriche: {capabilities.supportedMetrics.slice(0, 8).join(", ")}{capabilities.supportedMetrics.length > 8 ? "…" : ""}</div>
                        </div>
                      ) : (
                        <div>Nessun adapter trovato.</div>
                      )}
                    </div>
                  </div>

                  <div className="lp-panel px-3 py-2">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Webhook binding</div>
                    <div className="text-xs lp-muted">Imposta l’ID esterno del device (vendor) e genera un payload webhook.</div>

                    <div className="mt-2">
                      <div className="text-xs lp-muted">External device ID</div>
                      <div className="mt-1 flex gap-2">
                        <input className="lp-input flex-1" value={externalIdDraft} onChange={(e) => setExternalIdDraft(e.target.value)} placeholder="es. TRAC-123456" />
                        <button
                          type="button"
                          className="lp-btn-secondary"
                          onClick={() => {
                            if (!selectedDevice) return;
                            void updateDevice(uid, selectedDevice.id, { externalDeviceId: externalIdDraft.trim() || undefined });
                          }}
                        >
                          Salva
                        </button>
                      </div>
                      <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Usalo per agganciare i webhook senza conoscere il `deviceId` interno.</div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs lp-muted">Webhook URL</div>
                      <div className="mt-1 text-xs break-all" style={{ color: "rgb(var(--lp-ink))" }}>{webhookUrl || "Configura VITE_FIREBASE_PROJECT_ID per mostrare l’URL"}</div>
                      <div className="mt-2 text-xs lp-muted">Body esempio (invio vendor → LifePet):</div>
                      <textarea
                        className="w-full lp-input mt-1 min-h-[140px] font-mono text-xs"
                        readOnly
                        value={JSON.stringify(
                          {
                            uid,
                            adapterType: selectedDevice.adapterType,
                            externalDeviceId: externalIdDraft.trim() || selectedDevice.externalDeviceId || "",
                            subjectId: boundSubjectId || "",
                            payload: { ts: Date.now(), battery: selectedDevice.batteryLevel ?? 60, signal: selectedDevice.signalStrength ?? 70, online: true },
                          },
                          null,
                          2
                        )}
                      />
                      <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Header richiesto: `X-MS-Secret` (configurato su Firebase Functions come secret `MS_WEBHOOK_SECRET`).</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live</CardTitle>
              <CardDescription>Ultimi campioni normalizzati del soggetto associato.</CardDescription>
            </CardHeader>
            <CardContent>
              {boundSubjectId ? (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {samples.map((s) => (
                    <div key={s.id} className="lp-panel px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{s.metricType}</div>
                        <div className="text-xs lp-muted">{new Date(s.sourceTimestamp).toLocaleTimeString()}</div>
                      </div>
                      <div className="text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
                        {String(s.value)}{s.unit ? ` ${s.unit}` : ""}
                      </div>
                    </div>
                  ))}
                  {samples.length === 0 ? <div className="text-sm lp-muted">Nessun dato.</div> : null}
                </div>
              ) : (
                <div className="text-sm lp-muted">Collega il device a un soggetto per vedere lo stream.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

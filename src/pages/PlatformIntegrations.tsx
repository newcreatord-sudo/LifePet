import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cpu, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { INTEGRATION_CATALOG } from "@/multispecies/integrations/integrationCatalog";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { cn } from "@/lib/utils";
import { ALL_ADAPTERS, getAdapter } from "@/multispecies/adapters/registry";
import { VENDOR_PAYLOAD_EXAMPLES } from "@/multispecies/adapters/vendors/vendorAdapters";
import { getFirebaseWebConfig } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { useAuthStore } from "@/stores/authStore";
import { upsertIntegrationConfig } from "@/multispecies/data/msData";
import type { IntegrationMappingRow } from "@/multispecies/data/msFirestoreRepo";

type SegmentFilter = "all" | "pet" | "farm" | "generic";

function statusPill(status: string) {
  if (status === "ready") return "bg-emerald-500/15 text-emerald-700";
  if (status === "beta") return "bg-amber-500/15 text-amber-700";
  if (status === "planned") return "bg-slate-500/15 text-slate-700";
  return "bg-slate-500/15 text-slate-700";
}

function authLabel(a: string) {
  if (a === "oauth") return "OAuth";
  if (a === "api_key") return "API key";
  if (a === "webhook_secret") return "Webhook secret";
  if (a === "csv_import") return "CSV";
  if (a === "bluetooth") return "Bluetooth";
  if (a === "gateway") return "Gateway";
  return "—";
}

export default function PlatformIntegrations() {
  useMultiSpeciesDemo();
  const location = useLocation();
  const base = location.pathname.startsWith("/app/farm")
    ? "/app/farm"
    : "/app/tech";
  const uid = useAuthStore((s) => s.user?.uid) || "";
  const canUsePollingSimulator = shouldUseDemoData();
  const [filter, setFilter] = useState<SegmentFilter>("all");
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const firebaseWebhookUrl = useMemo(() => {
    try {
      const { projectId } = getFirebaseWebConfig();
      const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string | undefined) || "us-central1";
      return `https://${region}-${projectId}.cloudfunctions.net/msIngestWebhook`;
    } catch {
      return "";
    }
  }, []);

  const [testAdapterType, setTestAdapterType] = useState<string>("TractiveAdapter");
  const [testPayload, setTestPayload] = useState<string>(() => {
    const ex = VENDOR_PAYLOAD_EXAMPLES.TractiveAdapter?.[0]?.payload;
    return JSON.stringify(ex ?? { ts: Date.now(), lat: 41.9028, lng: 12.4964, speed: 1.1, battery: 62, signal: 74, online: true }, null, 2);
  });
  const [normalizedOut, setNormalizedOut] = useState<string>("");

  const [mappingAdapterType, setMappingAdapterType] = useState<string>("TractiveAdapter");
  const [mappings, setMappings] = useState<IntegrationMappingRow[]>([
    { path: "lat", metricType: "location_lat", unit: "deg" },
    { path: "lng", metricType: "location_lng", unit: "deg" },
    { path: "speed", metricType: "speed", unit: "m/s" },
    { path: "battery", metricType: "device_battery_level", unit: "%" },
  ]);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [pollingExternalIds, setPollingExternalIds] = useState<string>("");

  const items = useMemo(() => {
    const all = INTEGRATION_CATALOG.slice();
    const filtered = all.filter((i) => {
      if (filter === "all") return true;
      if (filter === "pet") return i.capabilities.speciesSupported.includes("pet");
      if (filter === "farm") return i.capabilities.speciesSupported.includes("bovine");
      return i.segment === "generic";
    });
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [filter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Integrazioni", en: "Integrations" }}
        description={{ it: "Catalogo integrazioni: pronto per collegare brand diversi tramite DeviceAdapter, senza riscrivere l’app.", en: "Integration catalog: connect multiple brands via DeviceAdapter without rewriting the app." }}
        actions={
          <div className="inline-flex rounded-full p-1 lp-panel">
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "all" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("all")}>Tutte</button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "pet" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("pet")}>Pet</button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "farm" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("farm")}>Farm</button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "generic" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("generic")}>Generiche</button>
          </div>
        }
        showImage={false}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Flusso dati standard</div>
              <div className="text-xs lp-muted mt-1">Vendor webhook/API/CSV → DeviceAdapter → Telemetria normalizzata → AlertEngine → Notifiche.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`${base}/devices`} className="lp-btn-secondary inline-flex items-center gap-2"><Cpu className="w-4 h-4" />Dispositivi</Link>
              <Link to={`${base}/alerts`} className="lp-btn-secondary inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Alert center</Link>
              <Link to={`${base}/marketplace`} className="lp-btn-secondary inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" />Compatibilità</Link>
            </div>
          </div>

          <div className="mt-3 lp-panel p-3">
            <div className="text-xs lp-muted">Webhook ingest (Firebase Functions)</div>
            <div className="mt-1 text-sm break-all" style={{ color: "rgb(var(--lp-ink))" }}>{firebaseWebhookUrl || "Configura Firebase per vedere l’URL"}</div>
            <div className="mt-2 text-xs lp-muted">Proxy Vercel (opzionale): {origin ? `${origin}/api/ms-webhook` : "/api/ms-webhook"}</div>
            <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Header richiesto: `x-ms-secret`.</div>
          </div>

          <div className="mt-3 lp-panel p-3">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Mapping per-vendor</div>
            <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Salva il mapping (payload path → metricType) in `msIntegrations/ADAPTER_TYPE`: il webhook lo usa per normalizzare.</div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <div className="text-xs lp-muted">Adapter</div>
                <select className="w-full lp-input mt-1" value={mappingAdapterType} onChange={(e) => setMappingAdapterType(e.target.value)}>
                  {ALL_ADAPTERS.map((a) => {
                    const c = a.capabilities();
                    return (
                      <option key={c.adapterType} value={c.adapterType}>
                        {c.brand} · {c.adapterType}
                      </option>
                    );
                  })}
                </select>
                <div className="mt-2 text-xs lp-muted">Tip: usa key semplici (`hr`, `tempC`) o nested (`data.hr`).</div>

                <div className="mt-4 text-xs lp-muted">Polling (scheduler)</div>
                <div className="mt-1 lp-panel p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>Abilita polling</div>
                      <div className="text-xs lp-muted">Simulatore per test (solo demo).</div>
                    </div>
                    <select
                      className="lp-input"
                      disabled={!canUsePollingSimulator}
                      value={pollingEnabled ? "1" : "0"}
                      onChange={(e) => setPollingEnabled(e.target.value === "1")}
                    >
                      <option value="0">OFF</option>
                      <option value="1">ON</option>
                    </select>
                  </div>
                  <div className="mt-2 text-xs lp-muted">External device IDs (comma-separated)</div>
                  <input
                    className="lp-input mt-1"
                    disabled={!canUsePollingSimulator || !pollingEnabled}
                    value={pollingExternalIds}
                    onChange={(e) => setPollingExternalIds(e.target.value)}
                    placeholder="es. TRAC-123, TRAC-456"
                  />
                  {!canUsePollingSimulator ? <div className="mt-2 text-xs lp-muted">Disponibile solo in demo. In produzione usa webhook o integrazione reale.</div> : null}
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="space-y-2">
                  {mappings.map((row, idx) => (
                    <div key={`${row.path}-${idx}`} className="grid grid-cols-12 gap-2">
                      <input
                        className="lp-input col-span-5 font-mono text-xs"
                        value={row.path}
                        onChange={(e) => setMappings(mappings.map((r, i) => (i === idx ? { ...r, path: e.target.value } : r)))}
                        placeholder="payload path (es. hr)"
                      />
                      <input
                        className="lp-input col-span-5 font-mono text-xs"
                        value={row.metricType}
                        onChange={(e) => setMappings(mappings.map((r, i) => (i === idx ? { ...r, metricType: e.target.value } : r)))}
                        placeholder="metricType (es. heart_rate)"
                      />
                      <input
                        className="lp-input col-span-1 font-mono text-xs"
                        value={row.unit ?? ""}
                        onChange={(e) => setMappings(mappings.map((r, i) => (i === idx ? { ...r, unit: e.target.value || undefined } : r)))}
                        placeholder="unit"
                      />
                      <button type="button" className="lp-btn-secondary col-span-1" onClick={() => setMappings(mappings.filter((_, i) => i !== idx))}>×</button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="lp-btn-secondary" onClick={() => setMappings([...mappings, { path: "", metricType: "" }])}>+ Riga</button>
                  <button
                    type="button"
                    className="lp-btn-primary"
                    disabled={!uid}
                    onClick={() => {
                      if (!uid) return;
                      const cleaned = mappings
                        .map((m) => ({ ...m, path: String(m.path || "").trim(), metricType: String(m.metricType || "").trim() }))
                        .filter((m) => m.path && m.metricType)
                        .slice(0, 200);
                      const ids = pollingExternalIds
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 20);
                      void upsertIntegrationConfig(uid, mappingAdapterType, { mappings: cleaned, pollingEnabled, pollingExternalDeviceIds: ids });
                    }}
                  >
                    Salva mapping
                  </button>
                  {!uid ? <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Accedi per salvare su Firestore.</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 lp-panel p-3">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Test normalizzazione (DeviceAdapter)</div>
            <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>Incolla un payload vendor: vedi cosa diventa nella telemetria unificata.</div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <div className="text-xs lp-muted">Adapter</div>
                <select
                  className="w-full lp-input mt-1"
                  value={testAdapterType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTestAdapterType(next);
                    const ex = VENDOR_PAYLOAD_EXAMPLES[next]?.[0]?.payload;
                    if (ex) setTestPayload(JSON.stringify(ex, null, 2));
                  }}
                >
                  {ALL_ADAPTERS.map((a) => {
                    const c = a.capabilities();
                    return (
                      <option key={c.adapterType} value={c.adapterType}>
                        {c.brand} · {c.adapterType} ({c.integrationLevel})
                      </option>
                    );
                  })}
                </select>

                <div className="mt-3 text-xs lp-muted">Preset</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(VENDOR_PAYLOAD_EXAMPLES[testAdapterType] ?? []).slice(0, 3).map((ex) => (
                    <button key={ex.title} type="button" className="lp-btn-secondary" onClick={() => setTestPayload(JSON.stringify(ex.payload, null, 2))}>
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="text-xs lp-muted">Payload (JSON)</div>
                <textarea className="w-full lp-input mt-1 min-h-[180px] font-mono text-xs" value={testPayload} onChange={(e) => setTestPayload(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="lp-btn-primary"
                    onClick={() => {
                      setNormalizedOut("");
                      let obj: unknown;
                      try {
                        obj = JSON.parse(testPayload);
                      } catch {
                        setNormalizedOut(JSON.stringify({ error: "JSON non valido" }, null, 2));
                        return;
                      }
                      if (!obj || typeof obj !== "object") {
                        setNormalizedOut(JSON.stringify({ error: "Payload deve essere un oggetto" }, null, 2));
                        return;
                      }
                      const adapter = getAdapter(testAdapterType);
                      if (!adapter) {
                        setNormalizedOut(JSON.stringify({ error: "Adapter non trovato" }, null, 2));
                        return;
                      }
                      const batch = adapter.normalizeTelemetry({ subjectId: "subject_demo", deviceId: "device_demo", receivedAt: Date.now(), payload: obj as Record<string, unknown> });
                      setNormalizedOut(JSON.stringify(batch, null, 2));
                    }}
                  >
                    Normalizza
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={() => setNormalizedOut("")}>Pulisci</button>
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="text-xs lp-muted">Output normalizzato</div>
                <textarea className="w-full lp-input mt-1 min-h-[180px] font-mono text-xs" readOnly value={normalizedOut} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((i) => (
          <Card key={i.id} className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{i.name}</span>
                <span className={cn("text-xs px-2 py-1 rounded-full", statusPill(i.status))}>{i.status}</span>
              </CardTitle>
              <CardDescription>{i.capabilities.adapterType} · {i.capabilities.deviceCategory}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xs lp-muted">Auth: {i.auth.map(authLabel).join(" · ")}</div>
                <div className="text-xs lp-muted">Specie: {i.capabilities.speciesSupported.join(", ")}</div>
                <div className="text-xs lp-muted">Conn: {i.capabilities.connectivity.join(", ")}</div>
                <div className="text-xs lp-muted">Metriche: {i.capabilities.supportedMetrics.slice(0, 8).join(", ")}{i.capabilities.supportedMetrics.length > 8 ? "…" : ""}</div>
                <div className="text-xs lp-muted">Alert: {i.capabilities.supportedAlerts.slice(0, 6).join(", ")}{i.capabilities.supportedAlerts.length > 6 ? "…" : ""}</div>

                <div className="mt-3 lp-panel p-3">
                  <div className="text-xs lp-muted inline-flex items-center gap-2"><KeyRound className="w-3 h-3" />Setup (checklist)</div>
                  <div className="mt-2 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                    {i.setupChecklist.slice(0, 3).join(" · ")}{i.setupChecklist.length > 3 ? "…" : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link to={`${base}/devices`} className="lp-btn-secondary">Collega device</Link>
                  <Link to={`${base}/alerts`} className="lp-btn-secondary">Regole alert</Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

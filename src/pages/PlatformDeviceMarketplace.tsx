import { useMemo, useState } from "react";
import { BadgeCheck, Bluetooth, Cpu, Globe, Radio, Satellite, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { ALL_ADAPTERS } from "@/multispecies/adapters/registry";
import { INTEGRATION_CATALOG } from "@/multispecies/integrations/integrationCatalog";
import { cn } from "@/lib/utils";

function iconForConn(c: string) {
  if (c === "bluetooth") return Bluetooth;
  if (c === "wifi") return Wifi;
  if (c === "lte") return Radio;
  if (c === "satellite") return Satellite;
  if (c === "gateway") return Globe;
  return Cpu;
}

export default function PlatformDeviceMarketplace() {
  useMultiSpeciesDemo();
  const [filter, setFilter] = useState<"all" | "pet" | "livestock">("all");

  const rows = useMemo(() => {
    const base = ALL_ADAPTERS.map((a) => a.capabilities());
    const planned = INTEGRATION_CATALOG
      .filter((i) => !base.some((b) => b.adapterType === i.capabilities.adapterType))
      .map((i) => i.capabilities);
    return [...base, ...planned]
      .filter((c) => {
        if (filter === "all") return true;
        if (filter === "pet") return c.speciesSupported.includes("pet");
        return c.speciesSupported.includes("livestock") || c.speciesSupported.includes("bovine");
      })
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [filter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Dispositivi compatibili", en: "Compatible devices" }}
        description={{ it: "Catalogo compatibilità: brand supportati e integrazioni in arrivo.", en: "Compatibility catalog: supported brands and upcoming integrations." }}
        actions={
          <div className="inline-flex rounded-full p-1 lp-panel">
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "all" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("all")}>Tutti</button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "pet" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("pet")}>Pet</button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", filter === "livestock" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setFilter("livestock")}>Allevamento</button>
          </div>
        }
        showImage={false}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((c) => {
          const Conn = iconForConn(c.connectivity[0] ?? "mixed");
          return (
            <Card key={c.adapterType} className="relative overflow-hidden">
              <div className="lp-card-accent" aria-hidden="true" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Conn className="w-4 h-4" />
                  {c.brand}
                </CardTitle>
                <CardDescription>{c.adapterType} · {c.deviceCategory}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs lp-muted">Livello integrazione</div>
                    <div className={cn("text-xs px-2 py-1 rounded-full", c.integrationLevel === "ready" ? "bg-emerald-500/15 text-emerald-700" : c.integrationLevel === "beta" ? "bg-amber-500/15 text-amber-700" : "bg-slate-500/15 text-slate-700")}>
                      {c.integrationLevel}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="lp-chip inline-flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" />
                      Specie: {c.speciesSupported.join(", ")}
                    </span>
                    <span className="lp-chip inline-flex items-center gap-2">
                      <BadgeCheck className="w-3 h-3" />
                      Conn: {c.connectivity.join(", ")}
                    </span>
                  </div>
                  <div className="text-xs lp-muted">
                    Metriche: {c.supportedMetrics.slice(0, 10).join(", ")}{c.supportedMetrics.length > 10 ? "…" : ""}
                  </div>
                  <div className="text-xs lp-muted">
                    Alert: {c.supportedAlerts.slice(0, 8).join(", ")}{c.supportedAlerts.length > 8 ? "…" : ""}
                  </div>
                  <div className="mt-2 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Adapter sostituibile con webhook/API reali.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

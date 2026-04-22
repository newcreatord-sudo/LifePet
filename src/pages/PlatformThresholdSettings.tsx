import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { useMsSettingsStore } from "@/multispecies/stores/msSettingsStore";
import { upsertRule } from "@/multispecies/data/msData";
import { useAuthStore } from "@/stores/authStore";
import type { AlertRule, MetricType } from "@/multispecies/types";

const METRICS: MetricType[] = [
  "body_temperature",
  "inner_body_temperature",
  "heart_rate",
  "respiratory_rate",
  "activity_score",
  "rumination_duration",
  "rumination_score",
  "inactivity_duration",
  "device_online",
  "device_battery_level",
];

export default function PlatformThresholdSettings() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";

  const presets = useMsSettingsStore((s) => s.thresholdPresets);
  const setPresets = useMsSettingsStore((s) => s.setThresholdPresets);

  const [selectedId, setSelectedId] = useState<string | null>(presets[0]?.id ?? null);
  useEffect(() => {
    if (selectedId) return;
    if (presets[0]?.id) setSelectedId(presets[0].id);
  }, [presets, selectedId]);

  const selected = useMemo(() => presets.find((p) => p.id === selectedId) ?? null, [presets, selectedId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Soglie & Profili", en: "Thresholds & Profiles" }}
        description={{ it: "Imposta soglie base e genera regole alert coerenti per pet e bovini.", en: "Set base thresholds and generate coherent alert rules for pets and bovines." }}
        showImage={false}
        actions={
          <button
            type="button"
            className="lp-btn-secondary"
            onClick={() => {
              void (async () => {
                for (const p of presets.filter((x) => x.enabled)) {
                  const rule: Omit<AlertRule, "id" | "createdAt"> & { id?: string } = {
                    type: "threshold",
                    enabled: true,
                    scope: "type",
                    subjectType: p.subjectType,
                    metricType: p.metricType,
                    operator: p.operator,
                    threshold: p.threshold,
                    windowMinutes: p.windowMinutes,
                    severity: p.severity,
                    category: p.metricType === "device_online" || p.metricType === "device_battery_level" ? "device" : "health",
                    title: p.title,
                    description: "",
                    recommendedActions: ["Verifica"],
                  };
                  await upsertRule(uid, rule);
                }
              })();
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Genera regole
            </span>
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Preset soglie
              </CardTitle>
              <CardDescription>Seleziona un preset e modificalo. Poi genera regole in Alert Center.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      "w-full text-left lp-panel px-3 py-2 flex items-center justify-between gap-3 " +
                      (p.id === selectedId ? "ring-2 ring-sky-500/30" : "")
                    }
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{p.title}</div>
                      <div className="text-xs lp-muted truncate">{p.subjectType} · {p.metricType}</div>
                    </div>
                    <div className="text-xs lp-muted">{p.enabled ? "ON" : "OFF"}</div>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  className="lp-btn-secondary w-full"
                  onClick={() => {
                    const id = `preset_${Date.now()}`;
                    setPresets([
                      {
                        id,
                        subjectType: "pet",
                        metricType: "body_temperature",
                        operator: ">=",
                        threshold: 39.2,
                        windowMinutes: 10,
                        severity: "warning",
                        title: "Nuova soglia",
                        enabled: true,
                      },
                      ...presets,
                    ]);
                    setSelectedId(id);
                  }}
                >
                  + Nuovo preset
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Editor</CardTitle>
              <CardDescription>{selected ? "Modifica e salva." : "Seleziona un preset."}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <div className="text-sm lp-muted">Nessun preset selezionato.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs lp-muted">Titolo</div>
                    <input
                      className="w-full lp-input mt-1"
                      value={selected.title}
                      onChange={(e) => setPresets(presets.map((p) => (p.id === selected.id ? { ...p, title: e.target.value } : p)))}
                    />
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Abilitato</div>
                    <select
                      className="w-full lp-input mt-1"
                      value={selected.enabled ? "1" : "0"}
                      onChange={(e) => setPresets(presets.map((p) => (p.id === selected.id ? { ...p, enabled: e.target.value === "1" } : p)))}
                    >
                      <option value="1">ON</option>
                      <option value="0">OFF</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-xs lp-muted">Target</div>
                    <select
                      className="w-full lp-input mt-1"
                      value={selected.subjectType}
                      onChange={(e) =>
                        setPresets(presets.map((p) => (p.id === selected.id ? { ...p, subjectType: e.target.value === "livestock" ? "livestock" : "pet" } : p)))
                      }
                    >
                      <option value="pet">Pet</option>
                      <option value="livestock">Allevamento</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-xs lp-muted">Metrica</div>
                    <select
                      className="w-full lp-input mt-1"
                      value={selected.metricType}
                      onChange={(e) => setPresets(presets.map((p) => (p.id === selected.id ? { ...p, metricType: e.target.value as MetricType } : p)))}
                    >
                      {METRICS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-xs lp-muted">Operatore</div>
                    <select
                      className="w-full lp-input mt-1"
                      value={selected.operator}
                      onChange={(e) => setPresets(presets.map((p) => (p.id === selected.id ? { ...p, operator: e.target.value as ">" | ">=" | "<" | "<=" } : p)))}
                    >
                      <option value=">=">&gt;=</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value="<">&lt;</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Soglia</div>
                    <input
                      className="w-full lp-input mt-1"
                      value={String(selected.threshold)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPresets(presets.map((p) => (p.id === selected.id ? { ...p, threshold: Number.isFinite(n) ? n : p.threshold } : p)));
                      }}
                    />
                  </div>

                  <div>
                    <div className="text-xs lp-muted">Finestra (min)</div>
                    <input
                      className="w-full lp-input mt-1"
                      value={String(selected.windowMinutes)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPresets(presets.map((p) => (p.id === selected.id ? { ...p, windowMinutes: Number.isFinite(n) ? Math.max(1, Math.round(n)) : p.windowMinutes } : p)));
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-xs lp-muted">Severità</div>
                    <select
                      className="w-full lp-input mt-1"
                      value={selected.severity}
                      onChange={(e) => setPresets(presets.map((p) => (p.id === selected.id ? { ...p, severity: e.target.value as "info" | "warning" | "critical" } : p)))}
                    >
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="critical">critical</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      className="lp-btn-secondary w-full"
                      onClick={() => {
                        setPresets(presets.filter((p) => p.id !== selected.id));
                        setSelectedId(null);
                      }}
                    >
                      Elimina preset
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

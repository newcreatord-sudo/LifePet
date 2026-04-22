import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AlertRule, MetricType, Subject } from "@/multispecies/types";

const metricOptions: MetricType[] = [
  "body_temperature",
  "inner_body_temperature",
  "ear_temperature",
  "heart_rate",
  "respiratory_rate",
  "activity_score",
  "movement_activity",
  "rumination_duration",
  "rumination_score",
  "estrus_probability",
  "insemination_window_score",
  "illness_risk_score",
  "geofence_status",
  "device_battery_level",
  "device_online",
];

export function RuleEditor(props: {
  draft: Partial<AlertRule>;
  subjects: Subject[];
  onChange: (next: Partial<AlertRule>) => void;
  onSave: () => void;
}) {
  const d = props.draft;

  const typeValue: AlertRule["type"] = d.type === "anomaly" ? "anomaly" : d.type === "trend" ? "trend" : "threshold";
  const scopeValue: AlertRule["scope"] = d.scope === "subject" ? "subject" : "type";
  const subjectTypeValue: NonNullable<AlertRule["subjectType"]> = d.subjectType === "livestock" || d.subjectType === "bovine" ? "livestock" : "pet";
  const severityValue: AlertRule["severity"] = d.severity === "critical" ? "critical" : d.severity === "info" ? "info" : "warning";
  const categoryValue: AlertRule["category"] =
    d.category === "reproductive"
      ? "reproductive"
      : d.category === "safety"
        ? "safety"
        : d.category === "device"
          ? "device"
          : d.category === "farm"
            ? "farm"
            : "health";
  const operatorValue: NonNullable<AlertRule["operator"]> =
    d.operator === ">" || d.operator === ">=" || d.operator === "<" || d.operator === "<=" || d.operator === "==" ? d.operator : ">=";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor regola</CardTitle>
        <CardDescription>Threshold, anomaly e trend (demo).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs lp-muted">
              Tipo
              <select
                className="mt-1 w-full lp-input"
                value={typeValue}
                onChange={(e) =>
                  props.onChange({
                    ...d,
                    type: e.target.value === "anomaly" ? "anomaly" : e.target.value === "trend" ? "trend" : "threshold",
                  })
                }
              >
                <option value="threshold">threshold</option>
                <option value="anomaly">anomaly</option>
                <option value="trend">trend</option>
              </select>
            </label>
            <label className="text-xs lp-muted">
              Abilitata
              <select
                className="mt-1 w-full lp-input"
                value={d.enabled ? "1" : "0"}
                onChange={(e) => props.onChange({ ...d, enabled: e.target.value === "1" })}
              >
                <option value="1">on</option>
                <option value="0">off</option>
              </select>
            </label>
          </div>

          <label className="text-xs lp-muted">
            Titolo
            <input className="mt-1 w-full lp-input" value={String(d.title ?? "")} onChange={(e) => props.onChange({ ...d, title: e.target.value })} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs lp-muted">
              Scope
              <select
                className="mt-1 w-full lp-input"
                value={scopeValue}
                onChange={(e) => props.onChange({ ...d, scope: e.target.value === "subject" ? "subject" : "type" })}
              >
                <option value="type">type</option>
                <option value="subject">subject</option>
              </select>
            </label>
            <label className="text-xs lp-muted">
              Specie/Tipo
              <select
                className="mt-1 w-full lp-input"
                value={subjectTypeValue}
                onChange={(e) => props.onChange({ ...d, subjectType: e.target.value === "livestock" ? "livestock" : "pet" })}
                disabled={scopeValue !== "type"}
              >
                <option value="pet">pet</option>
                <option value="livestock">livestock</option>
              </select>
            </label>
          </div>

          <label className="text-xs lp-muted">
            Soggetto
            <select
              className="mt-1 w-full lp-input"
              value={String(d.subjectId ?? "")}
              onChange={(e) => props.onChange({ ...d, subjectId: e.target.value || undefined })}
              disabled={scopeValue !== "subject"}
            >
              <option value="">Seleziona…</option>
              {props.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.type})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs lp-muted">
              Metrica
              <select
                className="mt-1 w-full lp-input"
                value={String(d.metricType ?? "body_temperature")}
                onChange={(e) => props.onChange({ ...d, metricType: e.target.value as MetricType })}
              >
                {metricOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs lp-muted">
              Finestra (min)
              <input
                type="number"
                className="mt-1 w-full lp-input"
                value={String(d.windowMinutes ?? 10)}
                onChange={(e) => props.onChange({ ...d, windowMinutes: Number(e.target.value) })}
              />
            </label>
          </div>

          {d.type === "threshold" || d.type === "trend" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs lp-muted">
                Operatore
                <select
                  className="mt-1 w-full lp-input"
                  value={operatorValue}
                  onChange={(e) => props.onChange({ ...d, operator: e.target.value as AlertRule["operator"] })}
                >
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="==">==</option>
                </select>
              </label>
              <label className="text-xs lp-muted">
                Soglia
                <input
                  className="mt-1 w-full lp-input"
                  value={String(d.threshold ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = Number(v);
                    props.onChange({ ...d, threshold: Number.isFinite(n) ? n : v });
                  }}
                />
              </label>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs lp-muted">
              Severità
              <select
                className="mt-1 w-full lp-input"
                value={severityValue}
                onChange={(e) => props.onChange({ ...d, severity: e.target.value as AlertRule["severity"] })}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="text-xs lp-muted">
              Categoria
              <select
                className="mt-1 w-full lp-input"
                value={categoryValue}
                onChange={(e) => props.onChange({ ...d, category: e.target.value as AlertRule["category"] })}
              >
                <option value="health">health</option>
                <option value="reproductive">reproductive</option>
                <option value="safety">safety</option>
                <option value="device">device</option>
                <option value="farm">farm</option>
              </select>
            </label>
          </div>

          <label className="text-xs lp-muted">
            Descrizione
            <textarea
              className="mt-1 w-full lp-input min-h-[74px]"
              value={String(d.description ?? "")}
              onChange={(e) => props.onChange({ ...d, description: e.target.value })}
            />
          </label>

          <button type="button" className="lp-btn-primary w-full" onClick={props.onSave}>
            Salva
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

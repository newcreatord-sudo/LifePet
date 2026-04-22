import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { importTelemetryBatch } from "@/multispecies/data/msData";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function guessValue(v: string) {
  const s = v.trim();
  if (!s) return null;
  if (s === "true") return true;
  if (s === "false") return false;
  const n = Number(s);
  if (Number.isFinite(n) && String(n) === s) return n;
  return s;
}

export default function PlatformImportCsv() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "";
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [result, setResult] = useState<string>("");

  const preview = useMemo(() => {
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    return lines.slice(0, 6).join("\n");
  }, [csvText]);

  async function runImport() {
    setResult("");
    if (!uid) {
      setResult("Accedi per importare su Firebase.");
      return;
    }
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setResult("CSV vuoto o senza righe dati.");
      return;
    }
    const header = parseCsvLine(lines[0]);
    const rows: Array<{ adapterType?: string; deviceId?: string; subjectId?: string; externalDeviceId?: string; payload: Record<string, unknown>; receivedAt?: number }> = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < header.length; i++) {
        const k = header[i];
        if (!k) continue;
        obj[k] = guessValue(cols[i] ?? "");
      }

      const adapterType = typeof obj.adapterType === "string" ? obj.adapterType : undefined;
      const deviceId = typeof obj.deviceId === "string" ? obj.deviceId : undefined;
      const subjectId = typeof obj.subjectId === "string" ? obj.subjectId : undefined;
      const externalDeviceId = typeof obj.externalDeviceId === "string" ? obj.externalDeviceId : undefined;
      const ts = typeof obj.ts === "number" ? obj.ts : typeof obj.receivedAt === "number" ? obj.receivedAt : Date.now();

      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === "adapterType" || k === "deviceId" || k === "subjectId" || k === "externalDeviceId" || k === "receivedAt" || k === "ts") continue;
        if (v === null) continue;
        payload[k] = v;
      }
      payload.ts = ts;
      rows.push({ adapterType, deviceId, subjectId, externalDeviceId, payload, receivedAt: ts });
      if (rows.length >= 500) break;
    }
    const resp = await importTelemetryBatch(uid, rows);
    setResult(JSON.stringify(resp, null, 2));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Import CSV", en: "CSV Import" }}
        description={{ it: "Carica telemetria storica o da gateway. Ogni riga diventa un evento in coda ingest.", en: "Upload historical telemetry or gateway data. Each row becomes an ingest queue item." }}
        showImage={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />Formato CSV</CardTitle>
          <CardDescription>Header consigliato: `adapterType,externalDeviceId,subjectId,ts,(campi payload...)`</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs lp-muted">Esempio:</div>
          <pre className="mt-2 lp-panel p-3 text-xs overflow-auto">adapterType,externalDeviceId,subjectId,ts,hr,tempC,rr\nPetPaceAdapter,PETPACE-001,subject_demo,1710000000000,104,38.6,22</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4" />Carica</CardTitle>
          <CardDescription>Puoi incollare il CSV o caricare un file.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              className="lp-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                void f.text().then(setCsvText);
              }}
            />
            <button type="button" className="lp-btn-primary" onClick={() => void runImport()}>
              Importa (enqueue)
            </button>
          </div>

          {fileName ? <div className="mt-2 text-xs lp-muted">File: {fileName}</div> : null}

          <div className="mt-3">
            <div className="text-xs lp-muted">CSV</div>
            <textarea className="w-full lp-input mt-1 min-h-[220px] font-mono text-xs" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          </div>

          <div className="mt-3">
            <div className="text-xs lp-muted">Preview</div>
            <pre className="mt-1 lp-panel p-3 text-xs overflow-auto">{preview}</pre>
          </div>

          {result ? (
            <div className="mt-3">
              <div className="text-xs lp-muted">Risultato</div>
              <pre className="mt-1 lp-panel p-3 text-xs overflow-auto">{result}</pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

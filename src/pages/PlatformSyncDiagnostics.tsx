import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ListChecks, ServerCrash } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { subscribeAuditLogs, subscribeDeadLetters, subscribeIngestQueue, subscribeSyncLogs } from "@/multispecies/data/msData";
import type { MsAuditLog, MsDeadLetter, MsQueueItem, MsSyncLog } from "@/multispecies/data/msFirestoreRepo";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";

type Tab = "sync" | "queue" | "dlq" | "audit";

export default function PlatformSyncDiagnostics() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "";
  const [tab, setTab] = useState<Tab>("sync");
  const [sync, setSync] = useState<MsSyncLog[]>([]);
  const [queue, setQueue] = useState<MsQueueItem[]>([]);
  const [dlq, setDlq] = useState<MsDeadLetter[]>([]);
  const [audit, setAudit] = useState<MsAuditLog[]>([]);

  useEffect(() => {
    if (!uid) return;
    const a = subscribeSyncLogs(uid, setSync);
    const b = subscribeIngestQueue(uid, setQueue);
    const c = subscribeDeadLetters(uid, setDlq);
    const d = subscribeAuditLogs(uid, setAudit);
    return () => {
      a?.();
      b?.();
      c?.();
      d?.();
    };
  }, [uid]);

  const queueStats = useMemo(() => {
    let pending = 0;
    let processing = 0;
    let done = 0;
    let dead = 0;
    for (const q of queue) {
      if (q.status === "pending") pending++;
      else if (q.status === "processing") processing++;
      else if (q.status === "done") done++;
      else if (q.status === "dead") dead++;
    }
    return { pending, processing, done, dead };
  }, [queue]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Diagnostica ingest", en: "Ingest diagnostics" }}
        description={{ it: "Storico sincronizzazioni, coda ingest e dead-letter queue.", en: "Sync history, ingest queue and dead-letter queue." }}
        showImage={false}
        actions={
          <div className="inline-flex rounded-full p-1 lp-panel">
            <button type="button" className={tab === "sync" ? "lp-btn-primary" : "lp-btn-secondary"} onClick={() => setTab("sync")}>Sync</button>
            <button type="button" className={tab === "queue" ? "lp-btn-primary" : "lp-btn-secondary"} onClick={() => setTab("queue")}>Queue</button>
            <button type="button" className={tab === "dlq" ? "lp-btn-primary" : "lp-btn-secondary"} onClick={() => setTab("dlq")}>DLQ</button>
            <button type="button" className={tab === "audit" ? "lp-btn-primary" : "lp-btn-secondary"} onClick={() => setTab("audit")}>Audit</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Pending</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{queueStats.pending}</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Processing</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{queueStats.processing}</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Done</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{queueStats.done}</div>
        </div>
        <div className="lp-panel p-3">
          <div className="text-xs lp-muted">Dead</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{queueStats.dead}</div>
        </div>
      </div>

      {tab === "sync" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" />Sync logs</CardTitle>
            <CardDescription>Eventi: webhook, queue, polling, csv import.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {sync.map((r) => (
                <div key={r.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{String(r.kind)} {r.ok ? "OK" : "FAIL"}</div>
                    <div className="text-xs lp-muted truncate">{new Date(Number(r.createdAt)).toLocaleString()}</div>
                  </div>
                  <div className="text-xs lp-muted truncate">{r.error ? String(r.error) : r.inserted != null ? `inserted ${String(r.inserted)}` : r.enqueued != null ? `enqueued ${String(r.enqueued)}` : ""}</div>
                </div>
              ))}
              {sync.length === 0 ? <div className="text-sm lp-muted">Nessun log.</div> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "queue" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="w-4 h-4" />Ingest queue</CardTitle>
            <CardDescription>Eventi in coda (pending/processing/done/dead).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {queue.map((q) => (
                <div key={q.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{String(q.status)}</div>
                    <div className="text-xs lp-muted truncate">{new Date(Number(q.createdAt)).toLocaleString()}</div>
                  </div>
                  <div className="text-xs lp-muted truncate">attempts {String(q.attempts ?? 0)} {q.lastError ? `· ${String(q.lastError)}` : ""}</div>
                </div>
              ))}
              {queue.length === 0 ? <div className="text-sm lp-muted">Coda vuota.</div> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "dlq" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ServerCrash className="w-4 h-4" />Dead-letter queue</CardTitle>
            <CardDescription>Eventi ingest falliti definitivamente (da analizzare/ritentare).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {dlq.map((d) => (
                <div key={d.id} className="lp-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{String(d.kind)}</div>
                    <div className="text-xs lp-muted">{new Date(Number(d.createdAt)).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="w-3 h-3" />{String(d.error)}</span>
                  </div>
                </div>
              ))}
              {dlq.length === 0 ? <div className="text-sm lp-muted">Nessun evento.</div> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "audit" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" />Audit log</CardTitle>
            <CardDescription>Eventi importanti (create/update) lato Functions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {audit.map((a) => (
                <div key={a.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{String(a.action)}</div>
                    <div className="text-xs lp-muted truncate">{new Date(Number(a.createdAt)).toLocaleString()}</div>
                  </div>
                  <div className="text-xs lp-muted truncate">{a.deviceId ? String(a.deviceId) : a.subjectId ? String(a.subjectId) : ""}</div>
                </div>
              ))}
              {audit.length === 0 ? <div className="text-sm lp-muted">Nessun evento.</div> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

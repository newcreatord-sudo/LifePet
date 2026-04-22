import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { subscribeAlerts, subscribeHerds, subscribeSubjects } from "@/multispecies/data/msData";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import { subjectStatusFromAlerts } from "@/multispecies/lib/msDerived";
import { useAuthStore } from "@/stores/authStore";
import type { AlertEvent, Herd, Subject } from "@/multispecies/types";
import { cn } from "@/lib/utils";

type ReportTab = "health" | "reproduction";

function badge(st: string) {
  if (st === "critical") return "bg-rose-500/15 text-rose-700";
  if (st === "warning") return "bg-amber-500/15 text-amber-700";
  if (st === "attention") return "bg-sky-500/15 text-sky-700";
  if (st === "offline") return "bg-slate-500/15 text-slate-700";
  return "bg-emerald-500/15 text-emerald-700";
}

export default function PlatformReports() {
  useMultiSpeciesDemo();
  const location = useLocation();
  const base = location.pathname.startsWith("/app/farm")
    ? "/app/farm"
    : "/app/tech";
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const [tab, setTab] = useState<ReportTab>("health");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);

  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeAlerts(uid, setAlerts), [uid]);

  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const livestock = useMemo(
    () => subjects.filter((s) => s.type !== "pet").filter((s) => (base === "/app/farm" && activeFarmId ? s.farmId === activeFarmId : true)),
    [activeFarmId, base, subjects]
  );

  const herdNameById = useMemo(() => new Map(herds.map((h) => [h.id, h.name] as const)), [herds]);

  const herdOverview = useMemo(() => {
    const rows = herds.map((h) => {
      const members = livestock.filter((s) => s.herdId === h.id);
      const counts = { normal: 0, attention: 0, warning: 0, critical: 0, offline: 0 };
      for (const s of members) {
        const st = subjectStatusFromAlerts(s, openAlerts, [], []);
        counts[st] += 1;
      }
      return { herd: h, total: members.length, counts };
    });
    return rows;
  }, [herds, livestock, openAlerts]);

  const topRisk = useMemo(() => {
    const target = tab === "reproduction" ? openAlerts.filter((a) => a.category === "reproductive") : openAlerts.filter((a) => a.category === "health" || a.category === "device" || a.category === "farm");
    const bySubject = new Map<string, AlertEvent[]>();
    for (const a of target) {
      const arr = bySubject.get(a.subjectId) ?? [];
      arr.push(a);
      bySubject.set(a.subjectId, arr);
    }
    const rows = subjects
      .filter((s) => (tab === "reproduction" ? s.type !== "pet" : true))
      .map((s) => {
        const list = bySubject.get(s.id) ?? [];
        const worst = list.reduce((m, a) => (a.severity === "critical" ? 3 : a.severity === "warning" ? 2 : a.severity === "info" ? 1 : 0) > m ? (a.severity === "critical" ? 3 : a.severity === "warning" ? 2 : 1) : m, 0);
        const status = worst >= 3 ? "critical" : worst === 2 ? "warning" : worst === 1 ? "attention" : "normal";
        return { subject: s, status, count: list.length, herdName: s.herdId ? herdNameById.get(s.herdId) : undefined };
      })
      .sort((a, b) => {
        const rank = (st: string) => (st === "critical" ? 4 : st === "warning" ? 3 : st === "attention" ? 2 : st === "offline" ? 1 : 0);
        const r = rank(b.status) - rank(a.status);
        if (r !== 0) return r;
        return b.count - a.count;
      })
      .slice(0, 20);
    return rows;
  }, [herdNameById, openAlerts, subjects, tab]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Report", en: "Reports" }}
        description={{ it: "Riepiloghi automatici: salute e riproduzione (demo).", en: "Automatic summaries: health and reproduction (demo)." }}
        showImage={false}
        actions={
          <div className="inline-flex rounded-full p-1 lp-panel">
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", tab === "health" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setTab("health")}>
              <span className="inline-flex items-center gap-2"><HeartPulse className="w-4 h-4" />Salute</span>
            </button>
            <button type="button" className={cn("px-3 py-1.5 rounded-full text-sm", tab === "reproduction" ? "lp-btn-primary" : "lp-btn-secondary")} onClick={() => setTab("reproduction")}>
              <span className="inline-flex items-center gap-2"><ClipboardList className="w-4 h-4" />Riproduzione</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Overview mandria</CardTitle>
              <CardDescription>Conteggio capi per mandria (basato sugli alert aperti).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {herdOverview.map((r) => (
                  <div key={r.herd.id} className="lp-panel px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium" style={{ color: "rgb(var(--lp-ink))" }}>{r.herd.name}</div>
                      <div className="text-xs lp-muted">{r.total} capi</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={cn("px-2 py-1 rounded-full", badge("normal"))}>normal {r.counts.normal}</span>
                      <span className={cn("px-2 py-1 rounded-full", badge("attention"))}>attention {r.counts.attention}</span>
                      <span className={cn("px-2 py-1 rounded-full", badge("warning"))}>warning {r.counts.warning}</span>
                      <span className={cn("px-2 py-1 rounded-full", badge("critical"))}>critical {r.counts.critical}</span>
                      <span className={cn("px-2 py-1 rounded-full", badge("offline"))}>offline {r.counts.offline}</span>
                    </div>
                  </div>
                ))}
                {herdOverview.length === 0 ? <div className="text-sm lp-muted">Nessuna mandria.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Da controllare oggi</CardTitle>
              <CardDescription>{tab === "reproduction" ? "Top capi con segnali riproduttivi" : "Top soggetti con alert salute/dispositivo"}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {topRisk.map((r) => (
                  <div key={r.subject.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`${base}/subjects/${r.subject.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {r.subject.displayName}
                      </Link>
                      <div className="text-xs lp-muted truncate">{r.subject.type}{r.herdName ? ` · ${r.herdName}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("text-xs px-2 py-1 rounded-full", badge(r.status))}>{r.status}</div>
                      <div className="text-xs lp-muted">{r.count}</div>
                    </div>
                  </div>
                ))}
                {topRisk.length === 0 ? <div className="text-sm lp-muted">Nessun elemento.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Crown, FileText, HeartPulse, ListTodo, NotebookPen, Search, ShieldPlus } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePetStore } from "@/stores/petStore";
import { subscribeRecentHealthEvents } from "@/data/health";
import { subscribeLogsRange } from "@/data/logs";
import { subscribeDocuments, getPetDocumentDownloadUrl } from "@/data/documents";
import { subscribeTasks } from "@/data/tasks";
import type { HealthEvent, PetDocument, PetLog, PetTask } from "@/types";
import { getBillingStatus, type BillingStatus } from "@/data/billing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";

type ItemKind = "health" | "log" | "doc" | "task";

type TimelineItem = {
  kind: ItemKind;
  id: string;
  ts: number;
  title: string;
  subtitle?: string;
  note?: string;
  attachment?: { name: string; storagePath: string };
};

function iconFor(kind: ItemKind) {
  if (kind === "health") return ShieldPlus;
  if (kind === "log") return NotebookPen;
  if (kind === "task") return ListTodo;
  return FileText;
}

function labelForLogType(type: string) {
  if (type === "symptom") return "Sintomo";
  if (type === "weight") return "Peso";
  if (type === "med") return "Farmaco";
  if (type === "vet") return "Veterinario";
  if (type === "food") return "Cibo";
  if (type === "water") return "Acqua";
  if (type === "activity") return "Attività";
  return type.toUpperCase();
}

export default function Records() {
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);
  const activePetId = usePetStore((s) => s.activePetId);
  const [health, setHealth] = useState<HealthEvent[]>([]);
  const [logs, setLogs] = useState<PetLog[]>([]);
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Record<ItemKind, boolean>>({ health: true, log: true, doc: true, task: false });
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  const range = useMemo(() => {
    const toMs = Date.now();
    const fromMs = toMs - 180 * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
  }, []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentHealthEvents(activePetId, 80, setHealth);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeLogsRange(activePetId, range.fromMs, range.toMs, setLogs);
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeDocuments(activePetId, setDocs);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeTasks(activePetId, setTasks);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!user || user.isDemo) return;
    getBillingStatus()
      .then(setBilling)
      .catch(() => setBilling(null));
  }, [user]);

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const ev of health) {
      items.push({
        kind: "health",
        id: ev.id,
        ts: ev.occurredAt,
        title: ev.title,
        subtitle: `${ev.type}${ev.severity ? ` · ${ev.severity}` : ""}`,
        note: ev.note,
        attachment: ev.attachments?.[0] ? { name: ev.attachments[0].name, storagePath: ev.attachments[0].storagePath } : undefined,
      });
    }

    const logTypes = new Set(["symptom", "weight", "med", "vet", "food", "water", "activity"]);
    for (const l of logs) {
      if (!logTypes.has(l.type)) continue;
      items.push({
        kind: "log",
        id: l.id,
        ts: l.occurredAt,
        title: labelForLogType(l.type),
        subtitle: new Date(l.occurredAt).toLocaleString(),
        note: l.note,
      });
    }

    for (const d of docs) {
      items.push({
        kind: "doc",
        id: d.id,
        ts: d.createdAt,
        title: d.name,
        subtitle: `Documento · ${(d.size / 1024).toFixed(0)} KB`,
        attachment: { name: d.name, storagePath: d.storagePath },
      });
    }

    for (const t of tasks) {
      if (!t.dueAt && !t.completedAt) continue;
      items.push({
        kind: "task",
        id: t.id,
        ts: t.completedAt ?? t.dueAt ?? t.createdAt,
        title: t.title,
        subtitle: `Task · ${t.status === "done" ? "completato" : "da fare"}`,
      });
    }

    const needle = q.trim().toLowerCase();
    return items
      .filter((it) => show[it.kind])
      .filter((it) => {
        if (!needle) return true;
        return `${it.title} ${it.subtitle ?? ""} ${it.note ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200);
  }, [docs, health, logs, q, show, tasks]);

  const effectivePlan = billing?.effectivePlan ?? (profile?.plan ?? (user?.isDemo ? "pro" : "free"));
  const canExport = effectivePlan === "pro";

  return (
    <div className="space-y-6">
      <PageHeader title="Cartella clinica" description="Timeline unificata: salute, log, documenti (task opzionali)." />

      {!activePetId ? (
        <EmptyState
          title="Seleziona un pet"
          description="Scegli un profilo per vedere la cartella clinica."
          action={
            <Link to="/app/pets" className="inline-flex items-center justify-center rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900">
              Vai al profilo pet
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
              <CardDescription>Trova rapidamente un evento, un documento o un log.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <div className="text-xs text-slate-400 mb-1">Cerca</div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="tipo, titolo, note…"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </div>
              <div className="lg:col-span-6 flex flex-wrap gap-2">
                {(
                  [
                    ["health", "Salute"],
                    ["log", "Log"],
                    ["doc", "Documenti"],
                    ["task", "Task"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                    className={
                      show[k]
                        ? "rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs"
                        : "rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>Più recenti prima</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                <button
                  disabled={!canExport}
                  onClick={() => {
                    const payload = {
                      petId: activePetId,
                      exportedAt: Date.now(),
                      health,
                      logs,
                      documents: docs,
                      tasks,
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `lifepet-records-${activePetId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className={
                    canExport
                      ? "rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300"
                      : "rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-400"
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Esporta
                  </span>
                </button>
                {billing?.betaProEnabled ? <div className="text-xs text-emerald-200">Beta</div> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
            {timeline.length === 0 ? (
              <EmptyState title="Nessun elemento" description="Prova a cambiare filtri o ricerca." />
            ) : (
              <div className="space-y-2">
                {timeline.map((it) => {
                  const Icon = iconFor(it.kind);
                  return (
                    <div key={`${it.kind}:${it.id}`} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Icon className={it.kind === "health" ? "w-4 h-4 text-emerald-200" : "w-4 h-4 text-slate-300"} />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{it.title}</div>
                            <div className="text-xs text-slate-500">{it.subtitle ?? it.kind}</div>
                            {it.note ? <div className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{it.note}</div> : null}
                            {it.attachment ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const url = await getPetDocumentDownloadUrl(it.attachment!.storagePath);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  } catch {
                                    return;
                                  }
                                }}
                                className="mt-2 rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                              >
                                Apri: {it.attachment.name}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-xs text-slate-500">Questa vista aiuta a ricostruire storia clinica e routine. Non sostituisce il veterinario.</div>
            </CardContent>
          </Card>
        </>
      )}
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <HeartPulse className="w-4 h-4" />
        Suggerimento: usa Salute per gli eventi e Documenti per i file.
      </div>
    </div>
  );
}

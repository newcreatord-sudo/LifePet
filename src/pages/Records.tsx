import { useEffect, useMemo, useState } from "react";
import { Crown, FileText, HeartPulse, ListTodo, NotebookPen, Pencil, Search, ShieldPlus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePetStore } from "@/stores/petStore";
import { subscribeRecentHealthEvents } from "@/data/health";
import { deleteLog, subscribeLogsRange, updateLog } from "@/data/logs";
import { subscribeDocuments, getPetDocumentDownloadUrl } from "@/data/documents";
import { subscribeTasks } from "@/data/tasks";
import type { HealthEvent, PetDocument, PetLog, PetTask } from "@/types";
import { getBillingStatus, type BillingStatus } from "@/data/billing";
import { exportPetData } from "@/data/export";
import { createRecordsShare } from "@/data/recordsShare";
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
  valueText?: string;
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

function logValueText(l: PetLog) {
  const v = l.value;
  if (!v) return null;
  if (typeof v.amount !== "number" || !Number.isFinite(v.amount)) return null;
  if (!v.unit) return String(v.amount);
  return `${v.amount} ${v.unit}`;
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
  const [logTypeFilter, setLogTypeFilter] = useState<Record<string, boolean>>({
    symptom: true,
    weight: true,
    med: true,
    vet: true,
    food: true,
    water: true,
    activity: true,
  });
  const [rangeDays, setRangeDays] = useState("180");
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  const range = useMemo(() => {
    const toMs = Date.now();
    const days = Number(rangeDays);
    const fromMs = toMs - (Number.isFinite(days) && days > 0 ? days : 180) * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
  }, [rangeDays]);

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
      if (!logTypeFilter[l.type]) continue;
      items.push({
        kind: "log",
        id: l.id,
        ts: l.occurredAt,
        title: labelForLogType(l.type),
        subtitle: logValueText(l) ?? new Date(l.occurredAt).toLocaleString(),
        note: l.note,
        valueText: logValueText(l) ?? undefined,
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
      .filter((it) => it.ts >= range.fromMs && it.ts <= range.toMs)
      .filter((it) => {
        if (!needle) return true;
        return `${it.title} ${it.subtitle ?? ""} ${it.note ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200);
  }, [docs, health, logTypeFilter, logs, q, range.fromMs, range.toMs, show, tasks]);

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
            <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center justify-center">
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
                <div className="text-xs text-slate-600 mb-1">Cerca</div>
                <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2">
                  <Search className="w-4 h-4 text-slate-600" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="tipo, titolo, note…"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </div>
              <div className="lg:col-span-3">
                <div className="text-xs text-slate-600 mb-1">Periodo</div>
                <select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="lp-select">
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="180">Ultimi 180 giorni</option>
                  <option value="365">Ultimo anno</option>
                </select>
              </div>
              <div className="lg:col-span-3 flex flex-wrap gap-2">
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
                        ? "rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-xs"
                        : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {show.log ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["symptom", "Sintomi"],
                    ["weight", "Peso"],
                    ["food", "Cibo"],
                    ["water", "Acqua"],
                    ["activity", "Attività"],
                    ["med", "Farmaci"],
                    ["vet", "Veterinario"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setLogTypeFilter((s) => ({ ...s, [k]: !s[k] }))}
                    className={
                      logTypeFilter[k]
                        ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-xs text-fuchsia-800"
                        : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
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
                    (async () => {
                      const payload = await exportPetData(activePetId, range);
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `lifepet-records-${activePetId}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    })();
                  }}
                  className={
                    canExport
                      ? "lp-btn-primary"
                      : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-400"
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Esporta
                  </span>
                </button>

                <button
                  disabled={!canExport}
                  onClick={async () => {
                    if (!user || user.isDemo) return;
                    const hoursRaw = prompt("Validità link (ore):", "24");
                    if (hoursRaw === null) return;
                    const hours = Number(String(hoursRaw).replace(",", "."));
                    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) return;
                    const expiresAt = Date.now() + Math.round(hours * 60 * 60 * 1000);

                    const token = await createRecordsShare({
                      ownerId: user.uid,
                      petId: activePetId,
                      createdAt: Date.now(),
                      expiresAt,
                      range,
                      items: timeline.map((t) => ({ kind: t.kind, ts: t.ts, title: t.title, subtitle: t.subtitle, note: t.note })),
                    });
                    const url = `${window.location.origin}/share/${token}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      alert("Link copiato negli appunti");
                    } catch {
                      prompt("Copia il link:", url);
                    }
                  }}
                  className={
                    canExport ? "lp-btn-secondary" : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-400"
                  }
                >
                  Condividi
                </button>
                {billing?.betaProEnabled ? <div className="text-xs text-fuchsia-700">Beta</div> : null}
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
                    <div key={`${it.kind}:${it.id}`} className="lp-panel px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Icon className={it.kind === "health" ? "w-4 h-4 text-fuchsia-700" : "w-4 h-4 text-slate-700"} />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{it.title}</div>
                            <div className="text-xs text-slate-600">{it.subtitle ?? it.kind}</div>
                            {it.note ? <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{it.note}</div> : null}
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
                                className="mt-2 lp-btn-icon"
                              >
                                Apri: {it.attachment.name}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-600 whitespace-nowrap">{new Date(it.ts).toLocaleString()}</div>
                          {activePetId && it.kind === "log" ? (
                            <>
                              <button
                                className="lp-btn-icon"
                                onClick={async () => {
                                  const l = logs.find((x) => x.id === it.id);
                                  if (!l) return;
                                  const nextNote = (prompt("Nota:", l.note ?? "") ?? "").trim();
                                  let nextValue = l.value;
                                  if (l.type === "water" || l.type === "food" || l.type === "activity" || l.type === "weight") {
                                    const current = typeof l.value?.amount === "number" ? l.value.amount : "";
                                    const raw = prompt("Valore numerico (lascia vuoto per rimuovere):", String(current));
                                    if (raw === null) return;
                                    const v = String(raw).trim();
                                    if (!v) {
                                      nextValue = undefined;
                                    } else {
                                      const n = Number(v.replace(",", "."));
                                      if (Number.isFinite(n) && n > 0) {
                                        const unit =
                                          l.type === "water" ? "ml" : l.type === "food" ? "g" : l.type === "activity" ? "min" : "kg";
                                        nextValue = { amount: n, unit };
                                      }
                                    }
                                  }
                                  await updateLog(activePetId, l.id, { note: nextNote || undefined, value: nextValue });
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                className="lp-btn-icon"
                                onClick={async () => {
                                  if (!confirm("Eliminare questo log?")) return;
                                  await deleteLog(activePetId, it.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-xs text-slate-600">Questa vista aiuta a ricostruire storia clinica e routine. Non sostituisce il veterinario.</div>
            </CardContent>
          </Card>
        </>
      )}
      <div className="text-xs text-slate-600 flex items-center gap-2">
        <HeartPulse className="w-4 h-4" />
        Suggerimento: usa Salute per gli eventi e Documenti per i file.
      </div>
    </div>
  );
}

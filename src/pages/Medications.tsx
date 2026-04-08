import { useEffect, useMemo, useState } from "react";
import { Pencil, Pill, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createMedication, deleteMedication, setMedicationEnabled, subscribeMedications, updateMedication } from "@/data/medications";
import { aiChat } from "@/data/ai";
import { aiUserMessage } from "@/lib/aiErrors";
import { subscribeUserProfile } from "@/data/users";
import type { PetMedication } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type ParsedMedication = {
  name: string;
  dose?: string;
  unit?: string;
  route?: string;
  times: string[];
  days?: number;
  notes?: string;
};

function tryParseJsonBlock(raw: string) {
  const s = raw.trim();
  const fenced = s.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : s;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeTime(t: string) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function Medications() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [items, setItems] = useState<PetMedication[]>([]);

  const [aiAllowed, setAiAllowed] = useState(true);
  const [rxText, setRxText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMedication[] | null>(null);
  const [creatingFromAi, setCreatingFromAi] = useState(false);

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("mg");
  const [route, setRoute] = useState("oral");
  const [times, setTimes] = useState("08:00, 20:00");
  const [days, setDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDose, setEditDose] = useState("");
  const [editUnit, setEditUnit] = useState("mg");
  const [editRoute, setEditRoute] = useState("oral");
  const [editTimes, setEditTimes] = useState("");
  const [editDays, setEditDays] = useState("7");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeMedications(activePetId, setItems);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!user || user.isDemo) {
      setAiAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setAiAllowed(p?.preferences?.aiEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  const active = useMemo(() => items.filter((m) => m.enabled), [items]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const n = name.trim();
    if (!n) return;
    const t = times
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (t.length === 0) return;
    const d = Number(days);
    const startAt = Date.now();
    const endAt = Number.isFinite(d) && d > 0 ? startAt + d * 24 * 60 * 60 * 1000 : undefined;

    setCreating(true);
    try {
      await createMedication(activePetId, {
        petId: activePetId,
        name: n,
        dose: dose.trim() || undefined,
        unit: unit.trim() || undefined,
        route: route.trim() || undefined,
        times: t,
        startAt,
        endAt,
        enabled: true,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setName("");
      setDose("");
      setNotes("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Terapie" description="Farmaci strutturati con promemoria automatici (task)." />

      <Card>
        <CardHeader>
          <CardTitle>Scansione ricetta (testo)</CardTitle>
          <CardDescription>Incolla la prescrizione e crea le terapie automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per usare la scansione ricetta." />
          ) : !aiAllowed ? (
            <EmptyState title="AI disattivata" description="Riattivala in Impostazioni → Preferenze per usare la scansione ricetta." />
          ) : (
            <>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Testo ricetta</div>
                <textarea
                  value={rxText}
                  onChange={(e) => setRxText(e.target.value)}
                  rows={5}
                  placeholder="Es. Amoxicillina 50 mg, 1 compressa alle 08:00 e 20:00 per 7 giorni…"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!user || user.isDemo || aiLoading}
                  className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60 inline-flex items-center gap-2"
                  onClick={async () => {
                    if (!activePetId) return;
                    const text = rxText.trim();
                    if (!text) return;
                    setAiLoading(true);
                    setAiRaw(null);
                    setParsed(null);
                    try {
                      const prompt = [
                        "Sei un assistente LifePet che estrae terapie da una prescrizione.",
                        "Restituisci SOLO JSON (nessun testo extra).",
                        "Schema: array di oggetti {name, dose?, unit?, route?, times:[HH:MM], days?, notes?}.",
                        "Regole: times deve essere HH:MM (24h). Se il testo è ambiguo, inserisci notes con dubbi ma prova a compilare.",
                        "Non dare diagnosi, non suggerire farmaci. Estrai solo ciò che è già nella prescrizione.",
                        "Prescrizione:",
                        text,
                      ].join("\n");
                      const res = await aiChat(activePetId, null, prompt);
                      setAiRaw(res.answer);
                      const data = tryParseJsonBlock(res.answer);
                      const list = Array.isArray(data) ? data : null;
                      if (!list) throw new Error("AI parse failed");

                      const asRecord = (v: unknown): Record<string, unknown> | null =>
                        typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

                      const normalized: ParsedMedication[] = list
                        .map((x) => {
                          const r = asRecord(x);
                          const timesRaw = r && Array.isArray(r.times) ? r.times : [];
                          return {
                            name: String(r?.name ?? "").trim(),
                            dose: typeof r?.dose === "string" ? r.dose.trim() : undefined,
                            unit: typeof r?.unit === "string" ? r.unit.trim() : undefined,
                            route: typeof r?.route === "string" ? r.route.trim() : undefined,
                            times: timesRaw.map((t) => String(t)),
                            days: typeof r?.days === "number" ? r.days : undefined,
                            notes: typeof r?.notes === "string" ? r.notes.trim() : undefined,
                          };
                        })
                        .filter((m) => m.name)
                        .map((m) => ({
                          ...m,
                          times: Array.from(new Set(m.times.map((t) => normalizeTime(t)).filter((t): t is string => Boolean(t))))
                            .slice(0, 6),
                          days: typeof m.days === "number" && Number.isFinite(m.days) && m.days > 0 ? Math.round(m.days) : undefined,
                        }))
                        .filter((m) => m.times.length > 0);

                      if (normalized.length === 0) throw new Error("AI parse empty");
                      setParsed(normalized);
                    } catch (e) {
                      setAiRaw(aiUserMessage(e));
                      setParsed(null);
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? "Analisi…" : "Analizza"}
                </button>

                {parsed && parsed.length ? (
                  <button
                    type="button"
                    disabled={!user || !activePetId || creatingFromAi}
                    className="rounded-xl border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900 disabled:opacity-60"
                    onClick={async () => {
                      if (!user || !activePetId) return;
                      setCreatingFromAi(true);
                      try {
                        for (const m of parsed) {
                          const startAt = Date.now();
                          const endAt = typeof m.days === "number" ? startAt + m.days * 24 * 60 * 60 * 1000 : undefined;
                          await createMedication(activePetId, {
                            petId: activePetId,
                            name: m.name,
                            dose: m.dose,
                            unit: m.unit,
                            route: m.route,
                            times: m.times,
                            startAt,
                            endAt,
                            enabled: true,
                            notes: m.notes,
                            createdAt: Date.now(),
                            createdBy: user.uid,
                          });
                        }
                        setRxText("");
                        setParsed(null);
                      } finally {
                        setCreatingFromAi(false);
                      }
                    }}
                  >
                    {creatingFromAi ? "Creazione…" : "Crea terapie"}
                  </button>
                ) : null}
              </div>

              {parsed && parsed.length ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Anteprima</div>
                  <div className="mt-2 space-y-2">
                    {parsed.map((m, idx) => (
                      <div key={`${m.name}-${idx}`} className="text-sm text-slate-200">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-slate-500">
                          {(m.dose || m.unit) ? `${m.dose ?? ""} ${m.unit ?? ""}`.trim() : "—"}
                          {m.route ? ` · ${m.route}` : ""}
                          {m.times.length ? ` · ${m.times.join(", ")}` : ""}
                          {typeof m.days === "number" ? ` · ${m.days} giorni` : ""}
                        </div>
                        {m.notes ? <div className="text-xs text-slate-400 mt-0.5">{m.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {aiRaw && !parsed ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300 whitespace-pre-wrap">{aiRaw}</div>
              ) : null}

              <div className="text-xs text-slate-500">AI informativa: verifica sempre prescrizione e orari con il veterinario.</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crea terapia</CardTitle>
          <CardDescription>Definisci orari e durata: genererà task per i prossimi 7 giorni.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per creare una terapia." />
        ) : (
          <form onSubmit={onCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <label className="lg:col-span-4 block">
              <div className="text-xs text-slate-400 mb-1">Nome</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Dose</div>
              <input value={dose} onChange={(e) => setDose(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Unità</div>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Via</div>
              <input value={route} onChange={(e) => setRoute(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Giorni</div>
              <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>

            <label className="lg:col-span-6 block">
              <div className="text-xs text-slate-400 mb-1">Orari (separati da virgola)</div>
              <input value={times} onChange={(e) => setTimes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-5 block">
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <button
              disabled={creating}
              type="submit"
              className="lg:col-span-1 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
            >
              {creating ? "…" : <Pill className="w-4 h-4" />}
            </button>
            <div className="lg:col-span-12 text-xs text-slate-500">Le terapie generano task per i prossimi 7 giorni (senza duplicati).</div>
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terapie</CardTitle>
          <CardDescription>{active.length} attive</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le terapie." />
        ) : items.length === 0 ? (
          <EmptyState title="Nessuna terapia" description="Crea la prima terapia per attivare promemoria automatici." />
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                {editingId === m.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activePetId) return;
                      const n = editName.trim();
                      const t = editTimes
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean);
                      if (!n || t.length === 0) return;
                      const d = Number(editDays);
                      const startAt = m.startAt ?? Date.now();
                      const endAt = Number.isFinite(d) && d > 0 ? startAt + d * 24 * 60 * 60 * 1000 : undefined;
                      setSavingEdit(true);
                      try {
                        await updateMedication(activePetId, m, {
                          name: n,
                          dose: editDose.trim() || undefined,
                          unit: editUnit.trim() || undefined,
                          route: editRoute.trim() || undefined,
                          times: t,
                          endAt,
                          notes: editNotes.trim() || undefined,
                        });
                        setEditingId(null);
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
                  >
                    <label className="lg:col-span-4 block">
                      <div className="text-xs text-slate-400 mb-1">Nome</div>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Dose</div>
                      <input value={editDose} onChange={(e) => setEditDose(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Unità</div>
                      <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Via</div>
                      <input value={editRoute} onChange={(e) => setEditRoute(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Giorni</div>
                      <input value={editDays} onChange={(e) => setEditDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-7 block">
                      <div className="text-xs text-slate-400 mb-1">Orari</div>
                      <input value={editTimes} onChange={(e) => setEditTimes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-5 block">
                      <div className="text-xs text-slate-400 mb-1">Note</div>
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <div className="lg:col-span-12 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                        Annulla
                      </button>
                      <button disabled={savingEdit} type="submit" className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60">
                        {savingEdit ? "…" : "Salva"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-slate-500">
                        {(m.dose || m.unit) ? `${m.dose ?? ""} ${m.unit ?? ""}`.trim() : "—"}
                        {m.route ? ` · ${m.route}` : ""}
                        {m.times?.length ? ` · ${m.times.join(", ")}` : ""}
                      </div>
                      {m.notes ? <div className="text-sm text-slate-300 mt-1">{m.notes}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditName(m.name);
                          setEditDose(m.dose ?? "");
                          setEditUnit(m.unit ?? "mg");
                          setEditRoute(m.route ?? "oral");
                          setEditTimes(m.times?.join(", ") ?? "");
                          setEditDays("7");
                          setEditNotes(m.notes ?? "");
                        }}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          if (!confirm("Eliminare questa terapia?")) return;
                          setBusyId(m.id);
                          try {
                            await deleteMedication(activePetId, m.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === m.id}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => activePetId && setMedicationEnabled(activePetId, m.id, !m.enabled)}
                        className={
                          m.enabled
                            ? "rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300"
                            : "rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                        }
                      >
                        {m.enabled ? "Attiva" : "Disattiva"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

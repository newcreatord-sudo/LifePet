import { useEffect, useMemo, useState } from "react";
import { Pencil, Syringe, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createVaccine, deleteVaccine, markVaccineGiven, subscribeVaccines, updateVaccine } from "@/data/vaccines";
import type { PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Vaccines() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [items, setItems] = useState<PetVaccine[]>([]);

  const [name, setName] = useState("");
  const [intervalDays, setIntervalDays] = useState("365");
  const [reminderDays, setReminderDays] = useState("14");
  const [lastAt, setLastAt] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIntervalDays, setEditIntervalDays] = useState("365");
  const [editReminderDays, setEditReminderDays] = useState("14");
  const [editLastAt, setEditLastAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeVaccines(activePetId, setItems);
    return () => unsub();
  }, [activePetId]);

  const next = useMemo(() => items[0] ?? null, [items]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const n = name.trim();
    if (!n) return;
    const intDays = Number(intervalDays);
    const remDays = Number(reminderDays);
    const parsedLast = lastAt ? new Date(lastAt).getTime() : null;
    setCreating(true);
    try {
      await createVaccine(activePetId, {
        petId: activePetId,
        name: n,
        lastAt: parsedLast && Number.isFinite(parsedLast) ? parsedLast : null,
        intervalDays: Number.isFinite(intDays) && intDays > 0 ? intDays : 365,
        reminderDaysBefore: Number.isFinite(remDays) && remDays >= 0 ? remDays : 14,
        notes: notes.trim() || undefined,
        createdBy: user.uid,
        createdAt: Date.now(),
      });
      setName("");
      setNotes("");
      setLastAt("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vaccini" description="Scadenze, richiami e promemoria: prevenzione senza pensieri." />

      {next ? (
        <Card>
          <CardHeader>
            <CardTitle>Prossima scadenza</CardTitle>
            <CardDescription>Il richiamo più vicino</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-300">{next.name} · {new Date(next.nextDueAt).toLocaleDateString()}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi vaccino</CardTitle>
          <CardDescription>Imposta intervallo e promemoria.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per gestire i vaccini." />
        ) : (
          <form onSubmit={onCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <label className="lg:col-span-4 block">
              <div className="text-xs text-slate-400 mb-1">Nome</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-400 mb-1">Ultima dose (opzionale)</div>
              <input value={lastAt} onChange={(e) => setLastAt(e.target.value)} type="date" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Intervallo (giorni)</div>
              <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Promemoria (giorni)</div>
              <input value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
            <button
              disabled={creating}
              type="submit"
              className="lg:col-span-1 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
            >
              {creating ? "…" : <Syringe className="w-4 h-4" />}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
            </label>
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendario vaccini</CardTitle>
          <CardDescription>Modifica, registra somministrazione, o elimina.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere la schedulazione." />
        ) : items.length === 0 ? (
          <EmptyState title="Nessun vaccino" description="Aggiungi il primo vaccino per iniziare." />
        ) : (
          <div className="space-y-2">
            {items.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                {editingId === v.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activePetId) return;
                      const intDays = Number(editIntervalDays);
                      const remDays = Number(editReminderDays);
                      const parsedLast = editLastAt ? new Date(editLastAt).getTime() : null;
                      setSavingEdit(true);
                      try {
                        await updateVaccine(activePetId, v, {
                          name: editName.trim(),
                          notes: editNotes.trim() || undefined,
                          intervalDays: Number.isFinite(intDays) && intDays > 0 ? intDays : v.intervalDays,
                          reminderDaysBefore: Number.isFinite(remDays) && remDays >= 0 ? remDays : v.reminderDaysBefore,
                          lastAt: parsedLast && Number.isFinite(parsedLast) ? parsedLast : undefined,
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
                    <label className="lg:col-span-3 block">
                      <div className="text-xs text-slate-400 mb-1">Ultima dose</div>
                      <input value={editLastAt} onChange={(e) => setEditLastAt(e.target.value)} type="date" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Intervallo (giorni)</div>
                      <input value={editIntervalDays} onChange={(e) => setEditIntervalDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs text-slate-400 mb-1">Promemoria (giorni)</div>
                      <input value={editReminderDays} onChange={(e) => setEditReminderDays(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <div className="lg:col-span-1 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                        Annulla
                      </button>
                      <button disabled={savingEdit} type="submit" className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60">
                        {savingEdit ? "…" : "Salva"}
                      </button>
                    </div>
                    <label className="lg:col-span-12 block">
                      <div className="text-xs text-slate-400 mb-1">Note</div>
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{v.name}</div>
                      <div className="text-xs text-slate-500">
                        Prossimo: {new Date(v.nextDueAt).toLocaleDateString()}
                        {v.lastAt ? ` · Ultimo: ${new Date(v.lastAt).toLocaleDateString()}` : ""}
                        {` · Ogni ${v.intervalDays}g`}
                        {` · Promemoria ${v.reminderDaysBefore}g`}
                      </div>
                      {v.notes ? <div className="text-sm text-slate-300 mt-1">{v.notes}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(v.id);
                          setEditName(v.name);
                          setEditIntervalDays(String(v.intervalDays));
                          setEditReminderDays(String(v.reminderDaysBefore));
                          setEditLastAt(v.lastAt ? new Date(v.lastAt).toISOString().slice(0, 10) : "");
                          setEditNotes(v.notes ?? "");
                        }}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          if (!confirm("Eliminare questo vaccino?")) return;
                          setBusyId(v.id);
                          try {
                            await deleteVaccine(activePetId, v.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === v.id}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          setBusyId(v.id);
                          try {
                            await markVaccineGiven(activePetId, v, Date.now());
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === v.id}
                        className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60"
                      >
                        Somministrato oggi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">Creazione/aggiornamento vaccini crea anche eventi in Agenda.</div>
        </CardContent>
      </Card>
    </div>
  );
}

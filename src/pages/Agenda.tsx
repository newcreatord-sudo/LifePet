import { useEffect, useMemo, useState } from "react";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createAgendaEvent, deleteAgendaEvent, subscribeAgendaRange, updateAgendaEvent } from "@/data/agenda";
import type { AgendaEvent } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Agenda() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [events, setEvents] = useState<AgendaEvent[]>([]);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [kind, setKind] = useState<AgendaEvent["kind"]>("vet");
  const [reminder, setReminder] = useState("60");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editKind, setEditKind] = useState<AgendaEvent["kind"]>("vet");
  const [editReminder, setEditReminder] = useState("60");
  const [savingEdit, setSavingEdit] = useState(false);

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeAgendaRange(activePetId, range.fromMs, range.toMs, setEvents);
    return () => unsub();
  }, [activePetId, range.fromMs, range.toMs]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
    if (!Number.isFinite(dueMs)) return;
    setSaving(true);
    try {
      const reminderMinutesBefore = Math.max(0, Number(reminder) || 0);
      await createAgendaEvent(activePetId, {
        petId: activePetId,
        title: title.trim(),
        dueAt: dueMs,
        kind,
        reminderMinutesBefore,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setTitle("");
      setDueAt("");
      setKind("vet");
      setReminder("60");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" description="Appuntamenti, promemoria e cura quotidiana, tutti in un posto." />

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi evento</CardTitle>
          <CardDescription>Visite, toelettatura, training e promemoria.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per aggiungere eventi." />
        ) : (
          <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_180px_140px] gap-3 items-end">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Titolo</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Data e ora</div>
              <input
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                type="datetime-local"
                required
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Tipo</div>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as AgendaEvent["kind"])}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="vet">Veterinario</option>
                <option value="grooming">Toelettatura</option>
                <option value="training">Training</option>
                <option value="cleaning">Pulizia</option>
                <option value="other">Altro</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Promemoria</div>
              <div className="relative">
                <Bell className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                  className="w-full pl-9 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="0">Nessuno</option>
                  <option value="15">15 min prima</option>
                  <option value="60">1 ora prima</option>
                  <option value="180">3 ore prima</option>
                  <option value="1440">1 giorno prima</option>
                </select>
              </div>
            </label>
            <button
              disabled={saving}
              className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
              type="submit"
            >
              {saving ? "…" : "Aggiungi"}
            </button>
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prossimi 30 giorni</CardTitle>
          <CardDescription>Una vista rapida per organizzarti bene.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere l’agenda." />
        ) : events.length === 0 ? (
          <EmptyState title="Nessun evento" description="Aggiungi un promemoria o un appuntamento." />
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                {editingId === ev.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activePetId) return;
                      const dueMs = editDueAt ? new Date(editDueAt).getTime() : NaN;
                      if (!Number.isFinite(dueMs)) return;
                      setSavingEdit(true);
                      try {
                        await updateAgendaEvent(activePetId, ev.id, {
                          title: editTitle.trim(),
                          dueAt: dueMs,
                          kind: editKind,
                          reminderMinutesBefore: Math.max(0, Number(editReminder) || 0),
                        });
                        setEditingId(null);
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-[1fr_220px_200px_1fr] gap-3 items-end"
                  >
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Titolo</div>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Data e ora</div>
                      <input value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} type="datetime-local" className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Tipo</div>
                      <select value={editKind} onChange={(e) => setEditKind(e.target.value as AgendaEvent["kind"])} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm">
                        <option value="vet">Veterinario</option>
                        <option value="grooming">Toelettatura</option>
                        <option value="training">Training</option>
                        <option value="cleaning">Pulizia</option>
                        <option value="other">Altro</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Promemoria</div>
                      <select value={editReminder} onChange={(e) => setEditReminder(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm">
                        <option value="0">Nessuno</option>
                        <option value="15">15 min</option>
                        <option value="60">1 ora</option>
                        <option value="180">3 ore</option>
                        <option value="1440">1 giorno</option>
                      </select>
                    </label>
                    <div className="md:col-span-4 flex items-center gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                        Annulla
                      </button>
                      <button disabled={savingEdit} type="submit" className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300 disabled:opacity-60">
                        {savingEdit ? "Salvataggio…" : "Salva"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-xs text-slate-500">{ev.kind}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(ev.dueAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(ev.id);
                          setEditTitle(ev.title);
                          setEditDueAt(new Date(ev.dueAt).toISOString().slice(0, 16));
                          setEditKind(ev.kind);
                          setEditReminder(String(ev.reminderMinutesBefore ?? 0));
                        }}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          if (!confirm("Eliminare questo evento?")) return;
                          await deleteAgendaEvent(activePetId, ev.id);
                        }}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        <Trash2 className="w-4 h-4" />
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Syringe, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { createVaccine, deleteVaccine, markVaccineGiven, subscribeVaccines, updateVaccine } from "@/data/vaccines";
import type { PetVaccine } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/confirm";
import { deleteField } from "firebase/firestore";
import { seedStarterKit } from "@/lib/starterKit";

export default function Vaccines() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();
  const [items, setItems] = useState<PetVaccine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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

  const nameRef = useRef<HTMLInputElement | null>(null);
  const [seedingStarter, setSeedingStarter] = useState(false);

  function focusAddVaccine() {
    nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameRef.current?.focus();
  }

  async function onSeedStarter() {
    if (!user || !activePetId) return;
    if (seedingStarter) return;
    setSeedingStarter(true);
    try {
      const res = await seedStarterKit(activePetId, user.uid);
      pushToast({
        type: res === "already" ? "info" : "success",
        title: "Setup rapido",
        message: res === "already" ? "Già applicato per questo pet." : "Creati dati iniziali per popolare le sezioni.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "Setup rapido", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setSeedingStarter(false);
    }
  }

  useEffect(() => {
    if (!activePetId) {
      setItems([]);
      setLoaded(false);
      setInlineError(null);
      setSelected({});
      return;
    }
    setLoaded(false);
    setInlineError(null);
    const unsub = subscribeVaccines(activePetId, (next) => {
      setItems(next);
      setLoaded(true);
    });
    return () => unsub();
  }, [activePetId]);

  const next = useMemo(() => items[0] ?? null, [items]);
  const selectedIds = useMemo(() => items.filter((v) => selected[v.id]).map((v) => v.id), [items, selected]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) {
      pushToast({ type: "error", title: "Seleziona un pet", message: "Accedi e scegli un profilo prima di aggiungere un vaccino." });
      return;
    }
    const n = name.trim();
    if (!n) {
      pushToast({ type: "error", title: "Nome obbligatorio", message: "Inserisci il nome del vaccino." });
      return;
    }
    const intDays = Number(intervalDays);
    const remDays = Number(reminderDays);
    const parsedLast = lastAt ? new Date(lastAt).getTime() : null;
    setCreating(true);
    setInlineError(null);
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
      pushToast({ type: "success", title: "Vaccino aggiunto", message: "Salvato in calendario." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Creazione vaccino fallita");
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione vaccino fallita" });
    } finally {
      setCreating(false);
    }
  }

  async function batchDelete() {
    if (!activePetId || !selectedIds.length) return;
    const ok = await confirmDialog({
      title: "Elimina vaccini",
      description: `Vuoi eliminare ${selectedIds.length} vaccini selezionati?`,
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId("__batch__");
    setInlineError(null);
    try {
      for (const id of selectedIds) {
        await deleteVaccine(activePetId, id);
      }
      setSelected({});
      pushToast({ type: "success", title: "Vaccini", message: "Vaccini eliminati." });
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Eliminazione fallita");
      pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Eliminazione fallita" });
    } finally {
      setBusyId(null);
    }
  }

  async function batchMarkGivenToday() {
    if (!activePetId || !selectedIds.length) return;
    setBusyId("__batch__");
    setInlineError(null);
    try {
      const now = Date.now();
      for (const id of selectedIds) {
        const v = items.find((x) => x.id === id);
        if (!v) continue;
        await markVaccineGiven(activePetId, v, now);
      }
      setSelected({});
      pushToast({ type: "success", title: "Vaccini", message: "Somministrazioni registrate." });
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Operazione fallita");
      pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaccini"
        description="Scadenze, richiami e promemoria: prevenzione senza pensieri."
        imagePrompt="minimal clean illustration, vaccine card and calendar for pet, syringe icon, airy background, accent color, premium, no text, no watermark"
        imageAlt="Vaccini"
      />

      {next ? (
        <Card>
          <CardHeader>
            <CardTitle>Prossima scadenza</CardTitle>
            <CardDescription>Il richiamo più vicino</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{next.name} · {new Date(next.nextDueAt).toLocaleDateString()}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi vaccino</CardTitle>
          <CardDescription>Imposta intervallo e promemoria.</CardDescription>
        </CardHeader>
        <CardContent>
        {inlineError ? (
          <div className="mb-3">
            <Alert variant="danger" title="Errore">{inlineError}</Alert>
          </div>
        ) : null}
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per gestire i vaccini." />
        ) : (
          <form onSubmit={onCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <label className="lg:col-span-4 block">
              <div className="text-xs lp-muted mb-1">Nome</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="lp-input" ref={nameRef} />
            </label>
            <label className="lg:col-span-3 block">
              <div className="text-xs lp-muted mb-1">Ultima dose (opzionale)</div>
              <input value={lastAt} onChange={(e) => setLastAt(e.target.value)} type="date" className="lp-input" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs lp-muted mb-1">Intervallo (giorni)</div>
              <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} inputMode="numeric" className="lp-input" />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs lp-muted mb-1">Promemoria (giorni)</div>
              <input value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} inputMode="numeric" className="lp-input" />
            </label>
            <button
              disabled={creating}
              type="submit"
              className="lg:col-span-1 lp-btn-primary inline-flex items-center justify-center"
            >
              {creating ? "…" : <Syringe className="w-4 h-4" />}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs lp-muted mb-1">Note</div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="lp-input" />
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
        ) : !loaded ? (
          <div className="grid gap-2">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nessun vaccino"
            description="Aggiungi il primo vaccino per iniziare."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="lp-btn-primary" onClick={focusAddVaccine}>
                  Aggiungi vaccino
                </button>
                {user ? (
                  <button type="button" className="lp-btn-secondary" onClick={() => void onSeedStarter()} disabled={seedingStarter}>
                    {seedingStarter ? "Creo…" : "Setup rapido"}
                  </button>
                ) : null}
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs lp-muted">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === items.length}
                  onChange={(e) => {
                    const nextSel = e.target.checked ? Object.fromEntries(items.map((x) => [x.id, true])) : {};
                    setSelected(nextSel);
                  }}
                />
                Seleziona tutto
              </label>
              {selectedIds.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => setSelected({})} disabled={busyId === "__batch__"}>
                    Deseleziona
                  </button>
                  <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => void batchDelete()} disabled={busyId === "__batch__"}>
                    Elimina ({selectedIds.length})
                  </button>
                  <button type="button" className="lp-btn-primary px-3 py-2 text-xs" onClick={() => void batchMarkGivenToday()} disabled={busyId === "__batch__"}>
                    Somministrato oggi ({selectedIds.length})
                  </button>
                </div>
              ) : (
                <div className="text-xs lp-muted">{items.length} vaccini</div>
              )}
            </div>
            {items.map((v) => (
              <div key={v.id} className="lp-panel px-3 py-2">
                {editingId === v.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activePetId) return;
                      const nn = editName.trim();
                      if (!nn) {
                        pushToast({ type: "error", title: "Nome obbligatorio", message: "Inserisci il nome del vaccino." });
                        return;
                      }
                      const intDays = Number(editIntervalDays);
                      const remDays = Number(editReminderDays);
                      const parsedLast = editLastAt ? new Date(editLastAt).getTime() : null;
                      setSavingEdit(true);
                      try {
                        await updateVaccine(activePetId, v, {
                          name: nn,
                          notes: editNotes.trim() ? editNotes.trim() : deleteField(),
                          intervalDays: Number.isFinite(intDays) && intDays > 0 ? intDays : v.intervalDays,
                          reminderDaysBefore: Number.isFinite(remDays) && remDays >= 0 ? remDays : v.reminderDaysBefore,
                          lastAt: parsedLast && Number.isFinite(parsedLast) ? parsedLast : deleteField(),
                        });
                        setEditingId(null);
                        pushToast({ type: "success", title: "Vaccino aggiornato", message: "Modifiche salvate." });
                      } catch (err) {
                        setInlineError(err instanceof Error ? err.message : "Salvataggio fallito");
                        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio fallito" });
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
                  >
                    <label className="lg:col-span-4 block">
                      <div className="text-xs lp-muted mb-1">Nome</div>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="lp-input" />
                    </label>
                    <label className="lg:col-span-3 block">
                      <div className="text-xs lp-muted mb-1">Ultima dose</div>
                      <input value={editLastAt} onChange={(e) => setEditLastAt(e.target.value)} type="date" className="lp-input" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs lp-muted mb-1">Intervallo (giorni)</div>
                      <input value={editIntervalDays} onChange={(e) => setEditIntervalDays(e.target.value)} inputMode="numeric" className="lp-input" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs lp-muted mb-1">Promemoria (giorni)</div>
                      <input value={editReminderDays} onChange={(e) => setEditReminderDays(e.target.value)} inputMode="numeric" className="lp-input" />
                    </label>
                    <div className="lg:col-span-1 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="lp-btn-secondary">
                        Annulla
                      </button>
                      <button disabled={savingEdit} type="submit" className="lp-btn-primary">
                        {savingEdit ? "…" : "Salva"}
                      </button>
                    </div>
                    <label className="lg:col-span-12 block">
                      <div className="text-xs lp-muted mb-1">Note</div>
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="lp-input" />
                    </label>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(selected[v.id])}
                        onChange={(e) => setSelected((s) => ({ ...s, [v.id]: e.target.checked }))}
                        aria-label="Seleziona vaccino"
                      />
                      <div className="min-w-0">
                      <div className="text-sm font-medium">{v.name}</div>
                      <div className="text-xs lp-muted">
                        Prossimo: {new Date(v.nextDueAt).toLocaleDateString()}
                        {v.lastAt ? ` · Ultimo: ${new Date(v.lastAt).toLocaleDateString()}` : ""}
                        {` · Ogni ${v.intervalDays}g`}
                        {` · Promemoria ${v.reminderDaysBefore}g`}
                      </div>
                      {v.notes ? <div className="text-sm mt-1">{v.notes}</div> : null}
                      </div>
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
                        className="lp-btn-icon"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          const ok = await confirmDialog({
                            title: "Elimina vaccino",
                            description: "Vuoi eliminare questo vaccino?",
                            confirmLabel: "Elimina",
                            variant: "danger",
                          });
                          if (!ok) return;
                          setBusyId(v.id);
                          setInlineError(null);
                          try {
                            await deleteVaccine(activePetId, v.id);
                            pushToast({ type: "success", title: "Vaccino eliminato", message: "Rimosso dal calendario." });
                          } catch (err) {
                            setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === v.id || busyId === "__batch__"}
                        className="lp-btn-icon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activePetId) return;
                          setBusyId(v.id);
                          setInlineError(null);
                          try {
                            await markVaccineGiven(activePetId, v, Date.now());
                            pushToast({ type: "success", title: "Registrato", message: "Somministrazione salvata." });
                          } catch (err) {
                            setInlineError(err instanceof Error ? err.message : "Operazione fallita");
                            pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Operazione fallita" });
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === v.id || busyId === "__batch__"}
                        className="lp-btn-primary"
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
        <div className="mt-3 text-xs lp-muted">Creazione/aggiornamento vaccini crea anche eventi in Agenda.</div>
        </CardContent>
      </Card>
    </div>
  );
}

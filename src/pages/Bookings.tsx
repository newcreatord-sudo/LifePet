import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createBooking, deleteBooking, setBookingStatus, subscribeBookingsHistoryRange, subscribeUpcomingBookings } from "@/data/bookings";
import { createProvider, seedDefaultProviders, subscribeProviders } from "@/data/providers";
import type { Booking, BookingStatus, Provider, ProviderKind } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmDialog } from "@/components/confirm";
import { Alert } from "@/components/ui/Alert";

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

function providerKindLabel(kind: ProviderKind) {
  if (kind === "vet") return "Veterinario";
  if (kind === "nutritionist") return "Nutrizionista";
  if (kind === "groomer") return "Toelettatore";
  return "Sitter";
}

export default function Bookings() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();

  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [items, setItems] = useState<Booking[]>([]);
  const [history, setHistory] = useState<Booking[]>([]);

  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [rangeDays, setRangeDays] = useState("365");
  const [statusFilter, setStatusFilter] = useState<Record<BookingStatus, boolean>>({
    requested: true,
    confirmed: true,
    completed: true,
    cancelled: true,
    no_show: true,
  });

  const [providerKind, setProviderKind] = useState<ProviderKind>("vet");
  const [providerId, setProviderId] = useState<string>("");
  const [manualProviderName, setManualProviderName] = useState("");
  const [manualProviderCity, setManualProviderCity] = useState("");
  const [manualProviderPhone, setManualProviderPhone] = useState("");
  const [manualProviderMeetingUrl, setManualProviderMeetingUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [confirmHours, setConfirmHours] = useState<number>(6);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const createWhenRef = useRef<HTMLInputElement | null>(null);

  function focusCreateBooking() {
    createWhenRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    createWhenRef.current?.focus();
  }

  const [addingProvider, setAddingProvider] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerCity, setProviderCity] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [providerMeetingUrl, setProviderMeetingUrl] = useState("");
  const [providerDescription, setProviderDescription] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);

  useEffect(() => {
    seedDefaultProviders();
    const unsub = subscribeProviders(setProviders);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeUpcomingBookings(activePetId, setItems);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const toMs = Date.now();
    const days = Number(rangeDays);
    const fromMs = toMs - (Number.isFinite(days) && days > 0 ? days : 365) * 24 * 60 * 60 * 1000;
    const unsub = subscribeBookingsHistoryRange(activePetId, fromMs, toMs, 200, setHistory);
    return () => unsub();
  }, [activePetId, rangeDays]);

  const filteredProviders = useMemo(() => providers.filter((p) => p.kind === providerKind), [providerKind, providers]);

  useEffect(() => {
    if (providerId === "__manual__") return;
    if (filteredProviders.length === 0) {
      if (providerId) setProviderId("");
      return;
    }
    if (filteredProviders.some((p) => p.id === providerId)) return;
    setProviderId(filteredProviders[0]?.id ?? "");
  }, [filteredProviders, providerId]);

  const selectedProvider = useMemo(() => {
    if (providerId === "__manual__") return null;
    return providers.find((p) => p.id === providerId) ?? null;
  }, [providerId, providers]);

  const filteredUpcoming = useMemo(() => items.filter((b) => statusFilter[b.status]), [items, statusFilter]);
  const filteredHistory = useMemo(() => history.filter((b) => statusFilter[b.status]), [history, statusFilter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const when = scheduledAt ? new Date(scheduledAt).getTime() : NaN;
    if (!Number.isFinite(when) || when < Date.now() + 5 * 60 * 1000) {
      setError("Scegli una data/orario almeno 5 minuti nel futuro.");
      return;
    }
    if (!Number.isFinite(confirmHours) || confirmHours < 0 || confirmHours > 168) {
      setError("Le ore di conferma devono essere tra 0 e 168.");
      return;
    }
    const confirmBy = when - hoursToMs(confirmHours);

    const provider: Provider | null =
      providerId === "__manual__"
        ? {
            id: `manual_${Date.now()}`,
            kind: providerKind,
            name: manualProviderName.trim(),
            city: manualProviderCity.trim() || undefined,
            phone: manualProviderPhone.trim() || undefined,
            meetingUrl: manualProviderMeetingUrl.trim() || undefined,
            createdBy: user.uid,
            createdAt: Date.now(),
          }
        : selectedProvider;
    if (!provider) return;
    if (providerId === "__manual__" && !provider.name) {
      setError("Inserisci il nome del professionista.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const bookingId = await createBooking(activePetId, user.uid, provider, when, confirmHours > 0 ? confirmBy : null, notes);
      setItems((prev) => {
        const next: Booking = {
          id: bookingId,
          petId: activePetId,
          userId: user.uid,
          providerId: provider.id,
          providerKind: provider.kind,
          providerName: provider.name,
          scheduledAt: when,
          confirmBy: confirmHours > 0 ? confirmBy : undefined,
          status: "requested",
          notes: notes?.trim() || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return [next, ...prev.filter((b) => b.id !== bookingId)];
      });
      setScheduledAt("");
      setNotes("");
      setManualProviderName("");
      setManualProviderCity("");
      setManualProviderPhone("");
      setManualProviderMeetingUrl("");
      setSuccess("Prenotazione creata.");
      pushToast({ type: "success", title: "Prenotazione", message: "Creata." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Creazione prenotazione fallita";
      setError(msg);
      pushToast({ type: "error", title: "Prenotazione", message: msg });
    } finally {
      setCreating(false);
    }
  }

  async function onCreateProvider(e: React.FormEvent) {
    e.preventDefault();
    const n = providerName.trim();
    if (!n) return;
    setSavingProvider(true);
    try {
      const id = await createProvider({
        kind: providerKind,
        name: n,
        createdBy: user?.uid,
        city: providerCity.trim() || undefined,
        phone: providerPhone.trim() || undefined,
        meetingUrl: providerMeetingUrl.trim() || undefined,
        description: providerDescription.trim() || undefined,
        createdAt: Date.now(),
      });
      setProviderId(id);
      setProviderName("");
      setProviderCity("");
      setProviderPhone("");
      setProviderMeetingUrl("");
      setProviderDescription("");
      setAddingProvider(false);
      pushToast({ type: "success", title: "Professionista", message: "Aggiunto." });
    } catch (err) {
      pushToast({ type: "error", title: "Professionista", message: err instanceof Error ? err.message : "Creazione fallita" });
    } finally {
      setSavingProvider(false);
    }
  }

  async function onUpdateStatus(b: Booking, status: BookingStatus, cancelReason?: Booking["cancelReason"]) {
    if (!activePetId) return;
    if (busyBookingId) return;
    setBusyBookingId(b.id);
    try {
      await setBookingStatus(activePetId, b.id, status, cancelReason);
      pushToast({
        type: "success",
        title: "Prenotazione",
        message: status === "confirmed" ? "Confermata." : status === "completed" ? "Completata." : status === "cancelled" ? "Annullata." : "Aggiornata.",
      });
    } catch (err) {
      pushToast({ type: "error", title: "Prenotazione", message: err instanceof Error ? err.message : "Aggiornamento fallito" });
    } finally {
      setBusyBookingId(null);
    }
  }

  async function onDeleteBooking(b: Booking) {
    if (!activePetId) return;
    if (busyBookingId) return;
    const ok = await confirmDialog({
      title: "Elimina prenotazione",
      description: "Vuoi eliminare questa prenotazione?",
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setBusyBookingId(b.id);
    try {
      await deleteBooking(activePetId, b.id);
      pushToast({ type: "success", title: "Prenotazione", message: "Eliminata." });
    } catch (err) {
      pushToast({ type: "error", title: "Prenotazione", message: err instanceof Error ? err.message : "Eliminazione fallita" });
    } finally {
      setBusyBookingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prenotazioni"
        description="Veterinario, toelettatura, pet sitter: con flusso anti no‑show."
        imagePrompt="minimal clean illustration, calendar appointment card with paw icon and clinic, airy background, accent color, premium, no text, no watermark"
        imageAlt="Prenotazioni"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("upcoming")}
          className={
            tab === "upcoming"
              ? "rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-sm"
              : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm text-slate-700 hover:bg-white"
          }
        >
          Prossime
        </button>
        <button
          onClick={() => setTab("history")}
          className={
            tab === "history"
              ? "rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-sm"
              : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm text-slate-700 hover:bg-white"
          }
        >
          Storico
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-slate-600">Filtri</div>
          {(
            [
              ["requested", "Rich."],
              ["confirmed", "Conf."],
              ["completed", "Ok"],
              ["cancelled", "Ann."],
              ["no_show", "No‑show"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatusFilter((s) => ({ ...s, [k]: !s[k] }))}
              className={statusFilter[k] ? "lp-chip lp-chip-active" : "lp-chip"}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crea prenotazione</CardTitle>
          <CardDescription>Imposta una scadenza per confermare e ridurre no‑show.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per prenotare un servizio." />
        ) : (
          <div className="space-y-3">
          <form onSubmit={onCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-600 mb-1">Tipo</div>
              <select
                value={providerKind}
                onChange={(e) => setProviderKind(e.target.value as ProviderKind)}
                className="lp-select"
              >
                <option value="vet">Veterinario</option>
                <option value="nutritionist">Nutrizionista</option>
                <option value="groomer">Toelettatore</option>
                <option value="sitter">Sitter</option>
              </select>
            </label>
            <label className="lg:col-span-4 block">
              <div className="text-xs text-slate-600 mb-1">Professionista</div>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="lp-select"
              >
                <option value="">Seleziona…</option>
                <option value="__manual__">Inserimento manuale…</option>
                {filteredProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.city ? ` · ${p.city}` : ""}
                  </option>
                ))}
              </select>
              {filteredProviders.length === 0 ? (
                <div className="text-xs text-slate-600 mt-1">Nessun professionista in questa categoria.</div>
              ) : null}
            </label>

            {providerId === "__manual__" ? (
              <>
                <label className="lg:col-span-4 block">
                  <div className="text-xs text-slate-600 mb-1">Nome professionista</div>
                  <input value={manualProviderName} onChange={(e) => setManualProviderName(e.target.value)} className="lp-input" />
                </label>
                <label className="lg:col-span-4 block">
                  <div className="text-xs text-slate-600 mb-1">Città (opzionale)</div>
                  <input value={manualProviderCity} onChange={(e) => setManualProviderCity(e.target.value)} className="lp-input" />
                </label>
                <label className="lg:col-span-4 block">
                  <div className="text-xs text-slate-600 mb-1">Telefono (opzionale)</div>
                  <input value={manualProviderPhone} onChange={(e) => setManualProviderPhone(e.target.value)} className="lp-input" />
                </label>
                <label className="lg:col-span-8 block">
                  <div className="text-xs text-slate-600 mb-1">Link teleconsulto (opzionale)</div>
                  <input
                    value={manualProviderMeetingUrl}
                    onChange={(e) => setManualProviderMeetingUrl(e.target.value)}
                    placeholder="https://meet…"
                    className="lp-input"
                  />
                </label>
              </>
            ) : null}
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-600 mb-1">Quando</div>
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                className="lp-input"
                ref={createWhenRef}
              />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-600 mb-1">Conferma entro (ore)</div>
              <input
                value={String(confirmHours)}
                onChange={(e) => setConfirmHours(Number(e.target.value))}
                inputMode="numeric"
                className="lp-input"
              />
            </label>
            <button
              disabled={creating || (providerId === "__manual__" ? !manualProviderName.trim() : !selectedProvider)}
              type="submit"
              className="lg:col-span-1 lp-btn-primary disabled:opacity-60"
            >
              {creating ? "…" : <Plus className="w-4 h-4" />}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs text-slate-600 mb-1">Note</div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo, preferenze, indirizzo…"
                className="lp-input"
              />
            </label>

              {providerId === "__manual__" ? (
                manualProviderMeetingUrl.trim() ? (
                  <div className="text-xs text-slate-600">Teleconsulto: {manualProviderMeetingUrl.trim()}</div>
                ) : null
              ) : selectedProvider?.meetingUrl ? (
                <div className="text-xs text-slate-600">Teleconsulto: {selectedProvider.meetingUrl}</div>
              ) : null}
            <div className="lg:col-span-12 text-xs text-slate-600">
              Anti no‑show: se non confermata entro la scadenza, può essere annullata automaticamente. Dopo l’orario può essere segnata come no‑show.
            </div>
          </form>
          {error ? <Alert variant="danger" title="Errore">{error}</Alert> : null}
          {success ? <Alert variant="success" title="OK">{success}</Alert> : null}

          <div className="lp-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Professionisti</div>
                <div className="text-xs text-slate-600">Aggiungi un contatto se manca in lista.</div>
              </div>
              <button onClick={() => setAddingProvider((v) => !v)} className="lp-btn-secondary">
                {addingProvider ? "Chiudi" : "Aggiungi"}
              </button>
            </div>
            {addingProvider ? (
              <form onSubmit={onCreateProvider} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Nome</div>
                  <input value={providerName} onChange={(e) => setProviderName(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Città</div>
                  <input value={providerCity} onChange={(e) => setProviderCity(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Telefono</div>
                  <input value={providerPhone} onChange={(e) => setProviderPhone(e.target.value)} className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Link teleconsulto</div>
                  <input value={providerMeetingUrl} onChange={(e) => setProviderMeetingUrl(e.target.value)} placeholder="https://meet.jit.si/..." className="lp-input" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600 mb-1">Descrizione</div>
                  <input value={providerDescription} onChange={(e) => setProviderDescription(e.target.value)} className="lp-input" />
                </label>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setAddingProvider(false)} className="lp-btn-secondary">
                    Annulla
                  </button>
                  <button disabled={savingProvider} type="submit" className="lp-btn-primary disabled:opacity-60">
                    {savingProvider ? "Salvataggio…" : "Salva contatto"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{tab === "upcoming" ? "Prossime prenotazioni" : "Storico prenotazioni"}</CardTitle>
              <CardDescription>{tab === "upcoming" ? "Conferma, completa o annulla." : "Ultime prenotazioni e stati."}</CardDescription>
            </div>
            {tab === "history" ? (
              <div className="w-56">
                <div className="text-xs text-slate-600 mb-1">Periodo</div>
                <select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="lp-select">
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="365">Ultimo anno</option>
                </select>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState
            title="Seleziona un pet"
            description="Scegli un profilo per vedere e creare prenotazioni."
            action={<Link to="/app/pets" className="lp-btn-secondary">Apri profilo pet</Link>}
          />
        ) : tab === "upcoming" && filteredUpcoming.length === 0 ? (
          <EmptyState
            title="Nessuna prenotazione"
            description="Crea una prenotazione per tenere tutto sotto controllo."
            action={
              <button type="button" className="lp-btn-primary" onClick={focusCreateBooking}>
                Crea prenotazione
              </button>
            }
          />
        ) : tab === "history" && filteredHistory.length === 0 ? (
          <EmptyState
            title="Nessuno storico"
            description="Non ci sono prenotazioni nel periodo selezionato."
            action={
              <button type="button" className="lp-btn-secondary" onClick={() => setTab("upcoming")}>
                Vai alle prossime
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {(tab === "upcoming" ? filteredUpcoming : filteredHistory).map((b) => (
              <div key={b.id} className="lp-panel px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 lp-icon-primary" />
                      {b.providerName} · {providerKindLabel(b.providerKind)}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{new Date(b.scheduledAt).toLocaleString()}</div>
                    {b.confirmBy ? (
                      <div className="text-xs text-slate-600 mt-1">Conferma entro: {new Date(b.confirmBy).toLocaleString()}</div>
                    ) : null}
                    {b.notes ? (
                      <div className="text-sm mt-1" style={{ color: "rgb(var(--lp-ink))" }}>
                        {b.notes}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === "requested" ? (
                      <button
                        type="button"
                        onClick={() => void onUpdateStatus(b, "confirmed")}
                        className="lp-btn-primary"
                        disabled={busyBookingId === b.id}
                      >
                        Conferma
                      </button>
                    ) : null}
                    {b.status === "confirmed" ? (
                      <button
                        type="button"
                        onClick={() => void onUpdateStatus(b, "completed")}
                        className="lp-btn-secondary"
                        disabled={busyBookingId === b.id}
                      >
                        Completata
                      </button>
                    ) : null}
                    {b.status !== "cancelled" && b.status !== "completed" ? (
                      <button
                        type="button"
                        onClick={() => void onUpdateStatus(b, "cancelled", "user_cancel")}
                        className="lp-btn-secondary"
                        disabled={busyBookingId === b.id}
                      >
                        Annulla
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onDeleteBooking(b)}
                      className="lp-btn-icon"
                      disabled={busyBookingId === b.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">Stato: {b.status}{b.cancelReason ? ` (${b.cancelReason})` : ""}</div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

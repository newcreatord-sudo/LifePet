import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createBooking, deleteBooking, setBookingStatus, subscribeBookingsHistoryRange, subscribeUpcomingBookings } from "@/data/bookings";
import { createProvider, seedDefaultProviders, subscribeProviders } from "@/data/providers";
import type { Booking, BookingStatus, Provider, ProviderKind } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

function providerKindLabel(kind: ProviderKind) {
  if (kind === "vet") return "Veterinario";
  if (kind === "groomer") return "Toelettatore";
  return "Sitter";
}

export default function Bookings() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);

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
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [confirmHours, setConfirmHours] = useState<number>(6);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingProvider, setAddingProvider] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerCity, setProviderCity] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
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
    if (filteredProviders.some((p) => p.id === providerId)) return;
    setProviderId(filteredProviders[0]?.id ?? "");
  }, [filteredProviders, providerId]);

  const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId) ?? null, [providerId, providers]);

  const filteredUpcoming = useMemo(() => items.filter((b) => statusFilter[b.status]), [items, statusFilter]);
  const filteredHistory = useMemo(() => history.filter((b) => statusFilter[b.status]), [history, statusFilter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId || !selectedProvider) return;
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
    setCreating(true);
    setError(null);
    try {
      await createBooking(activePetId, user.uid, selectedProvider, when, confirmHours > 0 ? confirmBy : null, notes);
      setScheduledAt("");
      setNotes("");
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
        city: providerCity.trim() || undefined,
        phone: providerPhone.trim() || undefined,
        description: providerDescription.trim() || undefined,
        createdAt: Date.now(),
      });
      setProviderId(id);
      setProviderName("");
      setProviderCity("");
      setProviderPhone("");
      setProviderDescription("");
      setAddingProvider(false);
    } finally {
      setSavingProvider(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Prenotazioni" description="Veterinario, toelettatura, pet sitter: con flusso anti no‑show." />

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
              className={
                statusFilter[k]
                  ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-xs text-fuchsia-800"
                  : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
              }
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
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-600 mb-1">Quando</div>
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                className="lp-input"
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
              disabled={creating || !selectedProvider}
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
            <div className="lg:col-span-12 text-xs text-slate-600">
              Anti no‑show: se non confermata entro la scadenza, può essere annullata automaticamente. Dopo l’orario può essere segnata come no‑show.
            </div>
          </form>
          {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

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
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le prenotazioni." />
        ) : tab === "upcoming" && filteredUpcoming.length === 0 ? (
          <EmptyState title="Nessuna prenotazione" description="Crea una prenotazione per tenere tutto sotto controllo." />
        ) : tab === "history" && filteredHistory.length === 0 ? (
          <EmptyState title="Nessuno storico" description="Non ci sono prenotazioni nel periodo selezionato." />
        ) : (
          <div className="space-y-2">
            {(tab === "upcoming" ? filteredUpcoming : filteredHistory).map((b) => (
              <div key={b.id} className="lp-panel px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-fuchsia-700" />
                      {b.providerName} · {providerKindLabel(b.providerKind)}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{new Date(b.scheduledAt).toLocaleString()}</div>
                    {b.confirmBy ? (
                      <div className="text-xs text-slate-600 mt-1">Conferma entro: {new Date(b.confirmBy).toLocaleString()}</div>
                    ) : null}
                    {b.notes ? <div className="text-sm text-slate-800 mt-1">{b.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === "requested" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "confirmed")}
                        className="lp-btn-primary"
                      >
                        Conferma
                      </button>
                    ) : null}
                    {b.status === "confirmed" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "completed")}
                        className="lp-btn-secondary"
                      >
                        Completata
                      </button>
                    ) : null}
                    {b.status !== "cancelled" && b.status !== "completed" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "cancelled", "user_cancel")}
                        className="lp-btn-secondary"
                      >
                        Annulla
                      </button>
                    ) : null}
                    <button
                      onClick={async () => {
                        if (!activePetId) return;
                        if (!confirm("Eliminare questa prenotazione?")) return;
                        await deleteBooking(activePetId, b.id);
                      }}
                      className="lp-btn-icon"
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

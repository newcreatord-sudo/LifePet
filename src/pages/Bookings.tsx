import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createBooking, deleteBooking, setBookingStatus, subscribeUpcomingBookings } from "@/data/bookings";
import { createProvider, seedDefaultProviders, subscribeProviders } from "@/data/providers";
import type { Booking, Provider, ProviderKind } from "@/types";
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

  const filteredProviders = useMemo(() => providers.filter((p) => p.kind === providerKind), [providerKind, providers]);

  useEffect(() => {
    if (filteredProviders.some((p) => p.id === providerId)) return;
    setProviderId(filteredProviders[0]?.id ?? "");
  }, [filteredProviders, providerId]);

  const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId) ?? null, [providerId, providers]);

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
              <div className="text-xs text-slate-400 mb-1">Tipo</div>
              <select
                value={providerKind}
                onChange={(e) => setProviderKind(e.target.value as ProviderKind)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="vet">Veterinario</option>
                <option value="groomer">Toelettatore</option>
                <option value="sitter">Sitter</option>
              </select>
            </label>
            <label className="lg:col-span-4 block">
              <div className="text-xs text-slate-400 mb-1">Professionista</div>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              >
                {filteredProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.city ? ` · ${p.city}` : ""}
                  </option>
                ))}
              </select>
              {filteredProviders.length === 0 ? (
                <div className="text-xs text-slate-500 mt-1">Nessun professionista in questa categoria.</div>
              ) : null}
            </label>
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-400 mb-1">Quando</div>
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Conferma entro (ore)</div>
              <input
                value={String(confirmHours)}
                onChange={(e) => setConfirmHours(Number(e.target.value))}
                inputMode="numeric"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={creating || !selectedProvider}
              type="submit"
              className="lg:col-span-1 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
            >
              {creating ? "…" : <Plus className="w-4 h-4" />}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo, preferenze, indirizzo…"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="lg:col-span-12 text-xs text-slate-500">
              Anti no‑show: se non confermata entro la scadenza, può essere annullata automaticamente. Dopo l’orario può essere segnata come no‑show.
            </div>
          </form>
          {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Professionisti</div>
                <div className="text-xs text-slate-500">Aggiungi un contatto se manca in lista.</div>
              </div>
              <button onClick={() => setAddingProvider((v) => !v)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                {addingProvider ? "Chiudi" : "Aggiungi"}
              </button>
            </div>
            {addingProvider ? (
              <form onSubmit={onCreateProvider} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Nome</div>
                  <input value={providerName} onChange={(e) => setProviderName(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Città</div>
                  <input value={providerCity} onChange={(e) => setProviderCity(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Telefono</div>
                  <input value={providerPhone} onChange={(e) => setProviderPhone(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Descrizione</div>
                  <input value={providerDescription} onChange={(e) => setProviderDescription(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm" />
                </label>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setAddingProvider(false)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900">
                    Annulla
                  </button>
                  <button disabled={savingProvider} type="submit" className="rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60">
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
          <CardTitle>Prossime prenotazioni</CardTitle>
          <CardDescription>Conferma, completa o annulla.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le prenotazioni." />
        ) : items.length === 0 ? (
          <EmptyState title="Nessuna prenotazione" description="Crea una prenotazione per tenere tutto sotto controllo." />
        ) : (
          <div className="space-y-2">
            {items.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-emerald-200" />
                      {b.providerName} · {providerKindLabel(b.providerKind)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(b.scheduledAt).toLocaleString()}</div>
                    {b.confirmBy ? (
                      <div className="text-xs text-slate-400 mt-1">Conferma entro: {new Date(b.confirmBy).toLocaleString()}</div>
                    ) : null}
                    {b.notes ? <div className="text-sm text-slate-300 mt-1">{b.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === "requested" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "confirmed")}
                        className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-xs font-medium hover:bg-emerald-300"
                      >
                        Conferma
                      </button>
                    ) : null}
                    {b.status === "confirmed" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "completed")}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                      >
                        Completata
                      </button>
                    ) : null}
                    {b.status !== "cancelled" && b.status !== "completed" ? (
                      <button
                        onClick={() => activePetId && setBookingStatus(activePetId, b.id, "cancelled", "user_cancel")}
                        className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
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
                      className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Stato: {b.status}{b.cancelReason ? ` (${b.cancelReason})` : ""}</div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

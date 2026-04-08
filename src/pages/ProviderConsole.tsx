import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/stores/authStore";
import { subscribeUserProfile, updateUserPreferences } from "@/data/users";
import { seedDefaultProviders, subscribeProviders } from "@/data/providers";
import { getProviderBookings, providerSetBookingStatus } from "@/data/providerConsole";
import type { Booking, BookingStatus, Provider } from "@/types";

function statusLabel(s: BookingStatus) {
  if (s === "requested") return "Richiesta";
  if (s === "confirmed") return "Confermata";
  if (s === "completed") return "Completata";
  if (s === "cancelled") return "Annullata";
  return "No‑show";
}

export default function ProviderConsole() {
  const user = useAuthStore((s) => s.user);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>("");

  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todo" | "all">("todo");

  useEffect(() => {
    seedDefaultProviders();
    const unsub = subscribeProviders(setProviders);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) return;
    const unsub = subscribeUserProfile(user.uid, (p) => {
      const id = p?.preferences?.providerConsoleProviderId;
      if (typeof id === "string") setProviderId(id);
    });
    return () => unsub();
  }, [user]);

  const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId) ?? null, [providerId, providers]);

  const reload = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getProviderBookings(providerId);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    void reload();
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [providerId, reload]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const base = items
      .slice()
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .filter((b) => b.scheduledAt >= now - 48 * 60 * 60 * 1000);
    if (filter === "all") return base;
    return base.filter((b) => b.status === "requested" || b.status === "confirmed");
  }, [filter, items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Console professionista"
        description="Gestisci richieste, conferme e completamenti (anti no‑show)."
        actions={
          <button onClick={() => void reload()} className="lp-btn-secondary inline-flex items-center gap-2" disabled={!providerId || loading}>
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </button>
        }
      />

      {!user ? (
        <EmptyState title="Accedi" description="Per usare la console professionista devi essere autenticato." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Selezione</CardTitle>
            <CardDescription>Collega la console a un professionista.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <label className="md:col-span-6 block">
                <div className="text-xs text-slate-600 mb-1">Professionista</div>
                <select
                  value={providerId}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setProviderId(next);
                    if (!user.isDemo) await updateUserPreferences(user.uid, { providerConsoleProviderId: next });
                  }}
                  className="lp-select"
                >
                  <option value="">Seleziona…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.city ? ` · ${p.city}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="md:col-span-3 block">
                <div className="text-xs text-slate-600 mb-1">Vista</div>
                <select value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : "todo")} className="lp-select">
                  <option value="todo">Da gestire</option>
                  <option value="all">Tutte</option>
                </select>
              </label>

              <div className="md:col-span-3 text-sm text-slate-700">
                {selectedProvider ? <div className="font-semibold">{selectedProvider.name}</div> : <div>—</div>}
                {selectedProvider?.phone ? <div className="text-xs text-slate-600">{selectedProvider.phone}</div> : null}
              </div>
            </div>
            {error ? <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
            <div className="mt-2 text-xs text-slate-600">Nota: questa console è legata al provider selezionato (Impostazioni utente).</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prenotazioni</CardTitle>
          <CardDescription>Richieste e appuntamenti imminenti.</CardDescription>
        </CardHeader>
        <CardContent>
          {!providerId ? (
            <EmptyState title="Seleziona un professionista" description="Scegli un contatto per vedere le prenotazioni associate." />
          ) : loading && items.length === 0 ? (
            <div className="text-sm text-slate-600">Caricamento…</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Nessuna prenotazione" description="Non ci sono prenotazioni da mostrare." />
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => (
                <div key={b.id} className="lp-panel px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-sky-700" />
                        {new Date(b.scheduledAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">Pet: {b.petId}</div>
                      <div className="text-xs text-slate-600 mt-0.5">Stato: {statusLabel(b.status)}</div>
                      {b.notes ? <div className="text-sm text-slate-800 mt-1">{b.notes}</div> : null}
                      {b.confirmBy ? <div className="text-xs text-slate-600 mt-1">Conferma entro: {new Date(b.confirmBy).toLocaleString()}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {b.status === "requested" ? (
                        <button
                          className="lp-btn-primary"
                          onClick={async () => {
                            await providerSetBookingStatus(providerId, b.petId, b.id, "confirmed");
                            await reload();
                          }}
                        >
                          Conferma
                        </button>
                      ) : null}
                      {b.status === "confirmed" ? (
                        <button
                          className="lp-btn-secondary"
                          onClick={async () => {
                            await providerSetBookingStatus(providerId, b.petId, b.id, "completed");
                            await reload();
                          }}
                        >
                          Completata
                        </button>
                      ) : null}
                      {(b.status === "requested" || b.status === "confirmed") && (
                        <button
                          className="lp-btn-secondary"
                          onClick={async () => {
                            await providerSetBookingStatus(providerId, b.petId, b.id, "cancelled");
                            await reload();
                          }}
                        >
                          Annulla
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

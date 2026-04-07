import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createExpense, deleteExpense, subscribeExpensesRange, subscribeRecentExpenses } from "@/data/expenses";
import type { Expense, ExpenseCategory } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function categoryLabel(cat: ExpenseCategory) {
  if (cat === "food") return "Cibo";
  if (cat === "vet") return "Veterinario";
  if (cat === "medicine") return "Farmaci";
  if (cat === "grooming") return "Toelettatura";
  if (cat === "training") return "Training";
  if (cat === "accessories") return "Accessori";
  return "Altro";
}

export default function Expenses() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const [items, setItems] = useState<Expense[]>([]);
  const [monthItems, setMonthItems] = useState<Expense[]>([]);
  const [items90d, setItems90d] = useState<Expense[]>([]);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const monthRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, []);

  const range90d = useMemo(() => {
    const toMs = Date.now();
    const fromMs = toMs - 90 * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
  }, []);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentExpenses(activePetId, 20, setItems);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeExpensesRange(activePetId, monthRange.fromMs, monthRange.toMs, setMonthItems);
    return () => unsub();
  }, [activePetId, monthRange.fromMs, monthRange.toMs]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeExpensesRange(activePetId, range90d.fromMs, range90d.toMs, setItems90d);
    return () => unsub();
  }, [activePetId, range90d.fromMs, range90d.toMs]);

  const totalMonth = useMemo(() => monthItems.reduce((s, e) => s + e.amount, 0), [monthItems]);

  const breakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of monthItems) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthItems]);

  const forecast = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const e of items90d) {
      const d = new Date(e.occurredAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(k, (byMonth.get(k) ?? 0) + e.amount);
    }
    const months = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const last3 = months.slice(-3);
    const avg = last3.length ? last3.reduce((s, [, v]) => s + v, 0) / last3.length : 0;
    return { months: last3, avg };
  }, [items90d]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    try {
      await createExpense(activePetId, {
        petId: activePetId,
        amount: value,
        currency: "EUR",
        category,
        occurredAt: Date.now(),
        note: note.trim() || undefined,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setAmount("");
      setNote("");
      setCategory("food");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Spese" description="Traccia costi per pet e monitora trend mensili." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Aggiungi spesa</CardTitle>
            <CardDescription>Registra rapidamente un costo.</CardDescription>
          </CardHeader>
          <CardContent>
          {!activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per aggiungere spese." />
          ) : (
            <form onSubmit={onAdd} className="space-y-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Importo (EUR)</div>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Categoria</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                >
                  <option value="food">Cibo</option>
                  <option value="vet">Veterinario</option>
                  <option value="medicine">Farmaci</option>
                  <option value="grooming">Toelettatura</option>
                  <option value="training">Training</option>
                  <option value="accessories">Accessori</option>
                  <option value="other">Altro</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Note</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <button
                disabled={saving}
                className="w-full rounded-xl bg-emerald-300/90 text-slate-950 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
                type="submit"
              >
                {saving ? "Aggiunta…" : "Aggiungi"}
              </button>
            </form>
          )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Questo mese</CardTitle>
                <CardDescription>Spesa totale del pet attivo</CardDescription>
              </div>
              <div className="text-lg font-semibold">€ {totalMonth.toFixed(2)}</div>
            </div>
          </CardHeader>
          <CardContent>
          {activePetId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Ripartizione</div>
                {breakdown.length === 0 ? (
                  <div className="text-sm text-slate-400 mt-2">Nessuna spesa questo mese.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {breakdown.slice(0, 6).map(([cat, sum]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <div className="text-slate-300">{categoryLabel(cat)}</div>
                        <div className="font-medium">€ {sum.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-500">Previsione</div>
                <div className="mt-2 text-sm text-slate-300">Stima prossimo mese: <span className="font-medium">€ {forecast.avg.toFixed(2)}</span></div>
                <div className="mt-2 text-xs text-slate-500">Basata sugli ultimi {forecast.months.length} mesi negli ultimi 90 giorni.</div>
                {forecast.months.length ? (
                  <div className="mt-2 space-y-1">
                    {forecast.months.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs text-slate-400">
                        <div>{k}</div>
                        <div>€ {v.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="text-xs text-slate-500">Spese recenti</div>
          {!activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le spese." />
          ) : items.length === 0 ? (
            <EmptyState title="Nessuna spesa" description="Aggiungi la prima spesa per costruire il trend." />
          ) : (
            <div className="mt-2 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">€ {it.amount.toFixed(2)} · {categoryLabel(it.category)}</div>
                      {it.note ? <div className="text-xs text-slate-400 mt-0.5">{it.note}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-500">{new Date(it.occurredAt).toLocaleString()}</div>
                      {user && activePetId ? (
                        <button
                          onClick={async () => {
                            if (!confirm("Eliminare questa spesa?")) return;
                            await deleteExpense(activePetId, it.id);
                          }}
                          className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

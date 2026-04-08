import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import {
  createExpense,
  createExpenseSeries,
  deleteExpense,
  deleteExpenseSeries,
  seedExpenseSeriesOncePerDay,
  setExpenseSeriesEnabled,
  subscribeExpensesRange,
  subscribeExpenseSeries,
  subscribeRecentExpenses,
} from "@/data/expenses";
import { updatePet } from "@/data/pets";
import type { Expense, ExpenseCategory, ExpenseSeries } from "@/types";
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
  const pets = usePetStore((s) => s.pets);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [items, setItems] = useState<Expense[]>([]);
  const [monthItems, setMonthItems] = useState<Expense[]>([]);
  const [items90d, setItems90d] = useState<Expense[]>([]);

  const [series, setSeries] = useState<ExpenseSeries[]>([]);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [seriesTitle, setSeriesTitle] = useState("Abbonamento");
  const [seriesAmount, setSeriesAmount] = useState("");
  const [seriesCategory, setSeriesCategory] = useState<ExpenseCategory>("food");
  const [seriesNote, setSeriesNote] = useState("");
  const [seriesDay, setSeriesDay] = useState("1");
  const [savingSeries, setSavingSeries] = useState(false);

  const [budget, setBudget] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    setBudget(activePet?.budgetMonthly?.toString() ?? "");
  }, [activePet?.budgetMonthly]);

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
    const unsub = subscribeExpenseSeries(activePetId, setSeries);
    return () => unsub();
  }, [activePetId]);

  useEffect(() => {
    if (!user || !activePetId) return;
    void seedExpenseSeriesOncePerDay(activePetId, user.uid, series);
  }, [activePetId, series, user]);

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

  const budgetValue = useMemo(() => {
    const v = Number(budget);
    if (!Number.isFinite(v) || v <= 0) return null;
    return v;
  }, [budget]);


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

  async function onAddSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const value = Number(seriesAmount);
    const day = Number(seriesDay);
    if (!Number.isFinite(value) || value <= 0) return;
    if (!Number.isFinite(day) || day < 1 || day > 28) return;
    setSavingSeries(true);
    try {
      const startAt = Date.now();
      await createExpenseSeries(activePetId, {
        petId: activePetId,
        title: seriesTitle.trim() || "Ricorrente",
        enabled: true,
        amount: value,
        currency: "EUR",
        category: seriesCategory,
        note: seriesNote.trim() || undefined,
        startAt,
        recurrence: { type: "monthly", dayOfMonth: day },
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setSeriesTitle("Abbonamento");
      setSeriesAmount("");
      setSeriesNote("");
      setSeriesCategory("food");
      setSeriesDay("1");
    } finally {
      setSavingSeries(false);
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
                <div className="text-xs text-slate-600 mb-1">Importo (EUR)</div>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="lp-input"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600 mb-1">Categoria</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="lp-select"
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
                <div className="text-xs text-slate-600 mb-1">Note</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="lp-input"
                />
              </label>
              <button
                disabled={saving}
                className="w-full lp-btn-primary"
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
            <CardTitle>Ricorrenti</CardTitle>
            <CardDescription>Abbonamenti e costi mensili automatici.</CardDescription>
          </CardHeader>
          <CardContent>
            {!activePetId ? (
              <EmptyState title="Seleziona un pet" description="Scegli un profilo per gestire spese ricorrenti." />
            ) : (
              <div className="space-y-4">
                <form onSubmit={onAddSeries} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <label className="md:col-span-4 block">
                    <div className="text-xs text-slate-600 mb-1">Titolo</div>
                    <input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} className="lp-input" />
                  </label>
                  <label className="md:col-span-2 block">
                    <div className="text-xs text-slate-600 mb-1">Importo</div>
                    <input value={seriesAmount} onChange={(e) => setSeriesAmount(e.target.value)} inputMode="decimal" className="lp-input" />
                  </label>
                  <label className="md:col-span-3 block">
                    <div className="text-xs text-slate-600 mb-1">Categoria</div>
                    <select value={seriesCategory} onChange={(e) => setSeriesCategory(e.target.value as ExpenseCategory)} className="lp-select">
                      <option value="food">Cibo</option>
                      <option value="vet">Veterinario</option>
                      <option value="medicine">Farmaci</option>
                      <option value="grooming">Toelettatura</option>
                      <option value="training">Training</option>
                      <option value="accessories">Accessori</option>
                      <option value="other">Altro</option>
                    </select>
                  </label>
                  <label className="md:col-span-2 block">
                    <div className="text-xs text-slate-600 mb-1">Giorno mese</div>
                    <input value={seriesDay} onChange={(e) => setSeriesDay(e.target.value)} inputMode="numeric" className="lp-input" />
                    <div className="text-[10px] text-slate-600 mt-1">1–28</div>
                  </label>
                  <button disabled={savingSeries} className="md:col-span-1 lp-btn-primary" type="submit">
                    {savingSeries ? "…" : "Aggiungi"}
                  </button>
                  <label className="md:col-span-12 block">
                    <div className="text-xs text-slate-600 mb-1">Note</div>
                    <input value={seriesNote} onChange={(e) => setSeriesNote(e.target.value)} className="lp-input" />
                  </label>
                </form>

                {series.length === 0 ? (
                  <div className="text-sm text-slate-600">Nessuna spesa ricorrente.</div>
                ) : (
                  <div className="space-y-2">
                    {series.map((s) => (
                      <div key={s.id} className="lp-panel px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{s.title}</div>
                            <div className="text-xs text-slate-600">€ {s.amount.toFixed(2)} · {categoryLabel(s.category)} · giorno {s.recurrence.dayOfMonth}</div>
                            {s.note ? <div className="text-xs text-slate-600 mt-0.5">{s.note}</div> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={s.enabled ? "lp-btn-primary" : "lp-btn-secondary"}
                              onClick={async () => {
                                if (!activePetId) return;
                                await setExpenseSeriesEnabled(activePetId, s.id, !s.enabled);
                                if (!s.enabled) await seedExpenseSeriesOncePerDay(activePetId, user?.uid ?? "system", [{ ...s, enabled: true }]);
                              }}
                            >
                              {s.enabled ? "Attiva" : "Pausa"}
                            </button>
                            <button
                              type="button"
                              className="lp-btn-icon"
                              onClick={async () => {
                                if (!activePetId) return;
                                if (!confirm("Eliminare questa ricorrenza?")) return;
                                await deleteExpenseSeries(activePetId, s.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-600">Le spese vengono generate automaticamente (server-side) quando maturano.</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-12">
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
              <div className="lp-surface p-3">
                <div className="text-xs text-slate-600">Ripartizione</div>
                {breakdown.length === 0 ? (
                  <div className="text-sm text-slate-600 mt-2">Nessuna spesa questo mese.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {breakdown.slice(0, 6).map(([cat, sum]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <div className="text-slate-700">{categoryLabel(cat)}</div>
                        <div className="font-medium">€ {sum.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="lp-surface p-3">
                <div className="text-xs text-slate-600">Previsione</div>
                <div className="mt-2 text-sm text-slate-700">Stima prossimo mese: <span className="font-medium">€ {forecast.avg.toFixed(2)}</span></div>
                <div className="mt-2 text-xs text-slate-600">Basata sugli ultimi {forecast.months.length} mesi negli ultimi 90 giorni.</div>
                {forecast.months.length ? (
                  <div className="mt-2 space-y-1">
                    {forecast.months.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs text-slate-600">
                        <div>{k}</div>
                        <div>€ {v.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="md:col-span-2 lp-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-600">Budget mensile</div>
                    <div className="text-sm font-semibold">{activePet?.budgetMonthly ? `€ ${activePet.budgetMonthly.toFixed(2)}` : "Non impostato"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">Speso</div>
                    <div className="text-sm font-semibold">€ {totalMonth.toFixed(2)}</div>
                  </div>
                </div>

                {activePet?.budgetMonthly ? (
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={totalMonth > activePet.budgetMonthly ? "h-2 bg-rose-500" : "h-2 bg-fuchsia-600"}
                        style={{ width: `${Math.min(100, Math.round((totalMonth / activePet.budgetMonthly) * 100))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {totalMonth > activePet.budgetMonthly ? "Budget superato" : `Utilizzato ${Math.round((totalMonth / activePet.budgetMonthly) * 100)}%`}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col sm:flex-row gap-2 items-end">
                  <label className="block flex-1">
                    <div className="text-xs text-slate-600 mb-1">Imposta budget (EUR)</div>
                    <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className="lp-input" />
                  </label>
                  <button
                    className="lp-btn-primary"
                    disabled={!activePetId || savingBudget}
                    onClick={async () => {
                      if (!activePetId) return;
                      const v = budgetValue;
                      setSavingBudget(true);
                      try {
                        await updatePet(activePetId, { budgetMonthly: v ?? undefined, budgetCurrency: "EUR" });
                      } finally {
                        setSavingBudget(false);
                      }
                    }}
                    type="button"
                  >
                    {savingBudget ? "Salvataggio…" : "Salva budget"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-600">Se superi il budget, arriva una notifica automatica.</div>
              </div>
            </div>
          ) : null}
          <div className="text-xs text-slate-600">Spese recenti</div>
          {!activePetId ? (
            <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere le spese." />
          ) : items.length === 0 ? (
            <EmptyState title="Nessuna spesa" description="Aggiungi la prima spesa per costruire il trend." />
          ) : (
            <div className="mt-2 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="lp-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">€ {it.amount.toFixed(2)} · {categoryLabel(it.category)}</div>
                      {it.note ? <div className="text-xs text-slate-600 mt-0.5">{it.note}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-600">{new Date(it.occurredAt).toLocaleString()}</div>
                      {user && activePetId ? (
                        <button
                          onClick={async () => {
                            if (!confirm("Eliminare questa spesa?")) return;
                            await deleteExpense(activePetId, it.id);
                          }}
                          className="lp-btn-icon"
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

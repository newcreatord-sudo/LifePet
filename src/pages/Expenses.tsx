import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";
import { seedStarterKit } from "@/lib/starterKit";
import { deleteField } from "firebase/firestore";
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
import { useConfirmDialog } from "@/components/confirm";
import { shouldUseDemoData } from "@/lib/runtimeMode";

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
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const confirmDialog = useConfirmDialog();
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const pushToast = useToastStore((s) => s.push);
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
  const [deletingSeriesId, setDeletingSeriesId] = useState<string | null>(null);
  const [togglingSeriesId, setTogglingSeriesId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const amountRef = useRef<HTMLInputElement | null>(null);
  const [seedingStarter, setSeedingStarter] = useState(false);

  function focusAddExpense() {
    amountRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    amountRef.current?.focus();
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
    const sp = new URLSearchParams(location.search);
    const a = sp.get("amount");
    const c = sp.get("category");
    const n = sp.get("note");
    if (!a && !c && !n) return;

    if (a) setAmount(a);
    if (n) setNote(n);
    if (c === "food" || c === "vet" || c === "medicine" || c === "grooming" || c === "training" || c === "accessories" || c === "other") {
      setCategory(c);
    }

    sp.delete("amount");
    sp.delete("category");
    sp.delete("note");
    navigate({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    setBudget(activePet?.budgetMonthly?.toString() ?? "");
  }, [activePet?.budgetMonthly]);

  const monthRange = useMemo(() => {
    const m = monthKey.match(/^(\d{4})-(\d{2})$/);
    const y = m ? Number(m[1]) : new Date().getFullYear();
    const mm = m ? Number(m[2]) - 1 : new Date().getMonth();
    const from = new Date(y, mm, 1);
    const to = new Date(y, mm + 1, 0, 23, 59, 59, 999);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }, [monthKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      setMonthKey((cur) => (cur === next ? cur : next));
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
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
    if (!shouldUseDemoData()) return;
    void (async () => {
      try {
        await seedExpenseSeriesOncePerDay(activePetId, user.uid, series);
      } catch (err) {
        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Generazione ricorrenze fallita" });
      }
    })();
  }, [activePetId, pushToast, series, user]);

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
    if (!Number.isFinite(value) || value <= 0) {
      pushToast({ type: "error", title: "Importo non valido", message: "Inserisci un importo maggiore di 0." });
      return;
    }
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
      pushToast({ type: "success", title: "Spesa aggiunta", message: "Registrata correttamente." });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione spesa fallita" });
    } finally {
      setSaving(false);
    }
  }

  async function onAddSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    const value = Number(seriesAmount);
    const day = Number(seriesDay);
    if (!Number.isFinite(value) || value <= 0) {
      pushToast({ type: "error", title: "Importo non valido", message: "Inserisci un importo maggiore di 0." });
      return;
    }
    if (!Number.isFinite(day) || day < 1 || day > 28) {
      pushToast({ type: "error", title: "Giorno non valido", message: "Scegli un giorno tra 1 e 28." });
      return;
    }
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
      pushToast({ type: "success", title: "Ricorrenza aggiunta", message: "Verrà generata automaticamente." });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Creazione ricorrenza fallita" });
    } finally {
      setSavingSeries(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spese"
        description="Traccia costi per pet e monitora trend mensili."
        imagePrompt="minimal clean illustration, receipt and bar chart for pet expenses, soft white background, accent color, premium, no text, no watermark"
        imageAlt="Spese"
      />

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
                  ref={amountRef}
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
                                if (togglingSeriesId) return;
                                setTogglingSeriesId(s.id);
                                try {
                                  await setExpenseSeriesEnabled(activePetId, s.id, !s.enabled);
                                  if (!s.enabled) {
                                    await seedExpenseSeriesOncePerDay(activePetId, user?.uid ?? "system", [{ ...s, enabled: true }]);
                                  }
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Aggiornamento ricorrenza fallito" });
                                } finally {
                                  setTogglingSeriesId(null);
                                }
                              }}
                              disabled={togglingSeriesId === s.id}
                            >
                              {s.enabled ? "Attiva" : "Pausa"}
                            </button>
                            <button
                              type="button"
                              className="lp-btn-icon"
                              onClick={async () => {
                                if (!activePetId) return;
                                if (deletingSeriesId) return;
                                const ok = await confirmDialog({
                                  title: "Elimina ricorrenza",
                                  description: "Vuoi eliminare questa ricorrenza?",
                                  confirmLabel: "Elimina",
                                  variant: "danger",
                                });
                                if (!ok) return;
                                setDeletingSeriesId(s.id);
                                try {
                                  await deleteExpenseSeries(activePetId, s.id);
                                  pushToast({ type: "success", title: "Ricorrenza eliminata", message: "Rimossa." });
                                } catch (err) {
                                  pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione ricorrenza fallita" });
                                } finally {
                                  setDeletingSeriesId(null);
                                }
                              }}
                              disabled={deletingSeriesId === s.id}
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
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  className="lp-input"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                />
                <div className="text-lg font-semibold">€ {totalMonth.toFixed(2)}</div>
              </div>
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
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--lp-ink),0.10)" }}>
                      <div
                        className="h-2"
                        style={{
                          backgroundColor:
                            totalMonth > activePet.budgetMonthly ? "rgb(var(--lp-danger))" : "rgb(var(--lp-primary))",
                          width: `${Math.min(100, Math.round((totalMonth / activePet.budgetMonthly) * 100))}%`,
                        }}
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
                      if (budget.trim() && budgetValue === null) {
                        pushToast({ type: "error", title: "Budget non valido", message: "Inserisci un numero maggiore di 0 o lascia vuoto per rimuovere." });
                        return;
                      }
                      const v = budgetValue;
                      setSavingBudget(true);
                      try {
                        await updatePet(activePetId, {
                          budgetMonthly: v === null ? deleteField() : v,
                          budgetCurrency: "EUR",
                        });
                        pushToast({ type: "success", title: "Budget salvato", message: "Aggiornato correttamente." });
                      } catch (err) {
                        pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Salvataggio budget fallito" });
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
            <EmptyState
              title="Nessuna spesa"
              description="Aggiungi la prima spesa per costruire il trend."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="lp-btn-primary" onClick={focusAddExpense}>
                    Aggiungi spesa
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
                            if (!activePetId) return;
                            if (deletingExpenseId) return;
                            const ok = await confirmDialog({
                              title: "Elimina spesa",
                              description: "Vuoi eliminare questa spesa?",
                              confirmLabel: "Elimina",
                              variant: "danger",
                            });
                            if (!ok) return;
                            setDeletingExpenseId(it.id);
                            try {
                              await deleteExpense(activePetId, it.id);
                              pushToast({ type: "success", title: "Spesa eliminata", message: "Rimossa." });
                            } catch (err) {
                              pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione spesa fallita" });
                            } finally {
                              setDeletingExpenseId(null);
                            }
                          }}
                          className="lp-btn-icon"
                          disabled={deletingExpenseId === it.id}
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

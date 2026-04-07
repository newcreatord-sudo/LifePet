import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createListing, subscribeListings } from "@/data/marketplace";
import { aiChat } from "@/data/ai";
import { aiUserMessage } from "@/lib/aiErrors";
import type { ListingCategory, MarketplaceListing } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function categoryLabel(cat: ListingCategory) {
  if (cat === "food") return "Cibo";
  if (cat === "accessories") return "Accessori";
  if (cat === "medicine") return "Farmaci";
  if (cat === "services") return "Servizi";
  return "Altro";
}

export default function Marketplace() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const [items, setItems] = useState<MarketplaceListing[]>([]);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory>("accessories");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = subscribeListings(50, setItems);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => items, [items]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const v = Number(price);
    if (!Number.isFinite(v) || v < 0) return;
    setCreating(true);
    try {
      await createListing({
        sellerId: user.uid,
        createdAt: Date.now(),
        title: title.trim(),
        description: description.trim(),
        category,
        price: v,
        currency: "EUR",
        status: "active",
      });
      setTitle("");
      setDescription("");
      setPrice("");
      setCategory("accessories");
    } finally {
      setCreating(false);
    }
  }

  async function onSuggest() {
    if (!activePetId) return;
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const prompt = [
        "Suggerisci prodotti/servizi utili per questo pet.",
        "Restituisci testo semplice con 5 suggerimenti. Per ciascuno: nome, perché, e cosa evitare.",
        "Sii prudente con allergie/condizioni e consiglia il veterinario per prodotti medici.",
        "Profilo pet:",
        JSON.stringify({
          name: activePet?.name,
          species: activePet?.species,
          breed: activePet?.breed,
          weightKg: activePet?.weightKg,
          allergies: activePet?.healthProfile?.allergies,
          conditions: activePet?.healthProfile?.conditions,
        }),
      ].join("\n");
      const res = await aiChat(activePetId, null, prompt);
      setAiSuggestions(res.answer);
    } catch (e) {
      setAiSuggestions(aiUserMessage(e));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace" description="Scopri e offri prodotti o servizi per animali." />

      <Card>
        <CardHeader>
          <CardTitle>Crea annuncio</CardTitle>
          <CardDescription>Pubblica un prodotto o servizio.</CardDescription>
        </CardHeader>
        <CardContent>
        <form onSubmit={onCreate} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <label className="lg:col-span-4 block">
            <div className="text-xs text-slate-400 mb-1">Titolo</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="lg:col-span-3 block">
            <div className="text-xs text-slate-400 mb-1">Categoria</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
            >
              <option value="food">Cibo</option>
              <option value="accessories">Accessori</option>
              <option value="medicine">Farmaci</option>
              <option value="services">Servizi</option>
              <option value="other">Altro</option>
            </select>
          </label>
          <label className="lg:col-span-2 block">
            <div className="text-xs text-slate-400 mb-1">Prezzo (EUR)</div>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              required
              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={creating}
            className="lg:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
            type="submit"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creazione…" : "Pubblica"}
          </button>
          <label className="lg:col-span-12 block">
            <div className="text-xs text-slate-400 mb-1">Descrizione</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
            />
          </label>
        </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Suggerimenti AI</CardTitle>
              <CardDescription>Personalizzati sul pet attivo.</CardDescription>
            </div>
          <button
            onClick={onSuggest}
            disabled={aiLoading || !activePetId}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "…" : "Suggerisci"}
          </button>
        </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm whitespace-pre-wrap min-h-20">
            {activePetId ? aiSuggestions ?? "Genera suggerimenti su cibo, accessori e servizi." : "Seleziona un pet per personalizzare i suggerimenti."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annunci</CardTitle>
          <CardDescription>Contatto in-app in arrivo.</CardDescription>
        </CardHeader>
        <CardContent>
        {filtered.length === 0 ? (
          <EmptyState title="Nessun annuncio" description="Pubblica il primo annuncio per iniziare." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((it) => (
              <div key={it.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-semibold">{it.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{categoryLabel(it.category)} · € {it.price.toFixed(2)}</div>
                <div className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{it.description}</div>
                <div className="text-xs text-slate-500 mt-3">Pubblicato: {new Date(it.createdAt).toLocaleString()}</div>
                <div className="mt-3 text-xs text-slate-400">Il contatto verrà aggiunto con chat in-app sicura.</div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

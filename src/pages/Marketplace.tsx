import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Mail, Phone, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createListing, deleteListing, subscribeListings, updateListing } from "@/data/marketplace";
import { getListingPhotoUrl, uploadListingPhotos } from "@/data/marketplaceMedia";
import { aiChat } from "@/data/ai";
import { aiUserMessage } from "@/lib/aiErrors";
import type { ListingCategory, MarketplaceListing } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { subscribeUserProfile } from "@/data/users";
import { useToastStore } from "@/stores/toastStore";

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
  const pushToast = useToastStore((s) => s.push);

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [aiAllowed, setAiAllowed] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory>("accessories");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);

  const [queryText, setQueryText] = useState("");
  const [filterCategory, setFilterCategory] = useState<ListingCategory | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [openListing, setOpenListing] = useState<MarketplaceListing | null>(null);
  const [openIdx, setOpenIdx] = useState(0);

  function parseCategory(v: string): ListingCategory | "all" {
    if (v === "food" || v === "accessories" || v === "medicine" || v === "services" || v === "other") return v;
    return "all";
  }

  const openPhotos = useMemo(() => {
    if (!openListing) return [];
    return (openListing.photoPaths ?? []).map((p) => ({ path: p, url: photoUrls[p] })).filter((x) => x.url);
  }, [openListing, photoUrls]);

  useEffect(() => {
    const unsub = subscribeListings(50, setItems);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) {
      setAiAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setAiAllowed(p?.preferences?.aiEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const min = Number(minPrice);
    const max = Number(maxPrice);
    return items
      .filter((it) => it.status === "active")
      .filter((it) => (filterCategory === "all" ? true : it.category === filterCategory))
      .filter((it) => (Number.isFinite(min) ? it.price >= min : true))
      .filter((it) => (Number.isFinite(max) ? it.price <= max : true))
      .filter((it) => (onlyWithPhotos ? (it.photoPaths?.length ?? 0) > 0 : true))
      .filter((it) => (q ? `${it.title} ${it.description}`.toLowerCase().includes(q) : true));
  }, [filterCategory, items, maxPrice, minPrice, onlyWithPhotos, queryText]);

  useEffect(() => {
    const paths = new Set<string>();
    for (const it of items) for (const p of it.photoPaths ?? []) paths.add(p);
    const missing = Array.from(paths).filter((p) => !photoUrls[p]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: Array<[string, string]> = [];
      for (const p of missing.slice(0, 30)) {
        try {
          const url = await getListingPhotoUrl(p);
          entries.push([p, url]);
        } catch {
          continue;
        }
      }
      if (cancelled) return;
      if (entries.length) setPhotoUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [items, photoUrls]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const v = Number(price);
    if (!Number.isFinite(v) || v < 0) return;
    setCreating(true);
    try {
      const id = await createListing({
        sellerId: user.uid,
        createdAt: Date.now(),
        title: title.trim(),
        description: description.trim(),
        category,
        price: v,
        currency: "EUR",
        status: "active",
        contact: contact.trim() || undefined,
      });
      if (photos.length) {
        const paths = await uploadListingPhotos(id, photos.slice(0, 6));
        if (paths.length) await updateListing(id, { photoPaths: paths });
      }
      setTitle("");
      setDescription("");
      setPrice("");
      setCategory("accessories");
      setContact("");
      setPhotos([]);
      pushToast({ type: "success", title: "Annuncio", message: "Pubblicato." });
    } catch (err) {
      pushToast({ type: "error", title: "Annuncio", message: err instanceof Error ? err.message : "Pubblicazione fallita" });
    } finally {
      setCreating(false);
    }
  }

  function contactHref(value: string) {
    const v = value.trim();
    if (!v) return null;
    if (v.includes("@")) return `mailto:${v}`;
    return `tel:${v}`;
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
      const msg = aiUserMessage(e);
      setAiSuggestions(msg);
      pushToast({ type: "error", title: "Errore AI", message: msg });
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
            <div className="text-xs text-slate-600 mb-1">Titolo</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="lp-input"
            />
          </label>
          <label className="lg:col-span-3 block">
            <div className="text-xs text-slate-600 mb-1">Categoria</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              className="lp-select"
            >
              <option value="food">Cibo</option>
              <option value="accessories">Accessori</option>
              <option value="medicine">Farmaci</option>
              <option value="services">Servizi</option>
              <option value="other">Altro</option>
            </select>
          </label>
          <label className="lg:col-span-2 block">
            <div className="text-xs text-slate-600 mb-1">Prezzo (EUR)</div>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              required
              className="lp-input"
            />
          </label>
          <button
            disabled={creating}
            className="lg:col-span-3 lp-btn-primary inline-flex items-center justify-center gap-2"
            type="submit"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creazione…" : "Pubblica"}
          </button>
          <label className="lg:col-span-12 block">
            <div className="text-xs text-slate-600 mb-1">Descrizione</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              className="lp-textarea"
            />
          </label>
          <label className="lg:col-span-12 block">
            <div className="text-xs text-slate-600 mb-1">Contatto (email o telefono, opzionale)</div>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="es. nome@email.com oppure +39..."
              className="lp-input"
            />
          </label>

          <label className="lg:col-span-12 block">
            <div className="text-xs text-slate-600 mb-1">Foto (max 6)</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 6))}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-sky-500"
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
            disabled={aiLoading || !activePetId || !aiAllowed}
            className="lp-btn-primary inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "…" : "Suggerisci"}
          </button>
        </div>
        </CardHeader>
        <CardContent>
          <div className="lp-panel p-3 text-sm whitespace-pre-wrap min-h-20">
            {activePetId ? aiSuggestions ?? "Genera suggerimenti su cibo, accessori e servizi." : "Seleziona un pet per personalizzare i suggerimenti."}
          </div>
          {!aiAllowed ? <div className="mt-2 text-xs text-slate-600">AI disattivata: riattivala in Impostazioni → Preferenze.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annunci</CardTitle>
          <CardDescription>Contatta il venditore tramite email/telefono (se fornito).</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end mb-4">
          <div className="lg:col-span-5">
            <div className="text-xs text-slate-600 mb-1">Cerca</div>
            <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2">
              <Search className="w-4 h-4 text-slate-600" />
              <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="titolo, descrizione…" className="w-full bg-transparent outline-none text-sm" />
            </div>
          </div>
          <label className="lg:col-span-3 block">
            <div className="text-xs text-slate-600 mb-1">Categoria</div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(parseCategory(e.target.value))} className="lp-select">
              <option value="all">Tutte</option>
              <option value="food">Cibo</option>
              <option value="accessories">Accessori</option>
              <option value="medicine">Farmaci</option>
              <option value="services">Servizi</option>
              <option value="other">Altro</option>
            </select>
          </label>
          <label className="lg:col-span-2 block">
            <div className="text-xs text-slate-600 mb-1">Min €</div>
            <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} inputMode="decimal" className="lp-input" />
          </label>
          <label className="lg:col-span-2 block">
            <div className="text-xs text-slate-600 mb-1">Max €</div>
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} inputMode="decimal" className="lp-input" />
          </label>
          <label className="lg:col-span-12 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyWithPhotos} onChange={(e) => setOnlyWithPhotos(e.target.checked)} />
            Solo con foto
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nessun annuncio" description="Pubblica il primo annuncio per iniziare." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((it) => (
              <div key={it.id} className="lp-card p-4">
                {(it.photoPaths?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(it.photoPaths ?? []).slice(0, 3).map((p) => {
                      const url = photoUrls[p];
                      return url ? (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setOpenListing(it);
                            setOpenIdx(0);
                          }}
                          className="h-24 w-full overflow-hidden rounded-xl border border-slate-200/70"
                        >
                          <img src={url} className="h-24 w-full object-cover" />
                        </button>
                      ) : (
                        <div key={p} className="h-24 rounded-xl border border-slate-200/70 bg-slate-100/60 grid place-items-center">
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="text-sm font-semibold">{it.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{categoryLabel(it.category)} · € {it.price.toFixed(2)}</div>
                <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{it.description}</div>
                <div className="text-xs text-slate-600 mt-3">Pubblicato: {new Date(it.createdAt).toLocaleString()}</div>
                <div className="mt-3 flex items-center gap-2">
                  {it.contact ? (
                    <a
                      href={contactHref(it.contact) ?? undefined}
                      className="lp-btn-icon inline-flex items-center gap-2"
                    >
                      {it.contact.includes("@") ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      Contatta
                    </a>
                  ) : (
                    <div className="text-xs text-slate-600">Contatto non disponibile.</div>
                  )}

                  {user && it.sellerId === user.uid ? (
                    <>
                      <button
                        onClick={async () => {
                          await updateListing(it.id, { status: "sold" });
                        }}
                        className="lp-btn-secondary"
                      >
                        Segna venduto
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Eliminare questo annuncio?")) return;
                          await deleteListing(it.id);
                        }}
                        className="lp-btn-icon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenListing(it);
                      setOpenIdx(0);
                    }}
                    className="lp-btn-secondary"
                  >
                    Apri dettagli
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {openListing ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-auto" onClick={() => setOpenListing(null)}>
          <div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="lp-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{openListing.title}</div>
                  <div className="text-sm text-slate-700">{categoryLabel(openListing.category)} · € {openListing.price.toFixed(2)}</div>
                </div>
                <button onClick={() => setOpenListing(null)} className="lp-btn-icon" type="button">
                  Chiudi
                </button>
              </div>

              {openPhotos.length > 0 ? (
                <div className="mt-3">
                  <div className="rounded-2xl border border-slate-200/70 overflow-hidden bg-slate-50">
                    <img src={openPhotos[Math.min(openIdx, openPhotos.length - 1)]?.url} className="w-full max-h-[420px] object-contain" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={() => setOpenIdx((i) => Math.max(0, i - 1))}
                      disabled={openIdx <= 0}
                    >
                      Precedente
                    </button>
                    <div className="text-xs text-slate-600">{openIdx + 1} / {openPhotos.length}</div>
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      onClick={() => setOpenIdx((i) => Math.min(openPhotos.length - 1, i + 1))}
                      disabled={openIdx >= openPhotos.length - 1}
                    >
                      Successiva
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {openPhotos.slice(0, 6).map((p, idx) => (
                      <button
                        key={p.path}
                        type="button"
                        onClick={() => setOpenIdx(idx)}
                        className={
                          idx === openIdx
                            ? "h-14 rounded-xl overflow-hidden border border-sky-600/40"
                            : "h-14 rounded-xl overflow-hidden border border-slate-200/70"
                        }
                      >
                        <img src={p.url} className="h-14 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">Nessuna foto.</div>
              )}

              <div className="mt-3 text-sm text-slate-800 whitespace-pre-wrap">{openListing.description}</div>

              <div className="mt-4 flex items-center gap-2">
                {openListing.contact ? (
                  <a href={contactHref(openListing.contact) ?? undefined} className="lp-btn-primary inline-flex items-center gap-2">
                    {openListing.contact.includes("@") ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    Contatta
                  </a>
                ) : (
                  <div className="text-sm text-slate-600">Contatto non disponibile.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Mail, Phone, Plus, Receipt, Search, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
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
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { subscribeUserProfile } from "@/data/users";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmDialog } from "@/components/confirm";

function categoryLabel(cat: ListingCategory) {
  if (cat === "food") return "Cibo";
  if (cat === "accessories") return "Accessori";
  if (cat === "medicine") return "Farmaci";
  if (cat === "services") return "Servizi";
  return "Altro";
}

function expenseCategoryFromListing(cat: ListingCategory): "food" | "vet" | "medicine" | "grooming" | "training" | "accessories" | "other" {
  if (cat === "food") return "food";
  if (cat === "medicine") return "medicine";
  if (cat === "services") return "vet";
  if (cat === "accessories") return "accessories";
  return "other";
}

export default function Marketplace() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();

  const [loaded, setLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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

  const [busyListingId, setBusyListingId] = useState<string | null>(null);

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
    setLoaded(false);
    setInlineError(null);
    if (!user) {
      setItems([]);
      setLoaded(true);
      return;
    }
    const unsub = subscribeListings(
      50,
      (next) => {
        setItems(next);
        setLoaded(true);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : "Caricamento annunci fallito";
        setInlineError(msg);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [user]);

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

  function expensePrefillUrl(listing: MarketplaceListing) {
    const sp = new URLSearchParams();
    sp.set("amount", listing.price.toFixed(2));
    sp.set("category", expenseCategoryFromListing(listing.category));
    sp.set("note", `Marketplace: ${listing.title}`);
    return `/app/expenses?${sp.toString()}`;
  }

  const selectedIds = useMemo(() => {
    if (!user) return [] as string[];
    return filtered.filter((it) => it.sellerId === user.uid && selected[it.id]).map((it) => it.id);
  }, [filtered, selected, user]);

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
    setInlineError(null);
    const t = title.trim();
    const d = description.trim();
    const v = Number(price.replace(",", "."));
    if (!t || !d) {
      setInlineError("Titolo e descrizione sono obbligatori.");
      pushToast({ type: "error", title: "Annuncio", message: "Titolo e descrizione sono obbligatori." });
      return;
    }
    if (!Number.isFinite(v) || v < 0) {
      setInlineError("Prezzo non valido.");
      pushToast({ type: "error", title: "Annuncio", message: "Prezzo non valido." });
      return;
    }
    if (photos.some((p) => p.size > 10 * 1024 * 1024)) {
      setInlineError("Ogni foto deve essere massimo 10MB.");
      pushToast({ type: "error", title: "Annuncio", message: "Ogni foto deve essere massimo 10MB." });
      return;
    }
    setCreating(true);
    try {
      const id = await createListing({
        sellerId: user.uid,
        createdAt: Date.now(),
        title: t,
        description: d,
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
      setInlineError(err instanceof Error ? err.message : "Pubblicazione fallita");
      pushToast({ type: "error", title: "Annuncio", message: err instanceof Error ? err.message : "Pubblicazione fallita" });
    } finally {
      setCreating(false);
    }
  }

  async function onMarkSold(listing: MarketplaceListing) {
    if (busyListingId) return;
    setBusyListingId(listing.id);
    setInlineError(null);
    try {
      await updateListing(listing.id, { status: "sold" });
      pushToast({ type: "success", title: "Annuncio", message: "Segnato come venduto." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Aggiornamento fallito");
      pushToast({ type: "error", title: "Annuncio", message: err instanceof Error ? err.message : "Aggiornamento fallito" });
    } finally {
      setBusyListingId(null);
    }
  }

  async function onDeleteListing(listing: MarketplaceListing) {
    if (busyListingId) return;
    const ok = await confirmDialog({
      title: "Elimina annuncio",
      description: "Vuoi eliminare questo annuncio?",
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setBusyListingId(listing.id);
    setInlineError(null);
    try {
      await deleteListing(listing.id);
      pushToast({ type: "success", title: "Annuncio", message: "Eliminato." });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Eliminazione fallita");
      pushToast({ type: "error", title: "Annuncio", message: err instanceof Error ? err.message : "Eliminazione fallita" });
    } finally {
      setBusyListingId(null);
    }
  }

  async function batchMarkSold() {
    if (!selectedIds.length) return;
    if (busyListingId) return;
    setBusyListingId("__batch__");
    setInlineError(null);
    try {
      for (const id of selectedIds) await updateListing(id, { status: "sold" });
      setSelected({});
      pushToast({ type: "success", title: "Annunci", message: "Segnati come venduti." });
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Operazione fallita");
      pushToast({ type: "error", title: "Annunci", message: e instanceof Error ? e.message : "Operazione fallita" });
    } finally {
      setBusyListingId(null);
    }
  }

  async function batchDelete() {
    if (!selectedIds.length) return;
    if (busyListingId) return;
    const ok = await confirmDialog({
      title: "Elimina annunci",
      description: `Vuoi eliminare ${selectedIds.length} annunci selezionati?`,
      confirmLabel: "Elimina",
      variant: "danger",
    });
    if (!ok) return;
    setBusyListingId("__batch__");
    setInlineError(null);
    try {
      for (const id of selectedIds) await deleteListing(id);
      setSelected({});
      pushToast({ type: "success", title: "Annunci", message: "Annunci eliminati." });
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Eliminazione fallita");
      pushToast({ type: "error", title: "Annunci", message: e instanceof Error ? e.message : "Eliminazione fallita" });
    } finally {
      setBusyListingId(null);
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
      <PageHeader
        title="Marketplace"
        description="Scopri e offri prodotti o servizi per animali."
        imagePrompt="minimal clean illustration, shopping tag and pet accessory icons, airy background, accent color, premium, no text, no watermark"
        imageAlt="Marketplace"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Annunci</CardTitle>
                  <CardDescription>Contatta il venditore tramite email/telefono (se fornito).</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
                {selectedIds.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => setSelected({})} disabled={busyListingId === "__batch__"}>
                      Deseleziona
                    </button>
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => void batchDelete()} disabled={busyListingId === "__batch__"}>
                      Elimina ({selectedIds.length})
                    </button>
                    <button type="button" className="lp-btn-primary px-3 py-2 text-xs" onClick={() => void batchMarkSold()} disabled={busyListingId === "__batch__"}>
                      Venduto ({selectedIds.length})
                    </button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
        {inlineError ? (
          <div className="mb-3">
            <Alert variant="danger" title="Errore">{inlineError}</Alert>
          </div>
        ) : null}

              {!user ? (
                <EmptyState
                  title="Accedi per usare il marketplace"
                  description="Per vedere e pubblicare annunci devi accedere."
                  action={
                    <Link to="/login" className="lp-btn-primary inline-flex items-center justify-center">
                      Vai al login
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-5">
                      <div className="text-xs lp-muted mb-1">Cerca</div>
                      <div className="flex items-center gap-2 lp-panel px-3 py-2">
                        <Search className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
                        <input
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder="titolo, descrizione…"
                          className="w-full bg-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                    <label className="lg:col-span-3 block">
                      <div className="text-xs lp-muted mb-1">Categoria</div>
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
                      <div className="text-xs lp-muted mb-1">Min €</div>
                      <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} inputMode="decimal" className="lp-input" />
                    </label>
                    <label className="lg:col-span-2 block">
                      <div className="text-xs lp-muted mb-1">Max €</div>
                      <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} inputMode="decimal" className="lp-input" />
                    </label>
                    <label className="lg:col-span-12 inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={onlyWithPhotos} onChange={(e) => setOnlyWithPhotos(e.target.checked)} />
                      Solo con foto
                    </label>
                  </div>

                  {!loaded ? (
                    <div className="grid gap-2">
                      <SkeletonCard rows={2} />
                      <SkeletonCard rows={2} />
                      <SkeletonCard rows={2} />
                    </div>
                  ) : filtered.length === 0 ? (
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
                          className="h-24 w-full overflow-hidden rounded-xl border border-[rgba(var(--lp-ink),0.12)]"
                        >
                          <img
                            src={url}
                            alt={`${it.title} — foto`}
                            className="h-24 w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ) : (
                        <div key={p} className="h-24 rounded-xl border border-[rgba(var(--lp-ink),0.12)] bg-[rgba(var(--lp-ink),0.04)] grid place-items-center">
                          <ImageIcon className="w-5 h-5" style={{ color: "rgb(var(--lp-muted))" }} />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{it.title}</div>
                    <div className="text-xs lp-muted mt-0.5">{categoryLabel(it.category)} · € {it.price.toFixed(2)}</div>
                  </div>
                  {user && it.sellerId === user.uid ? (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selected[it.id])}
                      onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                      aria-label="Seleziona annuncio"
                    />
                  ) : null}
                </div>
                <div className="text-sm mt-2 whitespace-pre-wrap">{it.description}</div>
                <div className="text-xs lp-muted mt-3">Pubblicato: {new Date(it.createdAt).toLocaleString()}</div>
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
                    <div className="text-xs lp-muted">Contatto non disponibile.</div>
                  )}

                  {user && activePetId ? (
                    <Link to={expensePrefillUrl(it)} className="lp-btn-secondary inline-flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Aggiungi spesa
                    </Link>
                  ) : user ? (
                    <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Seleziona pet
                    </Link>
                  ) : null}

                  {user && it.sellerId === user.uid ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void onMarkSold(it)}
                        className="lp-btn-secondary"
                        disabled={busyListingId === it.id || busyListingId === "__batch__"}
                      >
                        Segna venduto
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteListing(it)}
                        className="lp-btn-icon"
                        disabled={busyListingId === it.id || busyListingId === "__batch__"}
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit">
          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <CardTitle>Crea annuncio</CardTitle>
              <CardDescription>Pubblica un prodotto o servizio.</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <EmptyState
                  title="Accedi per pubblicare"
                  description="Per creare annunci devi accedere."
                  action={
                    <Link to="/login" className="lp-btn-primary inline-flex items-center justify-center">
                      Vai al login
                    </Link>
                  }
                />
              ) : (
                <form onSubmit={onCreate} className="grid grid-cols-1 gap-3">
                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Titolo</div>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} required className="lp-input" />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Categoria</div>
                      <select value={category} onChange={(e) => setCategory(e.target.value as ListingCategory)} className="lp-select">
                        <option value="food">Cibo</option>
                        <option value="accessories">Accessori</option>
                        <option value="medicine">Farmaci</option>
                        <option value="services">Servizi</option>
                        <option value="other">Altro</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs lp-muted mb-1">Prezzo (EUR)</div>
                      <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required className="lp-input" />
                    </label>
                  </div>
                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Descrizione</div>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required className="lp-textarea" />
                  </label>
                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Contatto (email o telefono, opzionale)</div>
                    <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="es. nome@email.com oppure +39..." className="lp-input" />
                  </label>

                  <label className="block">
                    <div className="text-xs lp-muted mb-1">Foto (max 6)</div>
                    <input type="file" multiple accept="image/*" onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 6))} className="lp-file-input" />
                  </label>

                  <button disabled={creating} className="lp-btn-primary inline-flex items-center justify-center gap-2" type="submit">
                    <Plus className="w-4 h-4" />
                    {creating ? "Creazione…" : "Pubblica"}
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Suggerimenti AI</CardTitle>
                  <CardDescription>Personalizzati sul pet attivo.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
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
              {!aiAllowed ? <div className="mt-2 text-xs lp-muted">AI disattivata: riattivala in Impostazioni → Preferenze.</div> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {openListing ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-auto" onClick={() => setOpenListing(null)}>
          <div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="lp-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{openListing.title}</div>
                  <div className="text-sm lp-muted">{categoryLabel(openListing.category)} · € {openListing.price.toFixed(2)}</div>
                </div>
                <button onClick={() => setOpenListing(null)} className="lp-btn-icon" type="button">
                  Chiudi
                </button>
              </div>

              {openPhotos.length > 0 ? (
                <div className="mt-3">
                  <div className="rounded-2xl border border-[rgba(var(--lp-ink),0.12)] overflow-hidden bg-[rgba(var(--lp-ink),0.03)]">
                    <img
                      src={openPhotos[Math.min(openIdx, openPhotos.length - 1)]?.url}
                      alt={`${openListing.title} — foto ${openIdx + 1}`}
                      className="w-full max-h-[420px] object-contain"
                      loading="eager"
                      decoding="async"
                    />
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
                    <div className="text-xs lp-muted">{openIdx + 1} / {openPhotos.length}</div>
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
                        className="h-14 rounded-xl overflow-hidden border"
                        style={
                          idx === openIdx
                            ? { borderColor: "rgba(var(--lp-primary),0.40)" }
                            : { borderColor: "rgba(var(--lp-ink),0.10)" }
                        }
                      >
                        <img
                          src={p.url}
                          alt={`${openListing.title} — miniatura ${idx + 1}`}
                          className="h-14 w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm lp-muted">Nessuna foto.</div>
              )}

              <div className="mt-3 text-sm whitespace-pre-wrap">{openListing.description}</div>

              <div className="mt-4 flex items-center gap-2">
                {openListing.contact ? (
                  <a href={contactHref(openListing.contact) ?? undefined} className="lp-btn-primary inline-flex items-center gap-2">
                    {openListing.contact.includes("@") ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    Contatta
                  </a>
                ) : (
                  <div className="text-sm lp-muted">Contatto non disponibile.</div>
                )}

                {user && activePetId ? (
                  <Link to={expensePrefillUrl(openListing)} className="lp-btn-secondary inline-flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Aggiungi spesa
                  </Link>
                ) : user ? (
                  <Link to="/app/pets" className="lp-btn-secondary inline-flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Seleziona pet
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

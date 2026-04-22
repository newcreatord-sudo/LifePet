import { useEffect, useMemo, useRef, useState } from "react";
import { HeartHandshake, MessageSquare, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { createAdoption, deleteAdoption, reportAdoption, seedDemoAdoptions, subscribeAdoptions, subscribeMyAdoptions, updateAdoption } from "@/data/adoptions";
import type { AdoptionPost } from "@/types";
import { ensureDefaultGroups, joinGroup, sendGroupMessage } from "@/data/groups";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/confirm";
import { DEFAULT_ADOPTION_QUIZ, mergeTemperamentTags, scoreAdoption, type AdoptionQuiz } from "@/lib/adoptionMatch";

type Tab = "match" | "posts" | "mine";

const PROFILE_TAGS: Array<{ tag: string; label: string; help: string }> = [
  { tag: "kids_ok", label: "Bambini ok", help: "Adatto a famiglie con bambini" },
  { tag: "no_kids", label: "No bambini", help: "Meglio senza bambini" },
  { tag: "cats_ok", label: "Gatti ok", help: "Convivere con gatti" },
  { tag: "dogs_ok", label: "Cani ok", help: "Convivere con altri cani" },
  { tag: "only_pet", label: "Figlio unico", help: "Preferisce essere unico animale" },
  { tag: "energy_low", label: "Tranquillo", help: "Bassa energia" },
  { tag: "energy_high", label: "Molto attivo", help: "Alta energia" },
  { tag: "apt_ok", label: "Appartamento", help: "Ok in casa/appartamento" },
  { tag: "needs_yard", label: "Serve giardino", help: "Preferisce spazio esterno" },
  { tag: "first_time_ok", label: "Prima esperienza", help: "Ok per principianti" },
  { tag: "special_needs", label: "Bisogni speciali", help: "Richiede cure/attenzioni" },
];

export default function Adoptions() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();

  const [tab, setTab] = useState<Tab>("match");
  const [posts, setPosts] = useState<AdoptionPost[]>([]);
  const [myPosts, setMyPosts] = useState<AdoptionPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [myLoaded, setMyLoaded] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [species, setSpecies] = useState("dog");
  const [name, setName] = useState("");
  const [ageLabel, setAgeLabel] = useState("");
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [locationLabel, setLocationLabel] = useState("");
  const [temperament, setTemperament] = useState("");
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [shelterLabel, setShelterLabel] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("Segnala");
  const [reportReason, setReportReason] = useState("");
  const reportSubmitRef = useRef<null | ((reason: string) => Promise<void>)>(null);

  function openReport(title: string, submit: (reason: string) => Promise<void>) {
    setReportTitle(title);
    setReportReason("");
    reportSubmitRef.current = submit;
    setReportOpen(true);
  }

  function validateDraft() {
    const s = species.trim();
    const desc = description.trim();
    if (!s) return "Inserisci la specie.";
    if (s.length > 16) return "Specie troppo lunga.";
    if (!desc || desc.length < 10) return "Descrizione troppo corta (min 10 caratteri).";
    if (desc.length > 2000) return "Descrizione troppo lunga (max 2000 caratteri).";
    if (name.trim().length > 40) return "Nome troppo lungo.";
    if (ageLabel.trim().length > 32) return "Età troppo lunga.";
    if (locationLabel.trim().length > 60) return "Località troppo lunga.";
    if (shelterLabel.trim().length > 80) return "Struttura troppo lunga.";
    const tags = mergeTemperamentTags(temperament, profileTags);
    if (tags.length > 12) return "Troppi tag (max 12).";
    if (tags.some((t) => t.length > 24)) return "Ogni tag deve essere max 24 caratteri.";
    return null;
  }

  const [quiz, setQuiz] = useState<AdoptionQuiz>(DEFAULT_ADOPTION_QUIZ);

  useEffect(() => {
    seedDemoAdoptions();
    setLoaded(false);
    setInlineError(null);
    const unsub = subscribeAdoptions(
      60,
      { status: "active" },
      (items) => {
        setPosts(items);
        setLoaded(true);
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento annunci fallito");
        setLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setMyLoaded(false);
    if (!user) {
      setMyPosts([]);
      setMyLoaded(true);
      return;
    }
    const unsub = subscribeMyAdoptions(
      user.uid,
      60,
      {},
      (items) => {
        setMyPosts(items);
        setMyLoaded(true);
      },
      (err) => {
        setInlineError(err instanceof Error ? err.message : "Caricamento miei annunci fallito");
        setMyLoaded(true);
      }
    );
    return () => unsub();
  }, [user]);

  const scored = useMemo(() => {
    const items = posts
      .filter((p) => p.status === "active")
      .map((p) => ({ p, ...scoreAdoption(p, quiz) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.createdAt - a.p.createdAt);
    return items;
  }, [posts, quiz]);

  const recommended = useMemo(() => scored.slice(0, 12), [scored]);

  const matchNotes = useMemo(() => {
    const notes: string[] = [];
    if (quiz.home === "apartment") notes.push("Casa: appartamento → preferisci pet calmi e adattabili.");
    if (quiz.home !== "apartment") notes.push("Casa con esterno → puoi valutare pet più energici.");
    if (quiz.time === "low") notes.push("Tempo limitato → evita profili ad alta energia o con bisogni speciali.");
    if (quiz.kids !== "none") notes.push("Famiglia con bambini → cerca tag “Bambini ok”.");
    if (quiz.otherPets !== "none") notes.push("Altri animali in casa → cerca tag “Cani ok / Gatti ok” ed evita “Figlio unico”.");
    if (quiz.experience === "none") notes.push("Prima esperienza → cerca “Prima esperienza”.");
    return notes.slice(0, 4);
  }, [quiz.experience, quiz.home, quiz.kids, quiz.otherPets, quiz.time]);

  async function submitAdoption() {
    if (!user) return;
    const v = validateDraft();
    if (v) {
      pushToast({ type: "error", title: "Annuncio", message: v });
      return;
    }
    const desc = description.trim();
    setPosting(true);
    try {
      await ensureDefaultGroups();
      await joinGroup("adoptions", user.uid);
      const tags = mergeTemperamentTags(temperament, profileTags);
      const input: Omit<AdoptionPost, "id"> = {
        createdAt: Date.now(),
        createdBy: user.uid,
        status: "active",
        species: species.trim() || "other",
        name: name.trim() || undefined,
        ageLabel: ageLabel.trim() || undefined,
        size,
        temperamentTags: tags.length ? tags : undefined,
        description: desc,
        locationLabel: locationLabel.trim() || undefined,
        shelterLabel: shelterLabel.trim() || undefined,
        reportCount: 0,
        updatedAt: Date.now(),
      };
      const id = await createAdoption(input);
      const preview = `${input.species.toUpperCase()}${input.name ? ` · ${input.name}` : ""}${input.locationLabel ? ` · ${input.locationLabel}` : ""}`;
      await sendGroupMessage("adoptions", {
        groupId: "adoptions",
        authorId: user.uid,
        createdAt: Date.now(),
        text:
          `Nuovo annuncio adozione (${preview})\n` +
          `${input.description}\n` +
          `${input.temperamentTags?.length ? `Tag: ${input.temperamentTags.join(", ")}\n` : ""}` +
          `${input.shelterLabel ? `Struttura: ${input.shelterLabel}\n` : ""}` +
          `ID: ${id}`,
      });
      setFormOpen(false);
      setName("");
      setAgeLabel("");
      setLocationLabel("");
      setTemperament("");
      setProfileTags([]);
      setDescription("");
      setShelterLabel("");
      pushToast({ type: "success", title: "Annuncio", message: "Pubblicato." });
      setTab("posts");
    } catch (e) {
      pushToast({ type: "error", title: "Annuncio", message: e instanceof Error ? e.message : "Pubblicazione fallita" });
    } finally {
      setPosting(false);
    }
  }

  async function setMyStatus(p: AdoptionPost, status: AdoptionPost["status"]) {
    if (!user) return;
    try {
      await updateAdoption(p.id, { status, updatedAt: Date.now() });
      pushToast({ type: "success", title: "Adozioni", message: "Aggiornato." });
    } catch (e) {
      pushToast({ type: "error", title: "Adozioni", message: e instanceof Error ? e.message : "Aggiornamento fallito" });
    }
  }

  async function deleteMyPost(p: AdoptionPost) {
    const ok = await confirmDialog({ title: "Elimina annuncio", description: "Vuoi eliminare questo annuncio?", confirmLabel: "Elimina", variant: "danger" });
    if (!ok) return;
    try {
      await deleteAdoption(p.id);
      pushToast({ type: "success", title: "Adozioni", message: "Eliminato." });
    } catch (e) {
      pushToast({ type: "error", title: "Adozioni", message: e instanceof Error ? e.message : "Eliminazione fallita" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adozioni"
        description="Aiutiamo a svuotare i canili. Dai una casa a chi ne ha bisogno."
        imagePrompt="minimal clean illustration, heart and paw icon, adoption concept, premium, airy, no text, no watermark"
      />

      <Modal open={reportOpen} title={reportTitle} description="Inserisci un motivo (opzionale)." onClose={() => setReportOpen(false)}>
        <div className="grid gap-3">
          <textarea className="lp-textarea min-h-[110px]" value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setReportOpen(false)}>
              Annulla
            </button>
            <button
              type="button"
              className="lp-btn-primary"
              onClick={async () => {
                const fn = reportSubmitRef.current;
                if (!fn) {
                  setReportOpen(false);
                  return;
                }
                try {
                  await fn(reportReason);
                  pushToast({ type: "success", title: "Segnalazione", message: "Invitata." });
                } catch (e) {
                  pushToast({ type: "error", title: "Segnalazione", message: e instanceof Error ? e.message : "Invio fallito" });
                } finally {
                  setReportOpen(false);
                }
              }}
            >
              Invia
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center gap-2">
        <button type="button" className={tab === "match" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setTab("match")}>Match</button>
        <button type="button" className={tab === "posts" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setTab("posts")}>Annunci</button>
        {user ? (
          <button type="button" className={tab === "mine" ? "lp-chip lp-chip-active" : "lp-chip"} onClick={() => setTab("mine")}>
            I miei
          </button>
        ) : null}
        <div className="flex-1" />
        <button type="button" className="lp-btn-primary" onClick={() => setFormOpen(true)} disabled={!user || posting}>
          <Plus className="w-4 h-4" /> Inserisci annuncio
        </button>
      </div>

      {inlineError ? (
        <Alert variant="danger" title="Errore">{inlineError}</Alert>
      ) : null}

      {tab === "match" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Questionario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Preferenza</div>
                  <select className="lp-input" value={quiz.preference} onChange={(e) => setQuiz((p) => ({ ...p, preference: e.target.value as AdoptionQuiz["preference"] }))}>
                    <option value="any">Indifferente</option>
                    <option value="dog">Cane</option>
                    <option value="cat">Gatto</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Casa</div>
                  <select className="lp-input" value={quiz.home} onChange={(e) => setQuiz((p) => ({ ...p, home: e.target.value as AdoptionQuiz["home"] }))}>
                    <option value="apartment">Appartamento</option>
                    <option value="house_small_yard">Casa con piccolo esterno</option>
                    <option value="house_big_yard">Casa con grande esterno</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Tempo disponibile</div>
                  <select className="lp-input" value={quiz.time} onChange={(e) => setQuiz((p) => ({ ...p, time: e.target.value as AdoptionQuiz["time"] }))}>
                    <option value="low">Poco</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Spazio interno</div>
                  <select className="lp-input" value={quiz.space} onChange={(e) => setQuiz((p) => ({ ...p, space: e.target.value as AdoptionQuiz["space"] }))}>
                    <option value="small">Piccolo</option>
                    <option value="medium">Medio</option>
                    <option value="large">Grande</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Esperienza</div>
                  <select className="lp-input" value={quiz.experience} onChange={(e) => setQuiz((p) => ({ ...p, experience: e.target.value as AdoptionQuiz["experience"] }))}>
                    <option value="none">Prima esperienza</option>
                    <option value="some">Ho già avuto animali</option>
                    <option value="expert">Esperto</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Attività desiderata</div>
                  <select className="lp-input" value={quiz.activity} onChange={(e) => setQuiz((p) => ({ ...p, activity: e.target.value as AdoptionQuiz["activity"] }))}>
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Bambini</div>
                  <select className="lp-input" value={quiz.kids} onChange={(e) => setQuiz((p) => ({ ...p, kids: e.target.value as AdoptionQuiz["kids"] }))}>
                    <option value="none">No</option>
                    <option value="young">Sì, piccoli</option>
                    <option value="teens">Sì, grandi</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Altri animali in casa</div>
                  <select className="lp-input" value={quiz.otherPets} onChange={(e) => setQuiz((p) => ({ ...p, otherPets: e.target.value as AdoptionQuiz["otherPets"] }))}>
                    <option value="none">No</option>
                    <option value="dog">Ho un cane</option>
                    <option value="cat">Ho un gatto</option>
                    <option value="both">Cane e gatto</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Ore da solo (tipico)</div>
                  <select className="lp-input" value={quiz.aloneTime} onChange={(e) => setQuiz((p) => ({ ...p, aloneTime: e.target.value as AdoptionQuiz["aloneTime"] }))}>
                    <option value="low">Poche</option>
                    <option value="medium">Medie</option>
                    <option value="high">Molte</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Tolleranza rumore</div>
                  <select
                    className="lp-input"
                    value={quiz.noiseTolerance}
                    onChange={(e) => setQuiz((p) => ({ ...p, noiseTolerance: e.target.value as AdoptionQuiz["noiseTolerance"] }))}
                  >
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Tolleranza manutenzione</div>
                  <select
                    className="lp-input"
                    value={quiz.groomingTolerance}
                    onChange={(e) => setQuiz((p) => ({ ...p, groomingTolerance: e.target.value as AdoptionQuiz["groomingTolerance"] }))}
                  >
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-600 mb-1">Età preferita</div>
                  <select
                    className="lp-input"
                    value={quiz.agePreference}
                    onChange={(e) => setQuiz((p) => ({ ...p, agePreference: e.target.value as AdoptionQuiz["agePreference"] }))}
                  >
                    <option value="any">Indifferente</option>
                    <option value="puppy_kitten">Cucciolo / gattino</option>
                    <option value="adult">Adulto</option>
                    <option value="senior">Senior</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 lp-panel p-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Suggerimento
                </div>
                <ul className="text-xs text-slate-700 mt-2 space-y-1">
                  {matchNotes.map((n) => (
                    <li key={n}>- {n}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="lp-btn-secondary" onClick={() => setTab("posts")}>
                    Vedi annunci
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={() => setQuiz(DEFAULT_ADOPTION_QUIZ)}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => navigate(`/app/community?tab=groups&groupId=adoptions`)}
                  >
                    <MessageSquare className="w-4 h-4" /> Chat adozioni
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Annunci consigliati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recommended.slice(0, 8).map((x) => (
                  <div key={x.p.id} className="lp-panel p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{x.p.name ? x.p.name : x.p.species.toUpperCase()}</div>
                      <div className="flex-1" />
                      <span className="lp-badge">{x.score}%</span>
                    </div>
                    <div className="text-xs text-slate-700 mt-1 line-clamp-3">{x.p.description}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      {[x.p.ageLabel, x.p.size, x.p.locationLabel].filter(Boolean).join(" · ")}
                    </div>
                    {x.reasons.length ? <div className="text-xs text-slate-600 mt-1">{x.reasons.join(" · ")}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="lp-btn-secondary"
                        onClick={() =>
                          navigate(
                            `/app/community?tab=groups&groupId=adoptions&prefill=${encodeURIComponent(
                              `Ciao! Vorrei info su: ${x.p.name || x.p.species} (ID ${x.p.id}).`
                            )}`
                          )
                        }
                      >
                        <MessageSquare className="w-4 h-4" /> Contatta
                      </button>
                    </div>
                  </div>
                ))}
                {!recommended.length ? <div className="text-sm text-slate-600">Nessun match: prova a cambiare preferenze.</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "posts" ? (
        <Card>
          <CardHeader>
            <CardTitle>Annunci</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <div className="grid gap-3 md:grid-cols-2">
                <SkeletonCard rows={3} />
                <SkeletonCard rows={3} />
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {posts.map((p) => (
                    <div key={p.id} className="lp-panel p-4">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4" />
                        <div className="text-sm font-semibold">{p.name ? p.name : p.species.toUpperCase()}</div>
                        <div className="flex-1" />
                        <span className="lp-badge lp-badge-info">{p.species}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{p.description}</div>
                      <div className="text-xs text-slate-600 mt-2">
                        {[p.ageLabel, p.size, p.locationLabel].filter(Boolean).join(" · ")}
                      </div>
                      {p.temperamentTags?.length ? <div className="text-xs text-slate-600 mt-1">Tag: {p.temperamentTags.join(", ")}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="lp-btn-secondary"
                          onClick={() =>
                            navigate(
                              `/app/community?tab=groups&groupId=adoptions&prefill=${encodeURIComponent(
                                `Ciao! Vorrei info su: ${p.name || p.species} (ID ${p.id}).`
                              )}`
                            )
                          }
                        >
                          <MessageSquare className="w-4 h-4" /> Contatta
                        </button>
                        {user && p.createdBy !== user.uid ? (
                          <button
                            type="button"
                            className="lp-btn-secondary"
                            onClick={() => {
                              openReport("Segnala annuncio", async (reason) => {
                                await reportAdoption(p.id, user.uid, reason);
                              });
                            }}
                          >
                            Segnala
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {!posts.length ? <div className="text-sm text-slate-600">Nessun annuncio attivo.</div> : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "mine" ? (
        <Card>
          <CardHeader>
            <CardTitle>I miei annunci</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <EmptyState title="Accedi" description="Effettua il login per vedere e gestire i tuoi annunci." />
            ) : !myLoaded ? (
              <div className="grid gap-3 md:grid-cols-2">
                <SkeletonCard rows={3} />
                <SkeletonCard rows={3} />
              </div>
            ) : myPosts.length === 0 ? (
              <EmptyState title="Nessun annuncio" description="Crea il tuo primo annuncio di adozione." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {myPosts.map((p) => (
                  <div key={p.id} className="lp-panel p-4">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="w-4 h-4" />
                      <div className="text-sm font-semibold">{p.name ? p.name : p.species.toUpperCase()}</div>
                      <div className="flex-1" />
                      <span className="lp-badge">{p.status}</span>
                    </div>
                    <div className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{p.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.status !== "active" ? (
                        <button type="button" className="lp-btn-secondary" onClick={() => void setMyStatus(p, "active")}>Pubblica</button>
                      ) : (
                        <button type="button" className="lp-btn-secondary" onClick={() => void setMyStatus(p, "hidden")}>Nascondi</button>
                      )}
                      {p.status !== "adopted" ? (
                        <button type="button" className="lp-btn-secondary" onClick={() => void setMyStatus(p, "adopted")}>Segna adottato</button>
                      ) : null}
                      <button type="button" className="lp-btn-secondary" onClick={() => void deleteMyPost(p)}>
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-lg p-4">
            <div className="text-lg font-semibold">Nuovo annuncio adozione</div>
            <div className="text-xs text-slate-700 mt-1">Evita numeri di telefono pubblici: usa “Contatta” tramite Community.</div>
            <div className="grid gap-3 mt-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="text-xs text-slate-600 mb-1">Specie</div>
                <input className="lp-input" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="dog/cat/…" />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-600 mb-1">Nome (opz.)</div>
                <input className="lp-input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-600 mb-1">Età (opz.)</div>
                <input className="lp-input" value={ageLabel} onChange={(e) => setAgeLabel(e.target.value)} placeholder="es. 2 anni" />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-600 mb-1">Taglia</div>
                <select className="lp-input" value={size} onChange={(e) => setSize(e.target.value as "small" | "medium" | "large")}>
                  <option value="small">Piccola</option>
                  <option value="medium">Media</option>
                  <option value="large">Grande</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Località (opz.)</div>
                <input className="lp-input" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Città / Provincia" />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Canile/Gattile (opz.)</div>
                <input className="lp-input" value={shelterLabel} onChange={(e) => setShelterLabel(e.target.value)} placeholder="Nome struttura" />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Temperamento (opz., separa con virgole)</div>
                <input className="lp-input" value={temperament} onChange={(e) => setTemperament(e.target.value)} placeholder="dolce, timido, socievole" />
              </label>

              <div className="text-sm md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Domande rapide (opz.)</div>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_TAGS.map((t) => {
                    const active = profileTags.includes(t.tag);
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        className={active ? "lp-chip lp-chip-active" : "lp-chip"}
                        title={t.help}
                        onClick={() => {
                          setProfileTags((prev) => (prev.includes(t.tag) ? prev.filter((x) => x !== t.tag) : [...prev, t.tag]));
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 text-xs text-slate-600">Più queste info sono coerenti, più il match funziona bene.</div>
              </div>
              <label className="text-sm md:col-span-2">
                <div className="text-xs text-slate-600 mb-1">Descrizione</div>
                <textarea className="lp-input min-h-[110px]" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2 justify-end">
              <button type="button" className="lp-btn-secondary" onClick={() => setFormOpen(false)} disabled={posting}>
                Annulla
              </button>
              <button type="button" className="lp-btn-primary" onClick={submitAdoption} disabled={!user || posting}>
                Pubblica
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

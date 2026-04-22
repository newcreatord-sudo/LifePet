import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, HeartHandshake, MessageSquare, Plus, Settings, ShoppingBag, MapPinned } from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { createComment, createPost, likePost, reportComment, reportPost, seedCommunityDemoOnce, subscribeComments, subscribePosts } from "@/data/community";
import { ensureDefaultGroups, joinGroup, leaveGroup, reportGroupMessage, sendGroupMessage, subscribeGroupMembership, subscribeGroupMessages, subscribeGroups } from "@/data/groups";
import type { CommunityComment, CommunityGroup, CommunityGroupMessage, CommunityPost } from "@/types";
import { fetchPublicProfiles, subscribeUserProfile, type PublicProfile } from "@/data/users";
import { getFirebase } from "@/lib/firebase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToastStore } from "@/stores/toastStore";
import { createAdoption, reportAdoption, seedDemoAdoptions, subscribeAdoptions } from "@/data/adoptions";
import { mergeTemperamentTags } from "@/lib/adoptionMatch";
import type { AdoptionPost } from "@/types";
import { isCommunityDemoEnabled, setCommunityDemoEnabled } from "@/lib/communityMode";
import { setDemoModeEnabled } from "@/lib/runtimeMode";

export default function Community() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const location = useLocation();
  const [tab, setTab] = useState<"feed" | "groups" | "adoptions">("feed");
  const [communityDemo, setCommunityDemo] = useState(() => isCommunityDemoEnabled());
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loaded, setLoaded] = useState({ posts: false, groups: false, messages: false, adoptions: false });
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [modBusy, setModBusy] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentsLoaded, setCommentsLoaded] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const [selectedPosts, setSelectedPosts] = useState<Record<string, boolean>>({});
  const [selectedMessages, setSelectedMessages] = useState<Record<string, boolean>>({});

  const chatListRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

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

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("dogs");
  const [messages, setMessages] = useState<CommunityGroupMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [communityAllowed, setCommunityAllowed] = useState(true);

  const [adoptions, setAdoptions] = useState<AdoptionPost[]>([]);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptSpecies, setAdoptSpecies] = useState("dog");
  const [adoptName, setAdoptName] = useState("");
  const [adoptAge, setAdoptAge] = useState("");
  const [adoptLocation, setAdoptLocation] = useState("");
  const [adoptTags, setAdoptTags] = useState("");
  const [adoptProfileTags, setAdoptProfileTags] = useState<string[]>([]);
  const [adoptDesc, setAdoptDesc] = useState("");
  const [adoptPosting, setAdoptPosting] = useState(false);

  const ADOPT_PROFILE_TAGS: Array<{ tag: string; label: string; help: string }> = [
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

  const [profiles, setProfiles] = useState<Record<string, PublicProfile | null>>({});
  const profilesRef = useRef<Record<string, PublicProfile | null>>({});

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    if (!communityDemo) return;
    seedCommunityDemoOnce();
    void ensureDefaultGroups();
    void seedDemoAdoptions();
  }, [communityDemo]);

  const maybeEnableCommunityDemo = useCallback(
    (err: unknown) => {
    if (communityDemo) return;
    const anyErr = err as { code?: unknown; message?: unknown };
    const code = typeof anyErr?.code === "string" ? anyErr.code : "";
    const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
    const isDenied =
      code === "permission-denied" ||
      code === "unauthenticated" ||
        code === "unavailable" ||
        code === "failed-precondition" ||
      /permission\s*denied/i.test(msg) ||
      /Missing\s+or\s+insufficient\s+permissions/i.test(msg) ||
      /unauthenticated/i.test(msg) ||
        /net::ERR_ABORTED/i.test(msg) ||
        /Failed to fetch/i.test(msg) ||
        /client is offline/i.test(msg) ||
        /requires an index/i.test(msg) ||
      /functions\/(not-found|unimplemented|unavailable)/i.test(msg);
    if (!isDenied) return;
    setCommunityDemoEnabled(true);
    setCommunityDemo(true);
      setDemoModeEnabled(true);
    pushToast({ type: "info", title: "Community", message: "Modalità locale attivata: community funzionante anche senza permessi server." });
    },
    [communityDemo, pushToast]
  );

  useEffect(() => {
    setLoaded((s) => ({ ...s, posts: false }));
    const unsub = subscribePosts(
      50,
      (items) => {
      setPosts(items);
      setLoaded((s) => ({ ...s, posts: true }));
      },
      (e) => maybeEnableCommunityDemo(e)
    );
    return () => unsub();
  }, [communityDemo, maybeEnableCommunityDemo]);

  useEffect(() => {
    setLoaded((s) => ({ ...s, adoptions: false }));
    void seedDemoAdoptions();
    const unsub = subscribeAdoptions(
      60,
      { status: "active" },
      (items) => {
      setAdoptions(items);
      setLoaded((s) => ({ ...s, adoptions: true }));
      },
      (e) => maybeEnableCommunityDemo(e)
    );
    return () => unsub();
  }, [communityDemo, maybeEnableCommunityDemo]);

  useEffect(() => {
    if (!openPostId) return;
    setCommentsLoaded((prev) => ({ ...prev, [openPostId]: false }));
    const unsub = subscribeComments(openPostId, 50, (items) => {
      setComments((prev) => ({ ...prev, [openPostId]: items }));
      setCommentsLoaded((prev) => ({ ...prev, [openPostId]: true }));
    }, (e) => maybeEnableCommunityDemo(e));
    return () => unsub();
  }, [openPostId, maybeEnableCommunityDemo]);

  useEffect(() => {
    setLoaded((s) => ({ ...s, groups: false }));
    void ensureDefaultGroups().catch((e) => {
      setInlineError(e instanceof Error ? e.message : "Caricamento gruppi fallito");
      pushToast({ type: "error", title: "Community", message: e instanceof Error ? e.message : "Caricamento gruppi fallito" });
      maybeEnableCommunityDemo(e);
    });
    const unsub = subscribeGroups(
      (g) => {
      setGroups(g);
      setLoaded((s) => ({ ...s, groups: true }));
      if (!g.some((x) => x.id === activeGroupId) && g[0]?.id) setActiveGroupId(g[0].id);
      },
      (e) => maybeEnableCommunityDemo(e)
    );
    return () => unsub();
  }, [activeGroupId, communityDemo, maybeEnableCommunityDemo, pushToast]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tabParam = sp.get("tab");
    const gid = sp.get("groupId");
    const prefill = sp.get("prefill");
    if (tabParam === "groups") setTab("groups");
    if (tabParam === "adoptions") setTab("adoptions");
    if (gid) {
      setTab("groups");
      setActiveGroupId(gid);
    }
    if (prefill) {
      setTab("groups");
      setChatText(prefill);
    }
  }, [location.search]);

  useEffect(() => {
    if (!activeGroupId) return;
    setLoaded((s) => ({ ...s, messages: false }));
    const unsub = subscribeGroupMessages(activeGroupId, (items) => {
      setMessages(items);
      setLoaded((s) => ({ ...s, messages: true }));
    }, (e) => maybeEnableCommunityDemo(e));
    return () => unsub();
  }, [activeGroupId, maybeEnableCommunityDemo]);

  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = subscribeGroupMembership(activeGroupId, user.uid, setIsMember, (e) => maybeEnableCommunityDemo(e));
    return () => unsub();
  }, [activeGroupId, maybeEnableCommunityDemo, user]);

  useEffect(() => {
    if (!user || user.isDemo) {
      setCommunityAllowed(true);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, (p) => {
      setCommunityAllowed(p?.preferences?.communityEnabled !== false);
    });
    return () => unsub();
  }, [user]);

  const [isModerator, setIsModerator] = useState(false);
  useEffect(() => {
    if (!user || user.isDemo) {
      setIsModerator(false);
      return;
    }
    const { db } = getFirebase();
    const unsub = onSnapshot(doc(db, "moderators", user.uid), (snap) => setIsModerator(snap.exists()));
    return () => unsub();
  }, [user]);

  const visibleMessages = useMemo(() => {
    if (isModerator) return messages;
    return messages.filter((m) => m.status !== "hidden" && m.status !== "removed" && (m.reportCount ?? 0) < 3);
  }, [isModerator, messages]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    if (!nearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length]);

  const visiblePosts = useMemo(() => {
    return posts.filter((p) => (isModerator ? true : (p.reportCount ?? 0) < 3) && p.status !== "hidden" && p.status !== "removed");
  }, [isModerator, posts]);

  const selectedPostIds = useMemo(() => {
    if (!isModerator) return [] as string[];
    return visiblePosts.filter((p) => selectedPosts[p.id]).map((p) => p.id);
  }, [isModerator, selectedPosts, visiblePosts]);

  const selectedMessageIds = useMemo(() => {
    if (!isModerator) return [] as string[];
    return visibleMessages.filter((m) => selectedMessages[m.id]).map((m) => m.id);
  }, [isModerator, selectedMessages, visibleMessages]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const p of posts) ids.add(p.authorId);
    for (const m of messages) ids.add(m.authorId);
    for (const pid of Object.keys(comments)) for (const c of comments[pid] ?? []) ids.add(c.authorId);

    const missing: string[] = [];
    for (const uid of Array.from(ids)) {
      if (profilesRef.current[uid] !== undefined) continue;
      missing.push(uid);
    }
    if (missing.length === 0) return;

    setProfiles((prev) => {
      const next: Record<string, PublicProfile | null> = { ...prev };
      for (const uid of missing) next[uid] = null;
      return next;
    });

    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicProfiles(missing);
        if (cancelled) return;
        setProfiles((prev) => ({ ...prev, ...data }));
      } catch {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [comments, messages, posts]);

  function authorLabel(uid: string) {
    const p = profiles[uid];
    const name = p?.displayName?.trim();
    const handle = p?.handle?.trim();
    if (name && handle) return `${name} · ${handle}`;
    return name || handle || uid.slice(0, 6);
  }

  function authorAvatar(uid: string) {
    const p = profiles[uid];
    const url = p?.photoURL?.trim();
    return url || null;
  }

  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? null, [activeGroupId, groups]);

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const t = text.trim();
    if (!t) return;
    setPosting(true);
    try {
      await createPost({ authorId: user.uid, createdAt: Date.now(), text: t });
      setText("");
      pushToast({ type: "success", title: "Post", message: "Pubblicato." });
    } catch (err) {
      pushToast({ type: "error", title: "Post", message: err instanceof Error ? err.message : "Pubblicazione fallita" });
      maybeEnableCommunityDemo(err);
    } finally {
      setPosting(false);
    }
  }

  async function safeLike(postId: string) {
    setInlineError(null);
    try {
      await likePost(postId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operazione fallita";
      setInlineError(msg);
      pushToast({ type: "error", title: "Like", message: msg });
      maybeEnableCommunityDemo(e);
    }
  }

  async function batchSetPostStatus(status: "active" | "hidden") {
    if (!isModerator) return;
    if (!selectedPostIds.length) return;
    if (modBusy) return;
    setModBusy(true);
    setInlineError(null);
    try {
      const { db } = getFirebase();
      for (const id of selectedPostIds) {
        await updateDoc(doc(db, "posts", id), { status });
      }
      setSelectedPosts({});
      pushToast({ type: "success", title: "Moderazione", message: status === "hidden" ? "Post nascosti." : "Post ripristinati." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operazione fallita";
      setInlineError(msg);
      pushToast({ type: "error", title: "Moderazione", message: msg });
    } finally {
      setModBusy(false);
    }
  }

  async function batchSetMessageStatus(status: "active" | "hidden") {
    if (!isModerator) return;
    if (!activeGroupId) return;
    if (!selectedMessageIds.length) return;
    if (modBusy) return;
    setModBusy(true);
    setInlineError(null);
    try {
      const { db } = getFirebase();
      for (const id of selectedMessageIds) {
        await updateDoc(doc(db, "groups", activeGroupId, "messages", id), { status });
      }
      setSelectedMessages({});
      pushToast({ type: "success", title: "Moderazione", message: status === "hidden" ? "Messaggi nascosti." : "Messaggi ripristinati." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operazione fallita";
      setInlineError(msg);
      pushToast({ type: "error", title: "Moderazione", message: msg });
    } finally {
      setModBusy(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeGroupId) return;
    const t = chatText.trim();
    if (!t) return;
    setSending(true);
    try {
      await joinGroup(activeGroupId, user.uid);
      await sendGroupMessage(activeGroupId, {
        groupId: activeGroupId,
        authorId: user.uid,
        createdAt: Date.now(),
        text: t,
      });
      setChatText("");
      pushToast({ type: "success", title: "Messaggio", message: "Inviato." });
    } catch (err) {
      pushToast({ type: "error", title: "Messaggio", message: err instanceof Error ? err.message : "Invio fallito" });
      maybeEnableCommunityDemo(err);
    } finally {
      setSending(false);
    }
  }

  async function publishAdoption() {
    if (!user) return;
    const desc = adoptDesc.trim();
    if (!desc) {
      pushToast({ type: "error", title: "Adozione", message: "Inserisci una descrizione." });
      return;
    }
    setAdoptPosting(true);
    try {
      await ensureDefaultGroups();
      await joinGroup("adoptions", user.uid);
      const tags = mergeTemperamentTags(adoptTags, adoptProfileTags);
      const id = await createAdoption({
        createdAt: Date.now(),
        createdBy: user.uid,
        status: "active",
        species: adoptSpecies.trim() || "other",
        name: adoptName.trim() || undefined,
        ageLabel: adoptAge.trim() || undefined,
        description: desc,
        temperamentTags: tags.length ? tags : undefined,
        locationLabel: adoptLocation.trim() || undefined,
        reportCount: 0,
        updatedAt: Date.now(),
      });
      await sendGroupMessage("adoptions", {
        groupId: "adoptions",
        authorId: user.uid,
        createdAt: Date.now(),
        text:
          `Annuncio adozione: ${adoptSpecies}${adoptName.trim() ? ` · ${adoptName.trim()}` : ""}${adoptLocation.trim() ? ` · ${adoptLocation.trim()}` : ""}\n` +
          `${desc}\n` +
          `${tags.length ? `Tag: ${tags.join(", ")}\n` : ""}` +
          `ID: ${id}`,
      });
      setAdoptOpen(false);
      setAdoptName("");
      setAdoptAge("");
      setAdoptLocation("");
      setAdoptTags("");
      setAdoptProfileTags([]);
      setAdoptDesc("");
      pushToast({ type: "success", title: "Adozione", message: "Annuncio pubblicato." });
    } catch (e) {
      pushToast({ type: "error", title: "Adozione", message: e instanceof Error ? e.message : "Pubblicazione fallita" });
      maybeEnableCommunityDemo(e);
    } finally {
      setAdoptPosting(false);
    }
  }

  async function onAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !openPostId) return;
    const t = commentText.trim();
    if (!t) return;
    setCommenting(true);
    try {
      await createComment(openPostId, { authorId: user.uid, createdAt: Date.now(), text: t });
      setCommentText("");
      pushToast({ type: "success", title: "Commento", message: "Pubblicato." });
    } catch (err) {
      pushToast({ type: "error", title: "Commento", message: err instanceof Error ? err.message : "Pubblicazione fallita" });
      maybeEnableCommunityDemo(err);
    } finally {
      setCommenting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community"
        description="Una community che protegge gli animali insieme: segnalazioni, aiuto sul territorio e supporto." 
        imagePrompt="minimal clean illustration, chat bubbles with paw icon, friendly community vibe, airy background, accent color, premium, no text, no watermark"
        imageAlt="Community"
      />

      <Modal
        open={reportOpen}
        title={reportTitle}
        description="Inserisci un motivo (opzionale)."
        onClose={() => setReportOpen(false)}
      >
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

      {!communityAllowed ? (
        <EmptyState title="Community disattivata" description="Riattivala in Impostazioni → Preferenze." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTab("feed")}
                className={tab === "feed" ? "lp-chip lp-chip-active" : "lp-chip"}
                style={tab === "feed" ? { background: "linear-gradient(135deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-2)) 100%)" } : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" /> Bacheca
                  <span className={tab === "feed" ? "ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px]" : "ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px]"}>
                    {posts.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setTab("groups")}
                className={tab === "groups" ? "lp-chip lp-chip-active" : "lp-chip"}
                style={tab === "groups" ? { background: "linear-gradient(135deg, rgb(var(--lp-accent-1)) 0%, rgb(var(--lp-primary)) 100%)" } : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Gruppi
                  <span className={tab === "groups" ? "ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px]" : "ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px]"}>
                    {groups.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setTab("adoptions")}
                className={tab === "adoptions" ? "lp-chip lp-chip-active" : "lp-chip"}
                style={tab === "adoptions" ? { background: "linear-gradient(135deg, rgb(var(--lp-accent-2)) 0%, rgb(var(--lp-accent-1)) 100%)" } : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5" /> Adozioni
                  <span className={tab === "adoptions" ? "ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px]" : "ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px]"}>
                    {adoptions.length}
                  </span>
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {communityDemo ? <span className="lp-badge lp-badge-info">Demo locale</span> : null}
              <Link to="/app/settings" className="lp-btn-icon" title="Impostazioni">
                <Settings className="w-4 h-4" />
                Impostazioni
              </Link>
              <Link to="/app/marketplace" className="lp-btn-icon" title="Marketplace">
                <ShoppingBag className="w-4 h-4" />
                Shop
              </Link>
              <Link to="/app/gps" className="lp-btn-icon" title="Mappa">
                <MapPinned className="w-4 h-4" />
                Mappa
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {inlineError ? <Alert variant="danger" title="Errore">{inlineError}</Alert> : null}

              {tab === "adoptions" ? (
                <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5" /> Adozioni
                </CardTitle>
                <CardDescription>Pubblica annunci per canili e trovatelli e contatta tramite il gruppo dedicato.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <button type="button" className="lp-btn-primary" onClick={() => setAdoptOpen(true)} disabled={!user || adoptPosting}>
                    <Plus className="w-4 h-4" /> Inserisci annuncio
                  </button>
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => {
                      setTab("groups");
                      setActiveGroupId("adoptions");
                      void ensureDefaultGroups().catch((e) => {
                        setInlineError(e instanceof Error ? e.message : "Operazione fallita");
                        pushToast({ type: "error", title: "Community", message: e instanceof Error ? e.message : "Operazione fallita" });
                      });
                    }}
                  >
                    <MessageSquare className="w-4 h-4" /> Chat adozioni
                  </button>
                </div>

                {!loaded.adoptions ? (
                  <div className="grid gap-2 mt-4">
                    <SkeletonCard rows={2} />
                    <SkeletonCard rows={2} />
                    <SkeletonCard rows={2} />
                  </div>
                ) : adoptions.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title="Nessun annuncio" description="Nessun annuncio attivo in questo momento." />
                  </div>
                ) : (
                  <div className="grid gap-3 mt-4 md:grid-cols-2">
                    {adoptions.map((p) => (
                    <div key={p.id} className="lp-panel p-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{p.name ? p.name : p.species.toUpperCase()}</div>
                        <div className="flex-1" />
                        <span className="lp-badge lp-badge-info">{p.species}</span>
                      </div>
                      <div className="text-xs lp-muted mt-2 whitespace-pre-wrap">{p.description}</div>
                      <div className="text-xs lp-muted mt-2">{[p.ageLabel, p.locationLabel].filter(Boolean).join(" · ")}</div>
                      {p.temperamentTags?.length ? <div className="text-xs lp-muted mt-1">Tag: {p.temperamentTags.join(", ")}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="lp-btn-secondary"
                          onClick={() => {
                            setTab("groups");
                            setActiveGroupId("adoptions");
                            setChatText(`Ciao! Vorrei info su: ${p.name || p.species} (ID ${p.id}).`);
                            void ensureDefaultGroups().catch((e) => {
                              setInlineError(e instanceof Error ? e.message : "Operazione fallita");
                              pushToast({ type: "error", title: "Community", message: e instanceof Error ? e.message : "Operazione fallita" });
                            });
                          }}
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
                )}
              </CardContent>
                </Card>
              ) : null}

              {adoptOpen ? (
            <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg lp-card p-4">
                <div className="text-lg font-semibold">Nuovo annuncio adozione</div>
                <div className="text-xs lp-muted mt-1">Evita numeri di telefono pubblici: usa la chat adozioni.</div>
                <div className="grid gap-3 mt-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="text-xs lp-muted mb-1">Specie</div>
                    <input className="lp-input" value={adoptSpecies} onChange={(e) => setAdoptSpecies(e.target.value)} placeholder="dog/cat/…" />
                  </label>
                  <label className="text-sm">
                    <div className="text-xs lp-muted mb-1">Nome (opz.)</div>
                    <input className="lp-input" value={adoptName} onChange={(e) => setAdoptName(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <div className="text-xs lp-muted mb-1">Età (opz.)</div>
                    <input className="lp-input" value={adoptAge} onChange={(e) => setAdoptAge(e.target.value)} placeholder="es. 2 anni" />
                  </label>
                  <label className="text-sm">
                    <div className="text-xs lp-muted mb-1">Località (opz.)</div>
                    <input className="lp-input" value={adoptLocation} onChange={(e) => setAdoptLocation(e.target.value)} placeholder="Città / Provincia" />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <div className="text-xs lp-muted mb-1">Tag (opz., separa con virgole)</div>
                    <input className="lp-input" value={adoptTags} onChange={(e) => setAdoptTags(e.target.value)} placeholder="dolce, timido, socievole" />
                  </label>
                  <div className="text-sm md:col-span-2">
                    <div className="text-xs lp-muted mb-1">Domande rapide (opz.)</div>
                    <div className="flex flex-wrap gap-2">
                      {ADOPT_PROFILE_TAGS.map((t) => {
                        const active = adoptProfileTags.includes(t.tag);
                        return (
                          <button
                            key={t.tag}
                            type="button"
                            className={active ? "lp-chip lp-chip-active" : "lp-chip"}
                            title={t.help}
                            onClick={() => {
                              setAdoptProfileTags((prev) => (prev.includes(t.tag) ? prev.filter((x) => x !== t.tag) : [...prev, t.tag]));
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1 text-xs lp-muted">Servono a far funzionare meglio il questionario match.</div>
                  </div>
                  <label className="text-sm md:col-span-2">
                    <div className="text-xs lp-muted mb-1">Descrizione</div>
                    <textarea className="lp-textarea min-h-[110px]" value={adoptDesc} onChange={(e) => setAdoptDesc(e.target.value)} />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-2 justify-end">
                  <button type="button" className="lp-btn-secondary" onClick={() => setAdoptOpen(false)} disabled={adoptPosting}>
                    Annulla
                  </button>
                  <button type="button" className="lp-btn-primary" onClick={publishAdoption} disabled={!user || adoptPosting}>
                    Pubblica
                  </button>
                </div>
              </div>
            </div>
              ) : null}

              {tab === "groups" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Gruppi</CardTitle>
              <CardDescription>Chat tematiche, rispetto e gentilezza.</CardDescription>
            </CardHeader>
            <CardContent>
            {!loaded.groups ? (
              <div className="grid gap-2">
                <SkeletonCard rows={2} />
                <SkeletonCard rows={2} />
              </div>
            ) : groups.length === 0 ? (
              <EmptyState title="Nessun gruppo" description="Riprova più tardi." />
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className={
                      g.id === activeGroupId
                        ? "w-full text-left lp-panel lp-primary-soft px-3 py-2"
                        : "w-full text-left lp-panel px-3 py-2"
                    }
                  >
                    <div className="text-sm font-medium">{g.name}</div>
                    {g.topic ? <div className="text-xs lp-muted mt-0.5">{g.topic}</div> : null}
                  </button>
                ))}
              </div>
            )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{activeGroup?.name ?? "Chat"}</div>
                  <div className="text-xs lp-muted">Sii rispettoso. Nessuna diagnosi medica.</div>
                </div>
                {user && activeGroupId ? (
                  isMember ? (
                    <button
                      onClick={async () => {
                        if (!user) return;
                        setInlineError(null);
                        try {
                          await leaveGroup(activeGroupId, user.uid);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Operazione fallita";
                          setInlineError(msg);
                          pushToast({ type: "error", title: "Gruppi", message: msg });
                        }
                      }}
                      className="lp-btn-secondary"
                    >
                      Lascia
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!user) return;
                        setInlineError(null);
                        try {
                          await joinGroup(activeGroupId, user.uid);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Operazione fallita";
                          setInlineError(msg);
                          pushToast({ type: "error", title: "Gruppi", message: msg });
                        }
                      }}
                      className="lp-btn-primary"
                    >
                      Segui
                    </button>
                  )
                ) : null}
                {isModerator && selectedMessageIds.length ? (
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedMessages({})} disabled={modBusy}>
                      Deseleziona
                    </button>
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => void batchSetMessageStatus("hidden")} disabled={modBusy}>
                      Nascondi ({selectedMessageIds.length})
                    </button>
                    <button type="button" className="lp-btn-primary px-3 py-2 text-xs" onClick={() => void batchSetMessageStatus("active")} disabled={modBusy}>
                      Ripristina ({selectedMessageIds.length})
                    </button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>

            <div
              ref={chatListRef}
              className="lp-surface p-3 h-72 overflow-auto space-y-2"
              onScroll={(e) => {
                const el = e.currentTarget;
                nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
            >
              {!loaded.messages ? (
                <div className="grid gap-2">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="text-sm lp-muted">Nessun messaggio. Inizia tu.</div>
              ) : (
                visibleMessages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.authorId === user?.uid
                        ? "ml-auto max-w-[85%] rounded-xl px-3 py-2 text-sm text-white"
                        : "mr-auto max-w-[85%] rounded-xl px-3 py-2 text-sm lp-panel"
                    }
                    style={
                      m.authorId === user?.uid
                        ? { background: "linear-gradient(135deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)" }
                        : undefined
                    }
                  >
                    {isModerator ? (
                      <div className="flex items-center justify-end mb-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedMessages[m.id])}
                          onChange={(e) => setSelectedMessages((s) => ({ ...s, [m.id]: e.target.checked }))}
                          aria-label="Seleziona messaggio"
                        />
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: "rgba(var(--lp-surface),0.78)", border: "1px solid rgba(var(--lp-ink),0.10)" }}
                      >
                        {authorAvatar(m.authorId) ? (
                          <img src={authorAvatar(m.authorId)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] font-semibold" style={{ color: "rgb(var(--lp-muted))" }}>
                            {authorLabel(m.authorId).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div
                        className="text-[10px]"
                        style={m.authorId === user?.uid ? { color: "rgba(255,255,255,0.75)" } : { color: "rgb(var(--lp-muted))" }}
                      >
                        {authorLabel(m.authorId)}
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div
                      className="text-[10px] mt-1"
                      style={m.authorId === user?.uid ? { color: "rgba(255,255,255,0.72)" } : { color: "rgb(var(--lp-muted))" }}
                    >
                      {new Date(m.createdAt).toLocaleString()}
                      {isModerator ? ` · reports: ${m.reportCount ?? 0} · status: ${m.status ?? "active"}` : ""}
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-2">
                      {user && m.authorId !== user.uid ? (
                        <button
                          type="button"
                          className="lp-btn-icon"
                          onClick={async () => {
                            openReport("Segnala messaggio", async (reason) => {
                              await reportGroupMessage(activeGroupId, m.id, user.uid, reason);
                            });
                          }}
                        >
                          Segnala
                        </button>
                      ) : null}

                      {isModerator ? (
                        <>
                          <button
                            type="button"
                            className="lp-btn-icon"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "groups", activeGroupId, "messages", m.id), { status: "hidden" });
                            }}
                          >
                            Nascondi
                          </button>
                          <button
                            type="button"
                            className="lp-btn-icon"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "groups", activeGroupId, "messages", m.id), { status: "active" });
                            }}
                          >
                            Ripristina
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={onSend} className="mt-3 flex items-center gap-2">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder={isMember ? "Scrivi un messaggio…" : "Segui il gruppo per scrivere"}
                disabled={!isMember}
                className="flex-1 lp-input disabled:opacity-60"
              />
              <button
                disabled={sending || !isMember}
                className="lp-btn-primary"
                type="submit"
              >
                {sending ? "…" : "Invia"}
              </button>
            </form>
            </CardContent>
          </Card>
        </div>
              ) : null}

              {tab === "feed" ? (
                <>
                  <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Crea post</CardTitle>
                  <CardDescription>Condividi qualcosa di utile e rispettoso.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
            <form onSubmit={onPost} className="flex flex-col gap-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Scrivi qualcosa di utile…"
                className="lp-textarea"
              />
              <button
                disabled={posting}
                className="self-start inline-flex items-center gap-2 lp-btn-primary"
                type="submit"
              >
                <Plus className="w-4 h-4" />
                {posting ? "Pubblicazione…" : "Pubblica"}
              </button>
            </form>
            </CardContent>
          </Card>

                  <Card className="relative overflow-hidden">
            <div className="lp-card-accent" aria-hidden="true" />
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Bacheca</CardTitle>
                  <CardDescription>Consigli e domande dalla community.</CardDescription>
                </div>
                <div className="lp-mini-ill" aria-hidden="true" />
                {isModerator && selectedPostIds.length ? (
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedPosts({})} disabled={modBusy}>
                      Deseleziona
                    </button>
                    <button type="button" className="lp-btn-secondary px-3 py-2 text-xs" onClick={() => void batchSetPostStatus("hidden")} disabled={modBusy}>
                      Nascondi ({selectedPostIds.length})
                    </button>
                    <button type="button" className="lp-btn-primary px-3 py-2 text-xs" onClick={() => void batchSetPostStatus("active")} disabled={modBusy}>
                      Ripristina ({selectedPostIds.length})
                    </button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
            {!loaded.posts ? (
              <div className="grid gap-2">
                <SkeletonCard rows={2} />
                <SkeletonCard rows={2} />
                <SkeletonCard rows={2} />
              </div>
            ) : visiblePosts.length === 0 ? (
              <EmptyState title="Nessun post" description="Pubblica il primo messaggio per iniziare." />
            ) : (
              <div className="space-y-3">
                {visiblePosts.map((p) => (
                  <div key={p.id} className="lp-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs lp-muted">
                        <div className="w-6 h-6 rounded-full border border-[rgba(var(--lp-ink),0.12)] bg-white overflow-hidden flex items-center justify-center">
                          {authorAvatar(p.authorId) ? (
                            <img src={authorAvatar(p.authorId)!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[10px] font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
                              {authorLabel(p.authorId).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {authorLabel(p.authorId)}
                      </div>
                      {isModerator ? (
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={Boolean(selectedPosts[p.id])}
                          onChange={(e) => setSelectedPosts((s) => ({ ...s, [p.id]: e.target.checked }))}
                          aria-label="Seleziona post"
                        />
                      ) : null}
                    </div>

                    <div className="text-sm whitespace-pre-wrap">{p.text}</div>
                    {isModerator ? <div className="text-[10px] lp-muted mt-1">reports: {p.reportCount ?? 0} · status: {p.status ?? "active"}</div> : null}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs lp-muted">{new Date(p.createdAt).toLocaleString()}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => void safeLike(p.id)} className="inline-flex items-center gap-1 lp-btn-icon" type="button">
                          <Heart className="w-4 h-4" />
                          {p.likeCount}
                        </button>
                        <button
                          onClick={() => setOpenPostId((cur) => (cur === p.id ? null : p.id))}
                          className="inline-flex items-center gap-1 lp-btn-icon"
                          type="button"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Commenti
                        </button>
                        {user ? (
                          <button
                            onClick={() => {
                              openReport("Segnala post", async (reason) => {
                                await reportPost(p.id, user.uid, reason);
                              });
                            }}
                            className="inline-flex items-center gap-1 lp-btn-icon"
                            type="button"
                          >
                            Segnala
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {openPostId === p.id ? (
                      <div className="mt-4 lp-panel p-3">
                        <div className="text-sm font-semibold">Commenti</div>
                        <div className="mt-2 space-y-2">
                          {!commentsLoaded[p.id] ? (
                            <div className="grid gap-2">
                              <SkeletonCard rows={2} />
                              <SkeletonCard rows={2} />
                            </div>
                          ) : (comments[p.id] ?? []).filter((c) => (isModerator ? true : (c.reportCount ?? 0) < 3) && c.status !== "hidden" && c.status !== "removed")
                              .length === 0 ? (
                            <div className="text-sm lp-muted">Nessun commento. Inizia tu.</div>
                          ) : (
                            (comments[p.id] ?? [])
                              .filter((c) => (isModerator ? true : (c.reportCount ?? 0) < 3) && c.status !== "hidden" && c.status !== "removed")
                              .map((c) => (
                              <div key={c.id} className="lp-panel px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full border border-[rgba(var(--lp-ink),0.12)] bg-white overflow-hidden flex items-center justify-center">
                                        {authorAvatar(c.authorId) ? (
                                          <img src={authorAvatar(c.authorId)!} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="text-[10px] font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
                                            {authorLabel(c.authorId).slice(0, 1).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-[10px] lp-muted">{authorLabel(c.authorId)}</div>
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">{c.text}</div>
                                  </div>
                                  {user ? (
                                    <button
                                      onClick={() => {
                                        openReport("Segnala commento", async (reason) => {
                                          await reportComment(p.id, c.id, user.uid, reason);
                                        });
                                      }}
                                      className="lp-btn-icon"
                                      type="button"
                                    >
                                      Segnala
                                    </button>
                                  ) : null}
                                </div>
                                <div className="text-[10px] lp-muted mt-1">{new Date(c.createdAt).toLocaleString()}</div>
                              </div>
                            ))
                          )}
                        </div>
                        <form onSubmit={onAddComment} className="mt-3 flex items-center gap-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={user ? "Scrivi un commento…" : "Accedi per commentare"}
                            disabled={!user}
                            className="flex-1 lp-input disabled:opacity-60"
                          />
                          <button disabled={commenting || !user} className="lp-btn-primary" type="submit">
                            {commenting ? "…" : "Invia"}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
                </>
              ) : null}
            </div>

            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit">
              <Card className="relative overflow-hidden">
                <div className="lp-card-accent" aria-hidden="true" />
                <CardHeader>
                  <CardTitle>Regole</CardTitle>
                  <CardDescription>Sicurezza e rispetto prima di tutto.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="lp-panel p-3">
                      <div className="text-sm font-semibold">Niente dati sensibili</div>
                      <div className="text-xs lp-muted mt-1">Evita numeri di telefono, indirizzi e documenti personali.</div>
                    </div>
                    <div className="lp-panel p-3">
                      <div className="text-sm font-semibold">Segnala gli abusi</div>
                      <div className="text-xs lp-muted mt-1">Usa “Segnala” se un contenuto non è appropriato.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="lp-card-accent" aria-hidden="true" />
                <CardHeader>
                  <CardTitle>Azioni rapide</CardTitle>
                  <CardDescription>Passa alle funzioni collegate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <Link to="/app/nearby" className="lp-btn-secondary inline-flex items-center justify-center gap-2">
                      <MapPinned className="w-4 h-4" />
                      Servizi vicini
                    </Link>
                    <Link to="/app/marketplace" className="lp-btn-secondary inline-flex items-center justify-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Marketplace
                    </Link>
                    <Link to="/app/settings" className="lp-btn-secondary inline-flex items-center justify-center gap-2">
                      <Settings className="w-4 h-4" />
                      Impostazioni
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

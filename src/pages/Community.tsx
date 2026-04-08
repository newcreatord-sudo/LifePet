import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageSquare, Plus } from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuthStore } from "@/stores/authStore";
import { createComment, createPost, likePost, reportComment, reportPost, subscribeComments, subscribePosts } from "@/data/community";
import { ensureDefaultGroups, joinGroup, leaveGroup, reportGroupMessage, sendGroupMessage, subscribeGroupMembership, subscribeGroupMessages, subscribeGroups } from "@/data/groups";
import type { CommunityComment, CommunityGroup, CommunityGroupMessage, CommunityPost } from "@/types";
import { subscribePublicProfile, subscribeUserProfile, type PublicProfile } from "@/data/users";
import { getFirebase } from "@/lib/firebase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToastStore } from "@/stores/toastStore";

export default function Community() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [tab, setTab] = useState<"feed" | "groups">("feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("dogs");
  const [messages, setMessages] = useState<CommunityGroupMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [communityAllowed, setCommunityAllowed] = useState(true);

  const [profiles, setProfiles] = useState<Record<string, PublicProfile | null>>({});
  const profileUnsubs = useRef<Record<string, () => void>>({});
  const profilesRef = useRef<Record<string, PublicProfile | null>>({});

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    const unsub = subscribePosts(50, setPosts);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!openPostId) return;
    const unsub = subscribeComments(openPostId, 50, (items) => {
      setComments((prev) => ({ ...prev, [openPostId]: items }));
    });
    return () => unsub();
  }, [openPostId]);

  useEffect(() => {
    ensureDefaultGroups();
    const unsub = subscribeGroups((g) => {
      setGroups(g);
      if (!g.some((x) => x.id === activeGroupId) && g[0]?.id) setActiveGroupId(g[0].id);
    });
    return () => unsub();
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) return;
    const unsub = subscribeGroupMessages(activeGroupId, setMessages);
    return () => unsub();
  }, [activeGroupId]);

  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = subscribeGroupMembership(activeGroupId, user.uid, setIsMember);
    return () => unsub();
  }, [activeGroupId, user]);

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
    const ids = new Set<string>();
    for (const p of posts) ids.add(p.authorId);
    for (const m of messages) ids.add(m.authorId);
    for (const pid of Object.keys(comments)) for (const c of comments[pid] ?? []) ids.add(c.authorId);

    for (const uid of Array.from(ids)) {
      if (profilesRef.current[uid] !== undefined) continue;
      const unsub = subscribePublicProfile(uid, (pp) => {
        setProfiles((prev) => ({ ...prev, [uid]: pp }));
      });
      profileUnsubs.current[uid] = unsub;
      setProfiles((prev) => ({ ...prev, [uid]: null }));
    }

    const unsubs = profileUnsubs.current;

    return () => {
      for (const uid of Object.keys(unsubs)) {
        if (!ids.has(uid)) {
          try {
            unsubs[uid]?.();
          } catch {
            continue;
          }
          delete unsubs[uid];
        }
      }
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
    } finally {
      setPosting(false);
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
    } finally {
      setSending(false);
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
    } finally {
      setCommenting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Community" description="Condividi consigli, fai domande e supporta altri proprietari." />

      {!communityAllowed ? (
        <EmptyState title="Community disattivata" description="Riattivala in Impostazioni → Preferenze." />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("feed")}
              className={
                tab === "feed"
                  ? "px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 text-sm"
                  : "px-3 py-1.5 rounded-xl text-sm text-slate-700 hover:bg-white/60"
              }
            >
              Feed
            </button>
            <button
              onClick={() => setTab("groups")}
              className={
                tab === "groups"
                  ? "px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 text-sm"
                  : "px-3 py-1.5 rounded-xl text-sm text-slate-700 hover:bg-white/60"
              }
            >
              Gruppi
            </button>
          </div>

          {tab === "groups" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Gruppi</CardTitle>
              <CardDescription>Chat tematiche, rispetto e gentilezza.</CardDescription>
            </CardHeader>
            <CardContent>
            {groups.length === 0 ? (
              <div className="text-sm text-slate-600">Caricamento gruppi…</div>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className={
                      g.id === activeGroupId
                        ? "w-full text-left rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2"
                        : "w-full text-left rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 hover:bg-white"
                    }
                  >
                    <div className="text-sm font-medium">{g.name}</div>
                    {g.topic ? <div className="text-xs text-slate-600 mt-0.5">{g.topic}</div> : null}
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
                  <div className="text-xs text-slate-600">Sii rispettoso. Nessuna diagnosi medica.</div>
                </div>
                {user && activeGroupId ? (
                  isMember ? (
                    <button
                      onClick={async () => {
                        await leaveGroup(activeGroupId, user.uid);
                      }}
                      className="lp-btn-secondary"
                    >
                      Lascia
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await joinGroup(activeGroupId, user.uid);
                      }}
                      className="lp-btn-primary"
                    >
                      Segui
                    </button>
                  )
                ) : null}
              </div>
            </CardHeader>
            <CardContent>

            <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 h-72 overflow-auto space-y-2">
              {visibleMessages.length === 0 ? (
                <div className="text-sm text-slate-600">Nessun messaggio. Inizia tu.</div>
              ) : (
                visibleMessages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.authorId === user?.uid
                        ? "ml-auto max-w-[85%] rounded-xl bg-sky-600/10 border border-sky-600/20 px-3 py-2 text-sm"
                        : "mr-auto max-w-[85%] rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-sm"
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full border border-slate-200/70 bg-white overflow-hidden flex items-center justify-center">
                        {authorAvatar(m.authorId) ? (
                          <img src={authorAvatar(m.authorId)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] font-semibold text-slate-700">{authorLabel(m.authorId).slice(0, 1).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-600">{authorLabel(m.authorId)}</div>
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {new Date(m.createdAt).toLocaleString()}
                      {isModerator ? ` · reports: ${m.reportCount ?? 0} · status: ${m.status ?? "active"}` : ""}
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-2">
                      {user && m.authorId !== user.uid ? (
                        <button
                          type="button"
                          className="lp-btn-icon"
                          onClick={async () => {
                            const reason = prompt("Motivo segnalazione (opzionale):") ?? "";
                            await reportGroupMessage(activeGroupId, m.id, user.uid, reason);
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
          <Card>
            <CardHeader>
              <CardTitle>Crea post</CardTitle>
              <CardDescription>Condividi qualcosa di utile e rispettoso.</CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Feed</CardTitle>
              <CardDescription>Consigli e domande dalla community.</CardDescription>
            </CardHeader>
            <CardContent>
            {posts.filter((p) => (isModerator ? true : (p.reportCount ?? 0) < 3) && p.status !== "hidden" && p.status !== "removed").length === 0 ? (
              <EmptyState title="Nessun post" description="Pubblica il primo messaggio per iniziare." />
            ) : (
              <div className="space-y-3">
                {posts
                  .filter((p) => (isModerator ? true : (p.reportCount ?? 0) < 3) && p.status !== "hidden" && p.status !== "removed")
                  .map((p) => (
                  <div key={p.id} className="lp-card p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <div className="w-6 h-6 rounded-full border border-slate-200/70 bg-white overflow-hidden flex items-center justify-center">
                        {authorAvatar(p.authorId) ? (
                          <img src={authorAvatar(p.authorId)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] font-semibold text-slate-700">{authorLabel(p.authorId).slice(0, 1).toUpperCase()}</div>
                        )}
                      </div>
                      {authorLabel(p.authorId)}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{p.text}</div>
                    {isModerator ? <div className="text-[10px] text-slate-600 mt-1">reports: {p.reportCount ?? 0} · status: {p.status ?? "active"}</div> : null}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-600">{new Date(p.createdAt).toLocaleString()}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => likePost(p.id)}
                          className="inline-flex items-center gap-1 lp-btn-icon"
                        >
                          <Heart className="w-4 h-4" />
                          {p.likeCount}
                        </button>
                        <button
                          onClick={() => setOpenPostId((cur) => (cur === p.id ? null : p.id))}
                          className="inline-flex items-center gap-1 lp-btn-icon"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Commenti
                        </button>
                        {user ? (
                          <button
                            onClick={async () => {
                              const reason = prompt("Motivo segnalazione (opzionale):") ?? "";
                              await reportPost(p.id, user.uid, reason);
                            }}
                            className="inline-flex items-center gap-1 lp-btn-icon"
                          >
                            Segnala
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {openPostId === p.id ? (
                      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                        <div className="text-sm font-semibold">Commenti</div>
                        <div className="mt-2 space-y-2">
                          {(comments[p.id] ?? []).filter((c) => (isModerator ? true : (c.reportCount ?? 0) < 3) && c.status !== "hidden" && c.status !== "removed")
                            .length === 0 ? (
                            <div className="text-sm text-slate-400">Nessun commento. Inizia tu.</div>
                          ) : (
                            (comments[p.id] ?? [])
                              .filter((c) => (isModerator ? true : (c.reportCount ?? 0) < 3) && c.status !== "hidden" && c.status !== "removed")
                              .map((c) => (
                              <div key={c.id} className="lp-panel px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full border border-slate-200/70 bg-white overflow-hidden flex items-center justify-center">
                                        {authorAvatar(c.authorId) ? (
                                          <img src={authorAvatar(c.authorId)!} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="text-[10px] font-semibold text-slate-700">{authorLabel(c.authorId).slice(0, 1).toUpperCase()}</div>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-600">{authorLabel(c.authorId)}</div>
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">{c.text}</div>
                                  </div>
                                  {user ? (
                                    <button
                                      onClick={async () => {
                                        const reason = prompt("Motivo segnalazione (opzionale):") ?? "";
                                        await reportComment(p.id, c.id, user.uid, reason);
                                      }}
                                      className="lp-btn-icon"
                                      type="button"
                                    >
                                      Segnala
                                    </button>
                                  ) : null}
                                </div>
                                <div className="text-[10px] text-slate-600 mt-1">{new Date(c.createdAt).toLocaleString()}</div>
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
                          <button
                            disabled={commenting || !user}
                            className="lp-btn-primary"
                            type="submit"
                          >
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
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Heart, MessageSquare, Plus } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { createComment, createPost, likePost, reportComment, reportPost, subscribeComments, subscribePosts } from "@/data/community";
import { ensureDefaultGroups, joinGroup, leaveGroup, sendGroupMessage, subscribeGroupMembership, subscribeGroupMessages, subscribeGroups } from "@/data/groups";
import type { CommunityComment, CommunityGroup, CommunityGroupMessage, CommunityPost } from "@/types";
import { subscribeUserProfile } from "@/data/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Community() {
  const user = useAuthStore((s) => s.user);
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
              {messages.length === 0 ? (
                <div className="text-sm text-slate-600">Nessun messaggio. Inizia tu.</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.authorId === user?.uid
                        ? "ml-auto max-w-[85%] rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-sm"
                        : "mr-auto max-w-[85%] rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-sm"
                    }
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className="text-[10px] text-slate-600 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
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
            {posts.filter((p) => p.status !== "hidden" && p.status !== "removed").length === 0 ? (
              <EmptyState title="Nessun post" description="Pubblica il primo messaggio per iniziare." />
            ) : (
              <div className="space-y-3">
                {posts
                  .filter((p) => p.status !== "hidden" && p.status !== "removed")
                  .map((p) => (
                  <div key={p.id} className="lp-card p-4">
                    <div className="text-sm whitespace-pre-wrap">{p.text}</div>
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
                          {(comments[p.id] ?? []).filter((c) => c.status !== "hidden" && c.status !== "removed").length === 0 ? (
                            <div className="text-sm text-slate-400">Nessun commento. Inizia tu.</div>
                          ) : (
                            (comments[p.id] ?? [])
                              .filter((c) => c.status !== "hidden" && c.status !== "removed")
                              .map((c) => (
                              <div key={c.id} className="lp-panel px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm whitespace-pre-wrap">{c.text}</div>
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

import { useEffect, useMemo, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { collection, collectionGroup, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuthStore } from "@/stores/authStore";
import type { CommunityPost } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type PostReport = { reporterId: string; reason?: string; createdAt: number };
type GroupMessage = { id: string; groupId: string; authorId: string; createdAt: number; text: string; status?: string; reportCount?: number };
type CommentItem = { id: string; postId: string; authorId: string; createdAt: number; text: string; status?: string; reportCount?: number };
type BanDoc = { uid: string; untilMs: number; reason?: string; createdAt: number };

export default function Moderation() {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string | null>(null);
  const [isModeratorDoc, setIsModeratorDoc] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, PostReport[]>>({});

  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [openMsgKey, setOpenMsgKey] = useState<string | null>(null);
  const [msgReports, setMsgReports] = useState<Record<string, PostReport[]>>({});

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [openCommentKey, setOpenCommentKey] = useState<string | null>(null);
  const [commentReports, setCommentReports] = useState<Record<string, PostReport[]>>({});

  const [banUid, setBanUid] = useState("");
  const [banHours, setBanHours] = useState("24");
  const [banReason, setBanReason] = useState("");
  const [savingBan, setSavingBan] = useState(false);

  useEffect(() => {
    if (!user || user.isDemo) {
      setRole(null);
      setIsModeratorDoc(false);
      return;
    }
    const { auth } = getFirebase();
    const cu = auth.currentUser;
    if (!cu) {
      setRole(null);
      setIsModeratorDoc(false);
      return;
    }
    getIdTokenResult(cu, true)
      .then((r) => {
        const claims = r.claims as Record<string, unknown>;
        const v = claims.role;
        setRole(typeof v === "string" ? v : null);
      })
      .catch(() => setRole(null));
  }, [user]);

  useEffect(() => {
    if (!user || user.isDemo) return;
    const { db } = getFirebase();
    getDoc(doc(db, "moderators", user.uid))
      .then((snap) => setIsModeratorDoc(snap.exists()))
      .catch(() => setIsModeratorDoc(false));
  }, [user]);

  const isModerator = role === "admin" || role === "moderator" || isModeratorDoc;

  useEffect(() => {
    if (!isModerator) return;
    const { db } = getFirebase();
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityPost, "id">) }));
      setPosts(items);
    });
  }, [isModerator]);

  useEffect(() => {
    if (!isModerator || !openPostId) return;
    const { db } = getFirebase();
    const q = query(collection(db, "posts", openPostId, "reports"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as PostReport) }));
      setReports((prev) => ({ ...prev, [openPostId]: items }));
    });
  }, [isModerator, openPostId]);

  const queue = useMemo(() => {
    return posts
      .filter((p) => (p.reportCount ?? 0) > 0 || p.status === "hidden")
      .slice()
      .sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0));
  }, [posts]);

  useEffect(() => {
    if (!isModerator) return;
    const { db } = getFirebase();
    const q = query(collectionGroup(db, "messages"), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      const items: GroupMessage[] = [];
      for (const d of snap.docs) {
        const p = d.ref.path;
        if (!p.startsWith("groups/") || !p.includes("/messages/")) continue;
        const parts = p.split("/");
        const groupId = parts[1] ?? "";
        const msgId = d.id;
        const data = d.data() as Record<string, unknown>;
        items.push({
          id: msgId,
          groupId,
          authorId: String(data.authorId ?? ""),
          createdAt: Number(data.createdAt ?? 0),
          text: String(data.text ?? ""),
          status: typeof data.status === "string" ? data.status : undefined,
          reportCount: typeof data.reportCount === "number" ? data.reportCount : undefined,
        });
      }
      setGroupMessages(items);
    });
  }, [isModerator]);

  useEffect(() => {
    if (!isModerator || !openMsgKey) return;
    const [groupId, messageId] = openMsgKey.split(":");
    if (!groupId || !messageId) return;
    const { db } = getFirebase();
    const q = query(collection(db, "groups", groupId, "messages", messageId, "reports"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as PostReport) }));
      setMsgReports((prev) => ({ ...prev, [openMsgKey]: items }));
    });
  }, [isModerator, openMsgKey]);

  const groupQueue = useMemo(() => {
    return groupMessages
      .filter((m) => (m.reportCount ?? 0) > 0 || m.status === "hidden")
      .slice()
      .sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0));
  }, [groupMessages]);

  useEffect(() => {
    if (!isModerator) return;
    const { db } = getFirebase();
    const q = query(collectionGroup(db, "comments"), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      const items: CommentItem[] = [];
      for (const d of snap.docs) {
        const p = d.ref.path;
        if (!p.startsWith("posts/") || !p.includes("/comments/")) continue;
        const parts = p.split("/");
        const postId = parts[1] ?? "";
        const data = d.data() as Record<string, unknown>;
        items.push({
          id: d.id,
          postId,
          authorId: String(data.authorId ?? ""),
          createdAt: Number(data.createdAt ?? 0),
          text: String(data.text ?? ""),
          status: typeof data.status === "string" ? data.status : undefined,
          reportCount: typeof data.reportCount === "number" ? data.reportCount : undefined,
        });
      }
      setComments(items);
    });
  }, [isModerator]);

  useEffect(() => {
    if (!isModerator || !openCommentKey) return;
    const [postId, commentId] = openCommentKey.split(":");
    if (!postId || !commentId) return;
    const { db } = getFirebase();
    const q = query(collection(db, "posts", postId, "comments", commentId, "reports"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as PostReport) }));
      setCommentReports((prev) => ({ ...prev, [openCommentKey]: items }));
    });
  }, [isModerator, openCommentKey]);

  const commentQueue = useMemo(() => {
    return comments
      .filter((c) => (c.reportCount ?? 0) > 0 || c.status === "hidden")
      .slice()
      .sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0));
  }, [comments]);

  if (!user) return <EmptyState title="Accedi" description="Serve un account per accedere alla moderazione." />;
  if (!isModerator) return <EmptyState title="Accesso negato" description="Questa sezione è riservata a moderatori/admin." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Moderazione" description="Gestisci segnalazioni e contenuti nascosti." />

      <Card>
        <CardHeader>
          <CardTitle>Post segnalati</CardTitle>
          <CardDescription>Lista dei contenuti con report o nascosti.</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState title="Nessuna segnalazione" description="Non ci sono post segnalati al momento." />
          ) : (
            <div className="space-y-2">
              {queue.map((p) => (
                <div key={p.id} className="lp-panel px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{p.text}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        author: {p.authorId} · reports: {p.reportCount ?? 0} · status: {p.status ?? "active"}
                      </div>
                      <div className="text-xs text-slate-600">{new Date(p.createdAt).toLocaleString()}</div>
                      {openPostId === p.id ? (
                        <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 p-2">
                          <div className="text-xs text-slate-600">Reports</div>
                          {(reports[p.id] ?? []).length === 0 ? (
                            <div className="text-sm text-slate-600 mt-1">Nessun dettaglio.</div>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {(reports[p.id] ?? []).map((r) => (
                                <div key={r.reporterId} className="text-sm">
                                  <div className="text-xs text-slate-600">{r.reporterId} · {new Date(r.createdAt).toLocaleString()}</div>
                                  {r.reason ? <div className="text-sm text-slate-800">{r.reason}</div> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          className="lp-btn-secondary"
                          type="button"
                          onClick={() => setOpenPostId((cur) => (cur === p.id ? null : p.id))}
                        >
                          {openPostId === p.id ? "Chiudi" : "Dettagli"}
                        </button>
                        <button
                          className="lp-btn-secondary"
                          type="button"
                          onClick={async () => {
                            const { db } = getFirebase();
                            await updateDoc(doc(db, "posts", p.id), { status: "active" });
                          }}
                        >
                          Ripristina
                        </button>
                        <button
                          className="lp-btn-secondary"
                          type="button"
                          onClick={async () => {
                            const { db } = getFirebase();
                            await updateDoc(doc(db, "posts", p.id), { status: "hidden" });
                          }}
                        >
                          Nascondi
                        </button>
                        <button
                          className="lp-btn-secondary"
                          type="button"
                          onClick={async () => {
                            if (!confirm("Rimuovere il post?")) return;
                            const { db } = getFirebase();
                            await updateDoc(doc(db, "posts", p.id), { status: "removed" });
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commenti segnalati</CardTitle>
          <CardDescription>Queue commenti (reportCount o hidden).</CardDescription>
        </CardHeader>
        <CardContent>
          {commentQueue.length === 0 ? (
            <EmptyState title="Nessun commento segnalato" description="Non ci sono commenti segnalati al momento." />
          ) : (
            <div className="space-y-2">
              {commentQueue.map((c) => {
                const key = `${c.postId}:${c.id}`;
                return (
                  <div key={key} className="lp-panel px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{c.text}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          post: {c.postId} · author: {c.authorId} · reports: {c.reportCount ?? 0} · status: {c.status ?? "active"}
                        </div>
                        <div className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleString()}</div>

                        {openCommentKey === key ? (
                          <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 p-2">
                            <div className="text-xs text-slate-600">Reports</div>
                            {(commentReports[key] ?? []).length === 0 ? (
                              <div className="text-sm text-slate-600 mt-1">Nessun dettaglio.</div>
                            ) : (
                              <div className="mt-1 space-y-1">
                                {(commentReports[key] ?? []).map((r) => (
                                  <div key={r.reporterId} className="text-sm">
                                    <div className="text-xs text-slate-600">{r.reporterId} · {new Date(r.createdAt).toLocaleString()}</div>
                                    {r.reason ? <div className="text-sm text-slate-800">{r.reason}</div> : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button className="lp-btn-secondary" type="button" onClick={() => setOpenCommentKey((cur) => (cur === key ? null : key))}>
                            {openCommentKey === key ? "Chiudi" : "Dettagli"}
                          </button>
                          <button
                            className="lp-btn-secondary"
                            type="button"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "posts", c.postId, "comments", c.id), { status: "active" });
                            }}
                          >
                            Ripristina
                          </button>
                          <button
                            className="lp-btn-secondary"
                            type="button"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "posts", c.postId, "comments", c.id), { status: "hidden" });
                            }}
                          >
                            Nascondi
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ban / Timeout</CardTitle>
          <CardDescription>Blocca la pubblicazione in Community e chat per un utente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <label className="md:col-span-5 block">
              <div className="text-xs text-slate-600 mb-1">UID</div>
              <input value={banUid} onChange={(e) => setBanUid(e.target.value)} className="lp-input" />
            </label>
            <label className="md:col-span-2 block">
              <div className="text-xs text-slate-600 mb-1">Ore</div>
              <input value={banHours} onChange={(e) => setBanHours(e.target.value)} inputMode="numeric" className="lp-input" />
            </label>
            <label className="md:col-span-4 block">
              <div className="text-xs text-slate-600 mb-1">Motivo</div>
              <input value={banReason} onChange={(e) => setBanReason(e.target.value)} className="lp-input" />
            </label>
            <button
              className="md:col-span-1 lp-btn-primary"
              type="button"
              disabled={savingBan}
              onClick={async () => {
                const uid = banUid.trim();
                const hours = Number(banHours);
                if (!uid) return;
                if (!Number.isFinite(hours) || hours <= 0 || hours > 720) return;
                setSavingBan(true);
                try {
                  const untilMs = Date.now() + Math.round(hours * 60 * 60 * 1000);
                  const { db } = getFirebase();
                  const docData: BanDoc = { uid, untilMs, reason: banReason.trim() || undefined, createdAt: Date.now() };
                  await setDoc(doc(db, "bans", uid), docData);
                  setBanUid("");
                  setBanReason("");
                  setBanHours("24");
                } finally {
                  setSavingBan(false);
                }
              }}
            >
              {savingBan ? "…" : "Banna"}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-600">Per revocare: imposta 1 ora e poi aggiorna manualmente fino a passato, o elimina il doc da console.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messaggi gruppi segnalati</CardTitle>
          <CardDescription>Queue per chat gruppi (reportCount o hidden).</CardDescription>
        </CardHeader>
        <CardContent>
          {groupQueue.length === 0 ? (
            <EmptyState title="Nessun messaggio segnalato" description="Non ci sono messaggi segnalati al momento." />
          ) : (
            <div className="space-y-2">
              {groupQueue.map((m) => {
                const key = `${m.groupId}:${m.id}`;
                return (
                  <div key={key} className="lp-panel px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{m.text}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          group: {m.groupId} · author: {m.authorId} · reports: {m.reportCount ?? 0} · status: {m.status ?? "active"}
                        </div>
                        <div className="text-xs text-slate-600">{new Date(m.createdAt).toLocaleString()}</div>

                        {openMsgKey === key ? (
                          <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 p-2">
                            <div className="text-xs text-slate-600">Reports</div>
                            {(msgReports[key] ?? []).length === 0 ? (
                              <div className="text-sm text-slate-600 mt-1">Nessun dettaglio.</div>
                            ) : (
                              <div className="mt-1 space-y-1">
                                {(msgReports[key] ?? []).map((r) => (
                                  <div key={r.reporterId} className="text-sm">
                                    <div className="text-xs text-slate-600">{r.reporterId} · {new Date(r.createdAt).toLocaleString()}</div>
                                    {r.reason ? <div className="text-sm text-slate-800">{r.reason}</div> : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button className="lp-btn-secondary" type="button" onClick={() => setOpenMsgKey((cur) => (cur === key ? null : key))}>
                            {openMsgKey === key ? "Chiudi" : "Dettagli"}
                          </button>
                          <button
                            className="lp-btn-secondary"
                            type="button"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "groups", m.groupId, "messages", m.id), { status: "active" });
                            }}
                          >
                            Ripristina
                          </button>
                          <button
                            className="lp-btn-secondary"
                            type="button"
                            onClick={async () => {
                              const { db } = getFirebase();
                              await updateDoc(doc(db, "groups", m.groupId, "messages", m.id), { status: "hidden" });
                            }}
                          >
                            Nascondi
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

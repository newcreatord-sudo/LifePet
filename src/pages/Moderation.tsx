import { useEffect, useMemo, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuthStore } from "@/stores/authStore";
import type { CommunityPost } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type PostReport = { reporterId: string; reason?: string; createdAt: number };

export default function Moderation() {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string | null>(null);
  const [isModeratorDoc, setIsModeratorDoc] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, PostReport[]>>({});

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
    </div>
  );
}

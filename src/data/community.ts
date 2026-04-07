import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { CommunityComment, CommunityPost } from "@/types";

const DEMO_KEY = "lifepet:demo:posts";

export function postsCol() {
  const { db } = getFirebase();
  return collection(db, "posts");
}

export function commentsCol(postId: string) {
  const { db } = getFirebase();
  return collection(db, "posts", postId, "comments");
}

export function subscribePosts(limitCount: number, onData: (posts: CommunityPost[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<CommunityPost[]>(DEMO_KEY, [], (all) => {
      const posts = all.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, limitCount);
      onData(posts);
    });
  }
  const q = query(postsCol(), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const posts: CommunityPost[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityPost, "id">) }));
    onData(posts);
  });
}

export async function createPost(input: Omit<CommunityPost, "id" | "likeCount">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next: CommunityPost = { id, ...(input as Omit<CommunityPost, "id" | "likeCount">), likeCount: 0 };
    demoUpdate<CommunityPost[]>(DEMO_KEY, [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(postsCol(), { ...input, likeCount: 0, status: "active", reportCount: 0 });
  return ref.id;
}

export async function likePost(postId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<CommunityPost[]>(DEMO_KEY, [], (prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likeCount: (p.likeCount ?? 0) + 1 } : p))
    );
    return;
  }
  const fn = httpsCallable(getFirebase().functions, "likePost");
  await fn({ postId });
}

function demoCommentsKey(postId: string) {
  return `lifepet:demo:posts:${postId}:comments`;
}

export function subscribeComments(postId: string, limitCount: number, onData: (items: CommunityComment[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<CommunityComment[]>(demoCommentsKey(postId), [], (all) => {
      const items = all.slice().sort((a, b) => a.createdAt - b.createdAt).slice(-limitCount);
      onData(items);
    });
  }
  const q = query(commentsCol(postId), orderBy("createdAt", "asc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items: CommunityComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityComment, "id">) }));
    onData(items);
  });
}

export async function createComment(postId: string, input: Omit<CommunityComment, "id" | "postId">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next: CommunityComment = { id, postId, ...(input as Omit<CommunityComment, "id" | "postId">) };
    demoUpdate<CommunityComment[]>(demoCommentsKey(postId), [], (prev) => [...prev, next]);
    return id;
  }
  const ref = await addDoc(commentsCol(postId), { postId, ...input, status: "active", reportCount: 0 });
  return ref.id;
}

export async function reportPost(postId: string, reporterId: string, reason: string) {
  if (shouldUseDemoData()) {
    demoUpdate<CommunityPost[]>(DEMO_KEY, [], (prev) => prev.map((p) => (p.id === postId ? { ...p, reportCount: (p.reportCount ?? 0) + 1 } : p)));
    return;
  }
  const { db } = getFirebase();
  await setDoc(doc(db, "posts", postId, "reports", reporterId), { reporterId, reason: reason.trim(), createdAt: Date.now() }, { merge: true });
}

export async function reportComment(postId: string, commentId: string, reporterId: string, reason: string) {
  if (shouldUseDemoData()) return;
  const { db } = getFirebase();
  await setDoc(
    doc(db, "posts", postId, "comments", commentId, "reports", reporterId),
    { reporterId, reason: reason.trim(), createdAt: Date.now() },
    { merge: true }
  );
}

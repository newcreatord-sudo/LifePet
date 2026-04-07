import { addDoc, collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { CommunityPost } from "@/types";

const DEMO_KEY = "lifepet:demo:posts";

export function postsCol() {
  const { db } = getFirebase();
  return collection(db, "posts");
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
  const ref = await addDoc(postsCol(), { ...input, likeCount: 0 });
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

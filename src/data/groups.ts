import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  doc,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { CommunityGroup, CommunityGroupMember, CommunityGroupMessage } from "@/types";
import { demoId, demoRead, demoSubscribe, demoUpdate, demoWrite } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";

const DEMO_GROUPS_KEY = "lifepet:demo:groups";

function groupsCol() {
  const { db } = getFirebase();
  return collection(db, "groups");
}

function messagesCol(groupId: string) {
  const { db } = getFirebase();
  return collection(db, "groups", groupId, "messages");
}

function demoMessagesKey(groupId: string) {
  return `lifepet:demo:group:${groupId}:messages`;
}

function demoMembersKey(groupId: string) {
  return `lifepet:demo:group:${groupId}:members`;
}

export async function ensureDefaultGroups() {
  const defaults: Array<Omit<CommunityGroup, "id"> & { id: string }> = [
    { id: "dogs", name: "Dog owners", topic: "Training, nutrition, care", speciesTag: "dog", createdAt: Date.now() },
    { id: "cats", name: "Cat owners", topic: "Health, behavior, litter", speciesTag: "cat", createdAt: Date.now() },
    { id: "exotics", name: "Other pets", topic: "Birds, rabbits, reptiles, etc.", speciesTag: "other", createdAt: Date.now() },
  ];

  if (shouldUseDemoData()) {
    const existing = demoRead<CommunityGroup[]>(DEMO_GROUPS_KEY, []);
    if (existing.length > 0) return;
    demoWrite<CommunityGroup[]>(
      DEMO_GROUPS_KEY,
      defaults.map((d) => ({ id: d.id, name: d.name, topic: d.topic, speciesTag: d.speciesTag, createdAt: d.createdAt }))
    );
    return;
  }

  const snap = await getDocs(query(groupsCol(), limit(1)));
  if (!snap.empty) return;
  const { db } = getFirebase();
  await Promise.all(
    defaults.map((g) =>
      setDoc(doc(db, "groups", g.id), {
        name: g.name,
        topic: g.topic,
        speciesTag: g.speciesTag,
        createdAt: g.createdAt,
      })
    )
  );
}

export function subscribeGroups(onData: (groups: CommunityGroup[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<CommunityGroup[]>(DEMO_GROUPS_KEY, [], (all) => {
      const items = all.slice().sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    });
  }
  const q = query(groupsCol(), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const groups: CommunityGroup[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityGroup, "id">) }));
    onData(groups);
  });
}

export function subscribeGroupMessages(groupId: string, onData: (msgs: CommunityGroupMessage[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<CommunityGroupMessage[]>(demoMessagesKey(groupId), [], (all) => {
      const items = all.slice().sort((a, b) => a.createdAt - b.createdAt).slice(-120);
      onData(items);
    });
  }
  const q = query(messagesCol(groupId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const msgs: CommunityGroupMessage[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityGroupMessage, "id">) }));
    onData(msgs.slice(-120));
  });
}

export function subscribeGroupMembership(groupId: string, uid: string, onData: (isMember: boolean) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<CommunityGroupMember[]>(demoMembersKey(groupId), [], (all) => {
      onData(all.some((m) => m.uid === uid));
    });
  }
  return onSnapshot(doc(getFirebase().db, "groups", groupId, "members", uid), (snap) => {
    onData(snap.exists());
  });
}

export async function joinGroup(groupId: string, uid: string) {
  if (shouldUseDemoData()) {
    demoUpdate<CommunityGroupMember[]>(demoMembersKey(groupId), [], (prev) => {
      if (prev.some((m) => m.uid === uid)) return prev;
      return [...prev, { id: uid, uid, joinedAt: Date.now() }];
    });
    return;
  }
  const { db } = getFirebase();
  await setDoc(doc(db, "groups", groupId, "members", uid), { uid, joinedAt: Date.now() }, { merge: true });
}

export async function leaveGroup(groupId: string, uid: string) {
  if (shouldUseDemoData()) {
    demoUpdate<CommunityGroupMember[]>(demoMembersKey(groupId), [], (prev) => prev.filter((m) => m.uid !== uid));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "groups", groupId, "members", uid));
}

export async function sendGroupMessage(groupId: string, input: Omit<CommunityGroupMessage, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next: CommunityGroupMessage = { id, ...(input as Omit<CommunityGroupMessage, "id">) };
    demoUpdate<CommunityGroupMessage[]>(demoMessagesKey(groupId), [], (prev) => [...prev, next]);
    return id;
  }
  const ref = await addDoc(messagesCol(groupId), input);
  return ref.id;
}

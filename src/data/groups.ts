import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { CommunityGroup, CommunityGroupMember, CommunityGroupMessage } from "@/types";
import { demoId, demoRead, demoSubscribe, demoUpdate, demoWrite } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { shouldUseCommunityDemoData } from "@/lib/communityMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";

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
    { id: "dogs", name: "Proprietari di cani", topic: "Educazione, nutrizione, cura", speciesTag: "dog", createdAt: Date.now() },
    { id: "cats", name: "Proprietari di gatti", topic: "Salute, comportamento, lettiera", speciesTag: "cat", createdAt: Date.now() },
    { id: "exotics", name: "Altri animali", topic: "Uccelli, conigli, rettili, ecc.", speciesTag: "other", createdAt: Date.now() },
    { id: "walks", name: "Passeggiate", topic: "Trova amici per passeggiate e socializzazione", speciesTag: "all", createdAt: Date.now() },
    { id: "adoptions", name: "Adozioni", topic: "Annunci adozione, canili e trovatelli", speciesTag: "all", createdAt: Date.now() },
  ];

  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    const existing = demoRead<CommunityGroup[]>(DEMO_GROUPS_KEY, []);
    const map = new Map(existing.map((g) => [g.id, g] as const));
    for (const d of defaults) {
      if (map.has(d.id)) continue;
      map.set(d.id, { id: d.id, name: d.name, topic: d.topic, speciesTag: d.speciesTag, createdAt: d.createdAt });
    }
    demoWrite<CommunityGroup[]>(DEMO_GROUPS_KEY, Array.from(map.values()));
    return;
  }

  const { db } = getFirebase();
  await Promise.all(
    defaults.map((g) =>
      setDoc(
        doc(db, "groups", g.id),
        {
          name: g.name,
          topic: g.topic,
          speciesTag: g.speciesTag,
          createdAt: g.createdAt,
        },
        { merge: true }
      )
    )
  );
}

export function subscribeGroups(onData: (groups: CommunityGroup[]) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    return demoSubscribe<CommunityGroup[]>(DEMO_GROUPS_KEY, [], (all) => {
      const items = all.slice().sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    });
  }
  const q = query(groupsCol(), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const groups: CommunityGroup[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityGroup, "id">) }));
      onData(groups);
    },
    (err) => {
      onError?.(err);
      reportFirestoreError(err, "groups:list");
      onData([]);
    }
  );
}

export function subscribeGroupMessages(groupId: string, onData: (msgs: CommunityGroupMessage[]) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    return demoSubscribe<CommunityGroupMessage[]>(demoMessagesKey(groupId), [], (all) => {
      const items = all.slice().sort((a, b) => a.createdAt - b.createdAt).slice(-120);
      onData(items);
    });
  }
  const q = query(messagesCol(groupId), orderBy("createdAt", "desc"), limit(120));
  return onSnapshot(
    q,
    (snap) => {
      const msgs: CommunityGroupMessage[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityGroupMessage, "id">) }))
        .slice()
        .reverse();
      onData(msgs);
    },
    (err) => {
      onError?.(err);
      reportFirestoreError(err, "groups:messages");
      onData([]);
    }
  );
}

export function subscribeGroupMembership(groupId: string, uid: string, onData: (isMember: boolean) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    return demoSubscribe<CommunityGroupMember[]>(demoMembersKey(groupId), [], (all) => {
      onData(all.some((m) => m.uid === uid));
    });
  }
  return onSnapshot(
    doc(getFirebase().db, "groups", groupId, "members", uid),
    (snap) => {
      onData(snap.exists());
    },
    (err) => {
      onError?.(err);
      reportFirestoreError(err, "groups:membership");
      onData(false);
    }
  );
}

export async function joinGroup(groupId: string, uid: string) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
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
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    demoUpdate<CommunityGroupMember[]>(demoMembersKey(groupId), [], (prev) => prev.filter((m) => m.uid !== uid));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "groups", groupId, "members", uid));
}

export async function sendGroupMessage(groupId: string, input: Omit<CommunityGroupMessage, "id">) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    const id = demoId();
    const next: CommunityGroupMessage = { id, ...(input as Omit<CommunityGroupMessage, "id">) };
    demoUpdate<CommunityGroupMessage[]>(demoMessagesKey(groupId), [], (prev) => [...prev, next]);
    return id;
  }
  const ref = await addDoc(messagesCol(groupId), { ...input, status: "active", reportCount: 0 });
  return ref.id;
}

export async function reportGroupMessage(groupId: string, messageId: string, reporterId: string, reason: string) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) return;
  const { db } = getFirebase();
  await setDoc(
    doc(db, "groups", groupId, "messages", messageId, "reports", reporterId),
    { reporterId, reason: reason.trim(), createdAt: Date.now() },
    { merge: true }
  );
}

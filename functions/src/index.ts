import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import OpenAI from "openai";
import Stripe from "stripe";
import { createHash } from "crypto";

setGlobalOptions({ region: "us-central1", maxInstances: 1, cpu: 0.25 });

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const adminAuth = getAuth();

async function recountReports(ref: FirebaseFirestore.CollectionReference, max: number) {
  const snap = await ref.orderBy("createdAt", "desc").limit(max).get();
  return snap.size;
}

const SKIP_AI = process.env.SKIP_AI === "1";
const MS_ENABLE_SIMULATION = process.env.MS_ENABLE_SIMULATION === "1";
const OPENAI_API_KEY = SKIP_AI ? null : defineSecret("OPENAI_API_KEY");

const BILLING_DISABLED = process.env.BILLING_DISABLED !== "0";
const BETA_PRO_UNTIL_MS = Number(process.env.BETA_PRO_UNTIL_MS || "0") || 0;
const APP_URL = process.env.APP_URL || "";
const STRIPE_TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || "30") || 30;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "";

const STRIPE_SECRET_KEY = BILLING_DISABLED ? null : defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = BILLING_DISABLED ? null : defineSecret("STRIPE_WEBHOOK_SECRET");

function requireAppUrl() {
  if (!APP_URL) throw new Error("APP_URL env missing");
  return APP_URL;
}

type UserDoc = {
  plan?: unknown;
  email?: unknown;
  stripeCustomerId?: unknown;
};

type UsageDoc = {
  aiCalls?: unknown;
};

type NotificationDoc = {
  type?: unknown;
};

type AgendaEventDoc = {
  petId?: unknown;
  title?: unknown;
  dueAt?: unknown;
  kind?: unknown;
  reminderMinutesBefore?: unknown;
  reminderSentAt?: unknown;
};

type TaskDoc = {
  petId?: unknown;
  title?: unknown;
  dueAt?: unknown;
  status?: unknown;
  reminderSentAt?: unknown;
  source?: unknown;
};

type GroupMessageDoc = {
  groupId?: unknown;
  authorId?: unknown;
  createdAt?: unknown;
  text?: unknown;
};

type GroupMemberDoc = {
  uid?: unknown;
  joinedAt?: unknown;
};

async function deleteCollection(ref: FirebaseFirestore.CollectionReference, batchSize: number) {
  let snap = await ref.orderBy("__name__").limit(batchSize).get();
  while (!snap.empty) {
    const batch = db.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    snap = await ref.orderBy("__name__").limit(batchSize).get();
  }
}

async function safeDeleteStoragePath(path: string) {
  const p = String(path || "").trim();
  if (!p) return;
  try {
    await bucket.file(p).delete({ ignoreNotFound: true } as { ignoreNotFound: boolean });
  } catch {
    return;
  }
}

function parsePlan(v: unknown): "free" | "pro" {
  return v === "pro" ? "pro" : "free";
}

function isBetaProEnabled(nowMs: number) {
  if (BILLING_DISABLED) return true;
  if (!BETA_PRO_UNTIL_MS) return false;
  return nowMs <= BETA_PRO_UNTIL_MS;
}

function getStripe(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
}

async function getOrCreateStripeCustomer(stripe: Stripe, uid: string, email?: string | null) {
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = snap.exists ? (snap.data() as UserDoc).stripeCustomerId : null;
  if (existing) return String(existing);

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { firebaseUID: uid },
  });
  await userRef.set({ stripeCustomerId: customer.id, updatedAt: Date.now() }, { merge: true });
  return customer.id;
}

async function setUserPlanFromSubscription(uid: string, input: { plan: "free" | "pro"; stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string; currentPeriodEnd?: number }) {
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        plan: input.plan,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        subscriptionStatus: input.subscriptionStatus ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        planUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

async function createPetNotification(
  petId: string,
  input: { type: string; title: string; body: string; severity: "info" | "warning" | "danger"; data?: Record<string, string> }
) {
  const ownerId = await getPetOwnerId(petId);
  if (ownerId && !(await shouldCreateNotificationForOwner(ownerId, input.type))) return;

  await db.collection("pets").doc(petId).collection("notifications").add({
    petId,
    createdBy: ownerId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    severity: input.severity,
    createdAt: Date.now(),
    read: false,
  });

  if (ownerId) {
    await sendPushToUser(ownerId, {
      title: input.title,
      body: input.body,
      data: {
        petId,
        type: input.type,
        severity: input.severity,
        url: `/app/notifications?petId=${petId}`,
        ...(input.data ?? {}),
      },
    });
  }
}

async function hasRecentNotification(petId: string, type: string, sinceMs: number) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection("notifications")
    .where("createdAt", ">=", sinceMs)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.some((d) => String((d.data() as NotificationDoc).type ?? "") === type);
}

async function fetchRecentLogsSince(petId: string, fromMs: number, limitCount: number) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection("logs")
    .where("occurredAt", ">=", fromMs)
    .orderBy("occurredAt", "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map(
    (d) =>
      d.data() as {
        type?: string;
        occurredAt?: number;
        note?: string;
        value?: { amount?: number; unit?: string; tags?: string[] };
      }
  );
}

async function fetchSubcollection(petId: string, name: string, limitCount: number) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection(name)
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}

async function fetchSubcollectionByTs(petId: string, name: string, tsField: string, fromMs: number, toMs: number, limitCount: number) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection(name)
    .where(tsField, ">=", fromMs)
    .where(tsField, "<=", toMs)
    .orderBy(tsField, "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}

function toMl(amount: unknown, unit: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof unit !== "string" || !unit.trim()) return amount;
  const u = unit.trim().toLowerCase();
  if (u === "ml") return amount;
  if (u === "l" || u === "lt" || u === "liter" || u === "litri") return amount * 1000;
  return null;
}

async function fetchLatestGpsPoint(petId: string) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection("gpsPoints")
    .orderBy("recordedAt", "desc")
    .limit(1)
    .get();
  const d = snap.docs[0]?.data() as { lat?: unknown; lng?: unknown; recordedAt?: unknown } | undefined;
  if (!d) return null;
  const lat = typeof d.lat === "number" ? d.lat : NaN;
  const lng = typeof d.lng === "number" ? d.lng : NaN;
  const recordedAt = typeof d.recordedAt === "number" ? d.recordedAt : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(recordedAt)) return null;
  return { lat, lng, recordedAt };
}

async function fetchCurrentTempC(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&current_weather=true`;
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) return null;
  const j = (await r.json()) as { current_weather?: { temperature?: unknown } };
  const t = j.current_weather?.temperature;
  return typeof t === "number" && Number.isFinite(t) ? t : null;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function getEffectivePlan(uid: string) {
  const userSnap = await db.collection("users").doc(uid).get();
  const plan = parsePlan(userSnap.exists ? (userSnap.data() as UserDoc).plan : "free");
  const now = Date.now();
  return isBetaProEnabled(now) ? "pro" : plan;
}

async function requirePro(uid: string) {
  const effectivePlan = await getEffectivePlan(uid);
  if (effectivePlan !== "pro") throw new HttpsError("permission-denied", "Pro required");
}

async function enforceAiQuota(uid: string) {
  const userRef = db.collection("users").doc(uid);
  const today = ymd(new Date());
  const usageRef = userRef.collection("usage").doc(today);

  const now = Date.now();
  const betaPro = isBetaProEnabled(now);

  const { plan, used } = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const plan = parsePlan(userSnap.exists ? (userSnap.data() as UserDoc).plan : "free");
    const usageSnap = await tx.get(usageRef);
    const used = usageSnap.exists ? Number((usageSnap.data() as UsageDoc).aiCalls ?? 0) : 0;
    const nextUsed = used + 1;
    tx.set(usageRef, { aiCalls: nextUsed, updatedAt: Date.now() }, { merge: true });
    return { plan, used: nextUsed };
  });

  const effectivePlan: "free" | "pro" = betaPro ? "pro" : plan;
  const limit = effectivePlan === "pro" ? 200 : 20;
  if (used > limit) {
    throw new HttpsError("resource-exhausted", "Daily AI limit reached. Upgrade to Pro for higher limits.");
  }
}

export const billingStatus = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const userSnap = await db.collection("users").doc(uid).get();
  const plan = parsePlan(userSnap.exists ? (userSnap.data() as UserDoc).plan : "free");
  const now = Date.now();
  const betaPro = isBetaProEnabled(now);

  return {
    billingEnabled: !BILLING_DISABLED,
    betaProEnabled: betaPro,
    betaProUntilMs: BETA_PRO_UNTIL_MS || null,
    plan,
    effectivePlan: betaPro ? "pro" : plan,
  };
});

export const billingCreateCheckoutSession = BILLING_DISABLED
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "Billing is disabled (beta mode).");
    })
  : onCall({ secrets: [STRIPE_SECRET_KEY!] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const now = Date.now();
  if (BILLING_DISABLED || isBetaProEnabled(now)) throw new HttpsError("failed-precondition", "Billing is disabled (beta mode).");
  if (!STRIPE_PRICE_PRO) throw new HttpsError("failed-precondition", "STRIPE_PRICE_PRO is not configured.");

  const stripe = getStripe(STRIPE_SECRET_KEY!.value());
  const userSnap = await db.collection("users").doc(uid).get();
  const email = userSnap.exists ? (userSnap.data() as UserDoc).email : null;
  const emailStr = typeof email === "string" ? email : null;
  const customerId = await getOrCreateStripeCustomer(stripe, uid, emailStr);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_PRO, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { trial_period_days: STRIPE_TRIAL_DAYS, metadata: { firebaseUID: uid } },
    metadata: { firebaseUID: uid },
    success_url: `${requireAppUrl()}/app/settings?checkout=success`,
    cancel_url: `${requireAppUrl()}/app/settings?checkout=cancel`,
  });

  return { url: session.url };
  });

export const billingCreatePortalSession = BILLING_DISABLED
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "Billing is disabled (beta mode).");
    })
  : onCall({ secrets: [STRIPE_SECRET_KEY!] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  if (BILLING_DISABLED) throw new HttpsError("failed-precondition", "Billing is disabled (beta mode).");

  const stripe = getStripe(STRIPE_SECRET_KEY!.value());
  const userSnap = await db.collection("users").doc(uid).get();
  const customerId = userSnap.exists ? String((userSnap.data() as UserDoc).stripeCustomerId ?? "") : "";
  if (!customerId) throw new HttpsError("failed-precondition", "No Stripe customer.");

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${requireAppUrl()}/app/settings`,
  });

  return { url: session.url };
  });

export const exportPetDataPro = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  await requirePro(uid);

  const petId = String(req.data?.petId ?? "");
  const range = req.data?.range as { fromMs?: unknown; toMs?: unknown } | undefined;
  const fromMs = typeof range?.fromMs === "number" ? range!.fromMs : Date.now() - 365 * 24 * 60 * 60 * 1000;
  const toMs = typeof range?.toMs === "number" ? range!.toMs : Date.now();
  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) throw new HttpsError("invalid-argument", "invalid range");
  await assertPetAccess(petId, uid);

  const petSnap = await db.collection("pets").doc(petId).get();
  const pet = petSnap.exists ? ({ id: petSnap.id, ...(petSnap.data() as Record<string, unknown>) }) : null;

  const [
    logs,
    healthEvents,
    gpsPoints,
    agendaEvents,
    tasks,
    routines,
    documents,
    expenses,
    notifications,
    vaccines,
    medications,
    bookings,
  ] = await Promise.all([
    fetchSubcollectionByTs(petId, "logs", "occurredAt", fromMs, toMs, 3000),
    fetchSubcollectionByTs(petId, "healthEvents", "occurredAt", fromMs, toMs, 1500),
    fetchSubcollectionByTs(petId, "gpsPoints", "recordedAt", fromMs, toMs, 3000),
    fetchSubcollectionByTs(petId, "agendaEvents", "dueAt", fromMs, toMs, 1500),
    fetchSubcollection(petId, "tasks", 3000),
    fetchSubcollection(petId, "routines", 500),
    fetchSubcollection(petId, "documents", 1000),
    fetchSubcollection(petId, "expenses", 2000),
    fetchSubcollectionByTs(petId, "notifications", "createdAt", fromMs, toMs, 2000),
    fetchSubcollection(petId, "vaccines", 500),
    fetchSubcollection(petId, "medications", 500),
    fetchSubcollection(petId, "bookings", 500),
  ]);

  const payload = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    range: { fromMs, toMs },
    pet,
    collections: {
      logs,
      healthEvents,
      gpsPoints,
      agendaEvents,
      tasks,
      routines,
      documents,
      expenses,
      notifications,
      vaccines,
      medications,
      bookings,
    },
  };

  const ts = Date.now();
  const path = `exports/${uid}/pet-${petId}-${ts}.json`;
  await bucket.file(path).save(JSON.stringify(payload), { contentType: "application/json" });
  const [url] = await bucket.file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
    responseDisposition: `attachment; filename="petlyon-pet-${petId}.json"`,
    responseType: "application/json",
  });
  return { url };
});

export const exportAccountDataPro = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  await requirePro(uid);

  const range = req.data?.range as { fromMs?: unknown; toMs?: unknown } | undefined;
  const fromMs = typeof range?.fromMs === "number" ? range!.fromMs : Date.now() - 365 * 24 * 60 * 60 * 1000;
  const toMs = typeof range?.toMs === "number" ? range!.toMs : Date.now();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) throw new HttpsError("invalid-argument", "invalid range");

  const petsSnap = await db.collection("pets").where("ownerId", "==", uid).orderBy("createdAt", "desc").limit(50).get();
  const petIds = petsSnap.docs.map((d) => d.id);

  const pets = await Promise.all(
    petIds.map(async (petId) => {
      const pet = { id: petId, ...(petsSnap.docs.find((d) => d.id === petId)!.data() as Record<string, unknown>) };
      const [
        logs,
        healthEvents,
        gpsPoints,
        agendaEvents,
        tasks,
        routines,
        documents,
        expenses,
        notifications,
        vaccines,
        medications,
        bookings,
      ] = await Promise.all([
        fetchSubcollectionByTs(petId, "logs", "occurredAt", fromMs, toMs, 3000),
        fetchSubcollectionByTs(petId, "healthEvents", "occurredAt", fromMs, toMs, 1500),
        fetchSubcollectionByTs(petId, "gpsPoints", "recordedAt", fromMs, toMs, 3000),
        fetchSubcollectionByTs(petId, "agendaEvents", "dueAt", fromMs, toMs, 1500),
        fetchSubcollection(petId, "tasks", 3000),
        fetchSubcollection(petId, "routines", 500),
        fetchSubcollection(petId, "documents", 1000),
        fetchSubcollection(petId, "expenses", 2000),
        fetchSubcollectionByTs(petId, "notifications", "createdAt", fromMs, toMs, 2000),
        fetchSubcollection(petId, "vaccines", 500),
        fetchSubcollection(petId, "medications", 500),
        fetchSubcollection(petId, "bookings", 500),
      ]);
      return {
        schemaVersion: 1,
        exportedAt: Date.now(),
        range: { fromMs, toMs },
        pet,
        collections: {
          logs,
          healthEvents,
          gpsPoints,
          agendaEvents,
          tasks,
          routines,
          documents,
          expenses,
          notifications,
          vaccines,
          medications,
          bookings,
        },
      };
    })
  );

  const userSnap = await db.collection("users").doc(uid).get();
  const email = userSnap.exists ? (userSnap.data() as UserDoc).email : null;

  const payload = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    range: { fromMs, toMs },
    user: { uid, email: typeof email === "string" ? email : null },
    pets,
  };

  const ts = Date.now();
  const path = `exports/${uid}/account-${ts}.json`;
  await bucket.file(path).save(JSON.stringify(payload), { contentType: "application/json" });
  const [url] = await bucket.file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
    responseDisposition: `attachment; filename="petlyon-account-${uid}.json"`,
    responseType: "application/json",
  });
  return { url };
});

export const stripeWebhook = BILLING_DISABLED
  ? onRequest(async (_req, res) => {
      res.status(404).send("Billing disabled");
    })
  : onRequest({ secrets: [STRIPE_SECRET_KEY!, STRIPE_WEBHOOK_SECRET!] }, async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).send("Missing Stripe signature");
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe(STRIPE_SECRET_KEY!.value());
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET!.value());
  } catch {
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = String(session.metadata?.firebaseUID ?? "");
      if (uid) {
        const customerId = typeof session.customer === "string" ? session.customer : undefined;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;
        await setUserPlanFromSubscription(uid, {
          plan: "pro",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const uid = String(sub.metadata?.firebaseUID ?? "");
      if (uid) {
        const status = sub.status;
        const plan: "free" | "pro" = status === "active" || status === "trialing" ? "pro" : "free";
        const customerId = typeof sub.customer === "string" ? sub.customer : undefined;
        const currentPeriodEnd = typeof sub.current_period_end === "number" ? sub.current_period_end * 1000 : undefined;
        await setUserPlanFromSubscription(uid, {
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          subscriptionStatus: status,
          currentPeriodEnd,
        });
      }
    }

    res.json({ received: true });
  } catch {
    res.status(500).send("Webhook handler failed");
  }
  });

export const sharedRecordAttachmentUrl = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const token = typeof req.query.token === "string" ? req.query.token : "";
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!token || !path) {
    res.status(400).json({ error: "missing_params" });
    return;
  }

  const shareSnap = await db.collection("recordShares").doc(token).get();
  if (!shareSnap.exists) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const share = shareSnap.data() as { expiresAt?: unknown; petId?: unknown; items?: unknown };
  const expiresAt = typeof share.expiresAt === "number" ? share.expiresAt : 0;
  const petId = typeof share.petId === "string" ? share.petId : "";
  if (!expiresAt || Date.now() > expiresAt) {
    res.status(410).json({ error: "expired" });
    return;
  }
  if (!petId) {
    res.status(400).json({ error: "invalid_share" });
    return;
  }

  const items = Array.isArray(share.items) ? share.items : [];
  const allowed = items.some((it) => {
    const att = (it as { attachment?: unknown })?.attachment as { storagePath?: unknown } | undefined;
    return typeof att?.storagePath === "string" && att.storagePath === path;
  });
  if (!allowed) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  if (!path.startsWith(`pets/${petId}/documents/`)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const signedUntil = Math.min(expiresAt, Date.now() + 5 * 60 * 1000);
  const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires: signedUntil });
  res.status(200).json({ url });
});

async function getPetOwnerId(petId: string) {
  const snap = await db.collection("pets").doc(petId).get();
  if (!snap.exists) return null;
  const pet = snap.data() as { ownerId?: string };
  return pet.ownerId ?? null;
}

async function shouldCreateNotificationForOwner(ownerId: string, type: string) {
  const userSnap = await db.collection("users").doc(ownerId).get();
  const prefs = (userSnap.data() as { preferences?: { gpsEnabled?: unknown; communityEnabled?: unknown } } | undefined)?.preferences;
  if (type.startsWith("gps_") && prefs?.gpsEnabled === false) return false;
  if (type.startsWith("group_message") && prefs?.communityEnabled === false) return false;
  if (type.startsWith("post_") && prefs?.communityEnabled === false) return false;
  return true;
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; data: Record<string, string> }) {
  const userSnap = await db.collection("users").doc(userId).get();
  const prefs = (userSnap.data() as {
    preferences?: {
      pushEnabled?: unknown;
      quietHoursEnabled?: unknown;
      quietHoursStart?: unknown;
      quietHoursEnd?: unknown;
    };
  })?.preferences;

  const pushEnabled = prefs?.pushEnabled === undefined ? true : Boolean(prefs?.pushEnabled);
  if (!pushEnabled) return;

  const quietEnabled = prefs?.quietHoursEnabled === true;
  if (quietEnabled) {
    const start = typeof prefs?.quietHoursStart === "string" ? prefs?.quietHoursStart : "22:00";
    const end = typeof prefs?.quietHoursEnd === "string" ? prefs?.quietHoursEnd : "07:00";
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const inRange = start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
    if (inRange) return;
  }

  const tokensSnap = await db.collection("users").doc(userId).collection("pushTokens").get();
  const tokens = tokensSnap.docs.map((d) => String((d.data() as { token?: string }).token ?? d.id)).filter(Boolean);
  if (tokens.length === 0) return;

  try {
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });

    const toDelete: string[] = [];
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = (r.error as { code?: string } | undefined)?.code;
      if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
        toDelete.push(tokens[idx]);
      }
    });

    await Promise.all(toDelete.map((t) => db.collection("users").doc(userId).collection("pushTokens").doc(t).delete()));
  } catch {
    return;
  }
}

function getOpenAi(apiKey: string | undefined) {
  const key = String(apiKey || process.env.OPENAI_API_KEY || "");
  if (!key) throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: key });
}

async function assertPetAccess(petId: string, uid: string) {
  const petRef = db.collection("pets").doc(petId);
  const petSnap = await petRef.get();
  if (!petSnap.exists) {
    throw new HttpsError("not-found", "Pet not found");
  }
  const pet = petSnap.data() as { ownerId?: string };
  if (!pet.ownerId || pet.ownerId !== uid) {
    throw new HttpsError("permission-denied", "No access to this pet");
  }
}

async function fetchRecentLogs(petId: string, fromMs: number, limitCount: number) {
  const snap = await db
    .collection("pets")
    .doc(petId)
    .collection("logs")
    .where("occurredAt", ">=", fromMs)
    .orderBy("occurredAt", "desc")
    .limit(limitCount)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}

export const aiGenerateSummary = SKIP_AI
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "AI is not configured");
    })
  : onCall({ secrets: [OPENAI_API_KEY!] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  await enforceAiQuota(uid);

  const petId = String(req.data?.petId ?? "");
  const days = Number(req.data?.days ?? 7);
  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new HttpsError("invalid-argument", "days must be between 1 and 365");
  }

  await assertPetAccess(petId, uid);

  const fromMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = await fetchRecentLogs(petId, fromMs, 200);
  const citations = logs.slice(0, 30).map((l) => ({ kind: "log" as const, id: l.id }));

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = getOpenAi(OPENAI_API_KEY?.value());

  const prompt = [
    "You are PetLyon AI.",
    "You summarize pet care logs for the owner.",
    "You must be practical and cautious.",
    "You must include a short non-medical disclaimer.",
    "If symptoms look urgent, advise contacting a veterinarian.",
    "Return plain text with these sections:",
    "1) Highlights",
    "2) Patterns",
    "3) Suggested actions (owner-approved)",
    "4) Disclaimer",
    "",
    `Time window: last ${days} days.`,
    "Logs (most recent first):",
    JSON.stringify(logs),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const summary = completion.choices[0]?.message?.content ?? "";

  return { summary, citations };
  });

export const aiChat = SKIP_AI
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "AI is not configured");
    })
  : onCall({ secrets: [OPENAI_API_KEY!] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  await enforceAiQuota(uid);

  const petId = String(req.data?.petId ?? "");
  const conversationId = String(req.data?.conversationId ?? "").trim() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const message = String(req.data?.message ?? "").trim();
  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!message) throw new HttpsError("invalid-argument", "message is required");

  await assertPetAccess(petId, uid);

  const fromMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const logs = await fetchRecentLogs(petId, fromMs, 120);
  const citations = logs.slice(0, 20).map((l) => ({ kind: "log" as const, id: l.id }));

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = getOpenAi(OPENAI_API_KEY?.value());

  const system = [
    "You are PetLyon AI.",
    "Answer questions grounded in provided logs.",
    "If you are unsure, say what is missing.",
    "Do not diagnose; suggest contacting a veterinarian when appropriate.",
    "Keep answers short and actionable.",
  ].join("\n");

  const userPrompt = [
    `Question: ${message}`,
    "",
    "Context logs (most recent first):",
    JSON.stringify(logs),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
  });

  const answer = completion.choices[0]?.message?.content ?? "";

  return { answer, citations, conversationId };
  });

export const aiVisionAnalyze = SKIP_AI
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "AI is not configured");
    })
  : onCall({ secrets: [OPENAI_API_KEY!] }, async (req) => {
      const uid = req.auth?.uid;
      if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

      await enforceAiQuota(uid);

      const petId = String(req.data?.petId ?? "");
      const imageDataUrl = String(req.data?.imageDataUrl ?? "");
      const prompt = String(req.data?.prompt ?? "");
      if (!petId) throw new HttpsError("invalid-argument", "petId is required");
      if (!imageDataUrl.startsWith("data:image/")) throw new HttpsError("invalid-argument", "imageDataUrl must be a data URL");
      if (!prompt.trim()) throw new HttpsError("invalid-argument", "prompt is required");
      if (imageDataUrl.length > 1_800_000) throw new HttpsError("invalid-argument", "image is too large");

      await assertPetAccess(petId, uid);

      const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
      const client = getOpenAi(OPENAI_API_KEY?.value());

      const system = [
        "You are PetLyon AI.",
        "You may be given an image and a user instruction.",
        "Do not diagnose or prescribe.",
        "If the image is unclear, say what to improve (lighting, focus) and what data is missing.",
      ].join("\n");

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.2,
      });

      const answer = completion.choices[0]?.message?.content ?? "";
      const citations: Array<{ kind: "log" | "task"; id: string }> = [];
      return { answer, citations };
    });

export const aiVisionAnalyzeMulti = SKIP_AI
  ? onCall(async () => {
      throw new HttpsError("failed-precondition", "AI is not configured");
    })
  : onCall({ secrets: [OPENAI_API_KEY!] }, async (req) => {
      const uid = req.auth?.uid;
      if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

      await enforceAiQuota(uid);

      const petId = String(req.data?.petId ?? "");
      const prompt = String(req.data?.prompt ?? "");
      const imageDataUrlsRaw = Array.isArray(req.data?.imageDataUrls) ? req.data.imageDataUrls : null;
      const imageDataUrls = imageDataUrlsRaw ? imageDataUrlsRaw.map((x: unknown) => String(x)).filter(Boolean).slice(0, 6) : [];

      if (!petId) throw new HttpsError("invalid-argument", "petId is required");
      if (!prompt.trim()) throw new HttpsError("invalid-argument", "prompt is required");
      if (imageDataUrls.length === 0) throw new HttpsError("invalid-argument", "imageDataUrls is required");
      if (imageDataUrls.some((u: string) => !u.startsWith("data:image/"))) throw new HttpsError("invalid-argument", "all images must be data URLs");
      if (imageDataUrls.some((u: string) => u.length > 900_000)) throw new HttpsError("invalid-argument", "one image is too large");

      await assertPetAccess(petId, uid);

      const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
      const client = getOpenAi(OPENAI_API_KEY?.value());

      const system = [
        "You are PetLyon AI.",
        "You may be given multiple images extracted from a short video.",
        "Do not diagnose or prescribe.",
        "If the images are unclear, say what to improve (lighting, focus) and what data is missing.",
      ].join("\n");

      const content = [
        { type: "text" as const, text: prompt },
        ...imageDataUrls.map((url: string) => ({ type: "image_url" as const, image_url: { url } })),
      ];

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        temperature: 0.2,
      });

      const answer = completion.choices[0]?.message?.content ?? "";
      const citations: Array<{ kind: "log" | "task"; id: string }> = [];
      return { answer, citations };
    });

export const likePost = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const postId = String(req.data?.postId ?? "");
  if (!postId) throw new HttpsError("invalid-argument", "postId is required");
  const ref = db.collection("posts").doc(postId);
  const likeRef = ref.collection("likes").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Post not found");
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists) return;
    const prev = Number((snap.data() as { likeCount?: number }).likeCount ?? 0);
    tx.set(likeRef, { uid, createdAt: Date.now() }, { merge: true });
    tx.update(ref, { likeCount: prev + 1 });
  });
  return { ok: true };
});

export const onHealthEventCreated = onDocumentCreated("pets/{petId}/healthEvents/{eventId}", async (event) => {
  const petId = event.params.petId as string;
  const data = event.data?.data() as { type?: string; title?: string; severity?: string; occurredAt?: number } | undefined;
  if (!data) return;
  if (data.type === "symptom" && data.severity === "high") {
    await createPetNotification(petId, {
      type: "health_symptom_high",
      title: "High-severity symptom logged",
      body: data.title ? `Symptom: ${data.title}` : "A high-severity symptom was logged.",
      severity: "danger",
    });
  }
});

export const onGpsPointCreated = onDocumentCreated("pets/{petId}/gpsPoints/{pointId}", async (event) => {
  const petId = event.params.petId as string;
  const p = event.data?.data() as { lat?: number; lng?: number; recordedAt?: number } | undefined;
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return;

  const petSnap = await db.collection("pets").doc(petId).get();
  if (!petSnap.exists) return;
  const pet = petSnap.data() as { geofence?: { enabled?: boolean; centerLat?: number; centerLng?: number; radiusM?: number } };
  const g = pet.geofence;
  if (!g?.enabled || typeof g.centerLat !== "number" || typeof g.centerLng !== "number" || typeof g.radiusM !== "number") return;

  const dist = haversineMeters({ lat: g.centerLat, lng: g.centerLng }, { lat: p.lat, lng: p.lng });
  if (dist > g.radiusM) {
    const dedupeFrom = Date.now() - 30 * 60 * 1000;
    if (await hasRecentNotification(petId, "gps_outside_geofence", dedupeFrom)) return;
    await createPetNotification(petId, {
      type: "gps_outside_geofence",
      title: "Fuori zona sicura",
      body: `Ultimo punto a ~${Math.round(dist)} m dal centro (raggio ${Math.round(g.radiusM)} m).`,
      severity: "warning",
    });
  }
});

export const gpsIngestPoint = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    res.status(415).json({ error: "unsupported_media_type" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const petId = typeof body.petId === "string" ? body.petId : "";
  const token = typeof body.token === "string" ? body.token : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;
  const accuracyM = typeof body.accuracyM === "number" ? body.accuracyM : undefined;
  const recordedAt = typeof body.recordedAt === "number" ? body.recordedAt : Date.now();

  if (!petId || !token) {
    res.status(400).json({ error: "missing_params" });
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "invalid_coords" });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "coords_out_of_range" });
    return;
  }

  if (accuracyM !== undefined && (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 5000)) {
    res.status(400).json({ error: "invalid_accuracy" });
    return;
  }

  const petSnap = await db.collection("pets").doc(petId).get();
  if (!petSnap.exists) {
    res.status(404).json({ error: "pet_not_found" });
    return;
  }
  const pet = petSnap.data() as { gpsIngestToken?: unknown };

  const now = Date.now();
  if (!Number.isFinite(recordedAt) || recordedAt < now - 366 * 24 * 60 * 60 * 1000 || recordedAt > now + 5 * 60 * 1000) {
    res.status(400).json({ error: "invalid_recordedAt" });
    return;
  }

  const ip = String((req.headers["x-forwarded-for"] as string | undefined) || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const key = `gps:${petId}:${ip}`;
  const bucketAny = (globalThis as unknown as { __gpsBuckets?: Map<string, { count: number; resetAt: number }> }).__gpsBuckets;
  const buckets = bucketAny ?? new Map<string, { count: number; resetAt: number }>();
  (globalThis as unknown as { __gpsBuckets?: Map<string, { count: number; resetAt: number }> }).__gpsBuckets = buckets;
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else {
    b.count += 1;
    if (b.count > 120) {
      res.status(429).set("Retry-After", String(Math.max(1, Math.ceil((b.resetAt - now) / 1000)))).json({ error: "rate_limited" });
      return;
    }
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  let source = "device";
  if (deviceId) {
    const devRef = db.collection("pets").doc(petId).collection("gpsDevices").doc(deviceId);
    const devSnap = await devRef.get();
    if (!devSnap.exists) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const dev = devSnap.data() as { enabled?: unknown; tokenHash?: unknown };
    if (dev.enabled === false) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (typeof dev.tokenHash !== "string" || dev.tokenHash !== tokenHash) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    source = `device:${deviceId}`;
    await devRef.set({ lastSeenAt: now, updatedAt: now }, { merge: true });
  } else {
    if (typeof pet.gpsIngestToken !== "string" || pet.gpsIngestToken !== token) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  }

  await db
    .collection("pets")
    .doc(petId)
    .collection("gpsPoints")
    .add({
      petId,
      lat,
      lng,
      accuracyM,
      recordedAt,
      createdAt: now,
      createdBy: source,
    });

  res.status(200).json({ ok: true });
});

export const deviceIngestLog = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const petId = typeof body.petId === "string" ? body.petId : "";
  const token = typeof body.token === "string" ? body.token : "";
  const type = typeof body.type === "string" ? body.type : "";
  const occurredAt = typeof body.occurredAt === "number" ? body.occurredAt : Date.now();
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const amount = typeof body.amount === "number" ? body.amount : undefined;
  const unit = typeof body.unit === "string" ? body.unit : undefined;
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)).filter(Boolean).slice(0, 12) : undefined;

  if (!petId || !token) {
    res.status(400).json({ error: "missing_params" });
    return;
  }

  const allowed = new Set(["water", "activity", "food", "weight"]);
  if (!allowed.has(type)) {
    res.status(400).json({ error: "invalid_type" });
    return;
  }

  if (!Number.isFinite(occurredAt) || occurredAt < 0) {
    res.status(400).json({ error: "invalid_occurredAt" });
    return;
  }

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  const petSnap = await db.collection("pets").doc(petId).get();
  if (!petSnap.exists) {
    res.status(404).json({ error: "pet_not_found" });
    return;
  }
  const pet = petSnap.data() as { deviceIngestToken?: unknown };
  if (typeof pet.deviceIngestToken !== "string" || pet.deviceIngestToken !== token) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const now = Date.now();
  await db
    .collection("pets")
    .doc(petId)
    .collection("logs")
    .add({
      petId,
      type,
      occurredAt,
      note: note || undefined,
      value: amount !== undefined || unit !== undefined || tags !== undefined ? { amount, unit, tags } : undefined,
      createdAt: now,
      createdBy: "device",
    });

  res.status(200).json({ ok: true });
});

export const submitFinderReportPublic = onCall({ maxInstances: 2 }, async (req) => {
  try {
    const body = (req.data ?? {}) as Record<string, unknown>;
    const publicIdRaw = typeof body.publicId === "string" ? body.publicId.trim() : "";
    const reportType = typeof body.reportType === "string" ? body.reportType : "";
    const reporterContactOptional = typeof body.reporterContactOptional === "string" ? body.reporterContactOptional.trim() : "";
    const locationTextOptional = typeof body.locationTextOptional === "string" ? body.locationTextOptional.trim() : "";
    const noteOptional = typeof body.noteOptional === "string" ? body.noteOptional.trim() : "";
    const hp = typeof body.hp === "string" ? body.hp.trim() : "";

    if (hp) throw new HttpsError("invalid-argument", "Invalid request");
    if (!/^[A-Z2-9]{6,24}$/.test(publicIdRaw)) throw new HttpsError("invalid-argument", "Invalid publicId");
    if (reportType !== "found" && reportType !== "sighted") throw new HttpsError("invalid-argument", "Invalid reportType");

    const contact = reporterContactOptional.slice(0, 80);
    const loc = locationTextOptional.slice(0, 120);
    const note = noteOptional.slice(0, 500);
    if (!contact && !loc) throw new HttpsError("invalid-argument", "Missing contact or location");

    const raw = (req as unknown as { rawRequest?: import("express").Request }).rawRequest;
    const ip = String((raw?.headers["x-forwarded-for"] as string | undefined) || raw?.socket?.remoteAddress || "unknown")
      .split(",")[0]
      .trim();
    const ua = String((raw?.headers["user-agent"] as string | undefined) || "unknown");
    const now = Date.now();

    const key = `finder:${publicIdRaw}:${ip}`;
    const bucketAny = (globalThis as unknown as { __finderBuckets?: Map<string, { count: number; resetAt: number }> }).__finderBuckets;
    const buckets = bucketAny ?? new Map<string, { count: number; resetAt: number }>();
    (globalThis as unknown as { __finderBuckets?: Map<string, { count: number; resetAt: number }> }).__finderBuckets = buckets;
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
    } else {
      b.count += 1;
      if (b.count > 3) throw new HttpsError("resource-exhausted", "Too many requests");
    }

    const cardSnap = await db.collection("petCards").doc(publicIdRaw).get();
    if (!cardSnap.exists) throw new HttpsError("not-found", "Pet card not found");
    const card = cardSnap.data() as { petId?: unknown; ownerId?: unknown; isLost?: unknown };
    const petId = typeof card.petId === "string" ? card.petId : "";
    const ownerId = typeof card.ownerId === "string" ? card.ownerId : "";
    if (!petId || !ownerId) throw new HttpsError("failed-precondition", "Invalid pet card");

    const ipHash = createHash("sha256").update(ip).digest("hex");
    const uaHash = createHash("sha256").update(ua).digest("hex");

    const reportRef = await db
      .collection("pets")
      .doc(petId)
      .collection("finderReports")
      .add({
        petId,
        publicId: publicIdRaw,
        reportType,
        reporterContactOptional: contact || null,
        locationTextOptional: loc || null,
        noteOptional: note || null,
        status: "new",
        ipHash,
        uaHash,
        createdAt: now,
        updatedAt: now,
      });

    await db
      .collection("pets")
      .doc(petId)
      .collection("safetyEvents")
      .add({
        petId,
        type: "finder_report_received",
        createdAt: now,
        related: { publicId: publicIdRaw, reportId: reportRef.id, reportType },
        summary: reportType === "found" ? "Segnalazione: trovato" : "Segnalazione: avvistato",
      });

    return { reportId: reportRef.id, ok: true, isLost: Boolean(card.isLost) };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", "Failed to submit report");
  }
});

export const setFinderReportStatusSecure = onCall({ maxInstances: 2 }, async (req) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
    const body = (req.data ?? {}) as Record<string, unknown>;
    const petId = typeof body.petId === "string" ? body.petId : "";
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!petId || !reportId) throw new HttpsError("invalid-argument", "Missing params");
    if (status !== "verified" && status !== "spam" && status !== "resolved") throw new HttpsError("invalid-argument", "Invalid status");

    const petSnap = await db.collection("pets").doc(petId).get();
    if (!petSnap.exists) throw new HttpsError("not-found", "Pet not found");
    const pet = petSnap.data() as { ownerId?: unknown };
    const ownerId = typeof pet.ownerId === "string" ? pet.ownerId : "";
    if (!ownerId || ownerId !== uid) throw new HttpsError("permission-denied", "Forbidden");

    const reportRef = db.collection("pets").doc(petId).collection("finderReports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError("not-found", "Report not found");
    const report = reportSnap.data() as { publicId?: unknown; reportType?: unknown };
    const publicId = typeof report.publicId === "string" ? report.publicId : "";
    const reportType = typeof report.reportType === "string" ? report.reportType : "";

    const now = Date.now();
    await reportRef.set({ status, handledBy: uid, handledAt: now, updatedAt: now }, { merge: true });

    const eventType = status === "verified" ? "finder_report_verified" : status === "spam" ? "finder_report_spam" : "finder_report_resolved";
    const summary =
      status === "verified" ? "Segnalazione verificata" : status === "spam" ? "Segnalazione marcata come spam" : "Segnalazione risolta";
    await db
      .collection("pets")
      .doc(petId)
      .collection("safetyEvents")
      .add({
        petId,
        type: eventType,
        createdAt: now,
        createdBy: uid,
        related: { publicId, reportId, reportType: reportType === "found" || reportType === "sighted" ? reportType : undefined },
        summary,
      });

    return { ok: true };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", "Failed to update report");
  }
});

export const onBookingCreated = onDocumentCreated("pets/{petId}/bookings/{bookingId}", async (event) => {
  const petId = event.params.petId as string;
  const data = event.data?.data() as { providerName?: string; providerKind?: string; scheduledAt?: number; confirmBy?: number; status?: string } | undefined;
  if (!data) return;
  const when = typeof data.scheduledAt === "number" ? new Date(data.scheduledAt).toLocaleString() : "";
  const confirm = typeof data.confirmBy === "number" ? new Date(data.confirmBy).toLocaleString() : null;
  await createPetNotification(petId, {
    type: "booking_requested",
    title: "Booking created",
    body: `${data.providerName ?? "Provider"} (${data.providerKind ?? "service"}) · ${when}${confirm ? ` · Confirm by ${confirm}` : ""}`,
    severity: "info",
  });
});

export const onPetDocumentDeleted = onDocumentDeleted("pets/{petId}/documents/{docId}", async (event) => {
  const data = event.data?.data() as { storagePath?: unknown } | undefined;
  const storagePath = typeof data?.storagePath === "string" ? data.storagePath : "";
  if (!storagePath || storagePath.startsWith("demo://")) return;
  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e || "");
    if (/No such object|404/i.test(msg)) return;
    throw e;
  }
});

export const bookingNoShowSweep = onSchedule("every 10 minutes", async () => {
  const now = Date.now();

  const requestedSnap = await db
    .collectionGroup("bookings")
    .where("status", "==", "requested")
    .where("confirmBy", "<=", now)
    .limit(50)
    .get();

  await Promise.all(
    requestedSnap.docs.map(async (d) => {
      const data = d.data() as { petId?: string; providerName?: string; scheduledAt?: number };
      await d.ref.set({ status: "cancelled", cancelReason: "no_confirm", updatedAt: Date.now() }, { merge: true });
      if (data.petId) {
        await createPetNotification(String(data.petId), {
          type: "booking_cancelled_no_confirm",
          title: "Booking auto-cancelled",
          body: `Not confirmed in time${data.providerName ? `: ${data.providerName}` : ""}.`,
          severity: "warning",
        });
      }
    })
  );

  const graceMs = 15 * 60 * 1000;
  const lateSnap = await db
    .collectionGroup("bookings")
    .where("status", "==", "confirmed")
    .where("scheduledAt", "<=", now - graceMs)
    .limit(50)
    .get();

  await Promise.all(
    lateSnap.docs.map(async (d) => {
      const data = d.data() as { petId?: string; providerName?: string };
      await d.ref.set({ status: "no_show", updatedAt: Date.now() }, { merge: true });
      if (data.petId) {
        await createPetNotification(String(data.petId), {
          type: "booking_no_show",
          title: "Marked as no-show",
          body: data.providerName ? `Booking with ${data.providerName} missed.` : "A booking was missed.",
          severity: "warning",
        });
      }
    })
  );
});

export const bookingReminderSweep = onSchedule("every 10 minutes", async () => {
  const now = Date.now();
  const in2h = now + 2 * 60 * 60 * 1000;
  const in24h = now + 24 * 60 * 60 * 1000;

  const confirmSoonSnap = await db
    .collectionGroup("bookings")
    .where("status", "==", "requested")
    .where("confirmBy", ">=", now)
    .where("confirmBy", "<=", in2h)
    .orderBy("confirmBy", "asc")
    .limit(50)
    .get();

  await Promise.all(
    confirmSoonSnap.docs.map(async (d) => {
      const b = d.data() as { petId?: unknown; providerName?: unknown; confirmBy?: unknown };
      const petId = typeof b.petId === "string" ? b.petId : null;
      const providerName = typeof b.providerName === "string" ? b.providerName : "prenotazione";
      const confirmBy = typeof b.confirmBy === "number" ? b.confirmBy : null;
      if (!petId || !confirmBy) return;
      const type = `booking_confirm_soon:${d.id}`;
      const dedupeFrom = now - 6 * 60 * 60 * 1000;
      if (await hasRecentNotification(petId, type, dedupeFrom)) return;
      await createPetNotification(petId, {
        type,
        title: "Conferma prenotazione",
        body: `Conferma entro ${new Date(confirmBy).toLocaleString()} per ${providerName}.`,
        severity: "warning",
      });
    })
  );

  const upcomingSnap = await db
    .collectionGroup("bookings")
    .where("status", "==", "confirmed")
    .where("scheduledAt", ">=", now)
    .where("scheduledAt", "<=", in24h)
    .orderBy("scheduledAt", "asc")
    .limit(50)
    .get();

  await Promise.all(
    upcomingSnap.docs.map(async (d) => {
      const b = d.data() as { petId?: unknown; providerName?: unknown; scheduledAt?: unknown };
      const petId = typeof b.petId === "string" ? b.petId : null;
      const providerName = typeof b.providerName === "string" ? b.providerName : "prenotazione";
      const scheduledAt = typeof b.scheduledAt === "number" ? b.scheduledAt : null;
      if (!petId || !scheduledAt) return;
      const type = `booking_upcoming_24h:${d.id}`;
      const dedupeFrom = now - 20 * 60 * 60 * 1000;
      if (await hasRecentNotification(petId, type, dedupeFrom)) return;
      await createPetNotification(petId, {
        type,
        title: "Prenotazione imminente",
        body: `Appuntamento il ${new Date(scheduledAt).toLocaleString()} (${providerName}).`,
        severity: "info",
      });
    })
  );
});

export const createBookingSecure = onCall({ maxInstances: 1 }, async (req) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
    const petId = String(req.data?.petId ?? "");
    const providerId = String(req.data?.providerId ?? "");
    const scheduledAt = Number(req.data?.scheduledAt ?? NaN);
    const confirmByRaw = req.data?.confirmBy;
    const confirmBy = confirmByRaw === null || confirmByRaw === undefined ? null : Number(confirmByRaw);
    const notes = typeof req.data?.notes === "string" ? req.data.notes.trim() : "";
    const manualProviderRaw = req.data?.manualProvider;
    const manualProvider =
      manualProviderRaw && typeof manualProviderRaw === "object"
        ? (manualProviderRaw as { kind?: unknown; name?: unknown; city?: unknown; phone?: unknown; meetingUrl?: unknown })
        : null;

    if (!petId) throw new HttpsError("invalid-argument", "petId is required");
    if (!providerId) throw new HttpsError("invalid-argument", "providerId is required");
    if (!Number.isFinite(scheduledAt) || scheduledAt < Date.now() + 5 * 60 * 1000) {
      throw new HttpsError("invalid-argument", "scheduledAt must be at least 5 minutes in the future");
    }
    if (confirmBy !== null && (!Number.isFinite(confirmBy) || confirmBy > scheduledAt)) {
      throw new HttpsError("invalid-argument", "confirmBy must be <= scheduledAt");
    }

    await assertPetAccess(petId, uid);

    let resolvedProviderId = providerId;
    let providerKind = "vet";
    let providerName = "Professionista";
    const providerSnap = await db.collection("providers").doc(providerId).get();
    if (providerSnap.exists) {
      const provider = providerSnap.data() as { kind?: unknown; name?: unknown };
      providerKind = typeof provider.kind === "string" ? provider.kind : "vet";
      providerName = typeof provider.name === "string" ? provider.name : "Professionista";
    } else {
      const wantsManual = providerId.startsWith("manual_") || Boolean(manualProvider);
      if (!wantsManual) throw new HttpsError("not-found", "Provider not found");
      const name = typeof manualProvider?.name === "string" ? manualProvider.name.trim() : "";
      const kind = typeof manualProvider?.kind === "string" ? manualProvider.kind : "vet";
      if (!name) throw new HttpsError("invalid-argument", "manualProvider.name is required");
      const city = typeof manualProvider?.city === "string" ? manualProvider.city.trim() : "";
      const phone = typeof manualProvider?.phone === "string" ? manualProvider.phone.trim() : "";
      const meetingUrl = typeof manualProvider?.meetingUrl === "string" ? manualProvider.meetingUrl.trim() : "";
      const provRef = await db.collection("providers").add({
        kind,
        name,
        createdBy: uid,
        createdAt: Date.now(),
        ...(city ? { city } : {}),
        ...(phone ? { phone } : {}),
        ...(meetingUrl ? { meetingUrl } : {}),
      });
      resolvedProviderId = provRef.id;
      providerKind = kind;
      providerName = name;
    }

    const base = {
      petId,
      userId: uid,
      providerId: resolvedProviderId,
      providerKind,
      providerName,
      scheduledAt,
      confirmBy: confirmBy ?? null,
      status: "requested",
      cancelReason: null,
      notes: notes || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ref = await db.collection("pets").doc(petId).collection("bookings").add(base);
    return { bookingId: ref.id };
  } catch (e) {
    console.error("createBookingSecure failed", e);
    if (e instanceof HttpsError) throw e;
    const isEmulator = String(process.env.FUNCTIONS_EMULATOR || "") === "true";
    const msg = e instanceof Error ? e.message : "Internal";
    throw new HttpsError("internal", isEmulator ? msg : "Internal");
  }
});

export const setBookingStatusSecure = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const petId = String(req.data?.petId ?? "");
  const bookingId = String(req.data?.bookingId ?? "");
  const nextStatus = String(req.data?.status ?? "");
  const cancelReason = typeof req.data?.cancelReason === "string" ? req.data.cancelReason : null;
  const providerId = typeof req.data?.providerId === "string" ? req.data.providerId : "";

  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!bookingId) throw new HttpsError("invalid-argument", "bookingId is required");
  if (!nextStatus) throw new HttpsError("invalid-argument", "status is required");

  let isProviderActor = false;
  if (providerId) {
    const userSnap = await db.collection("users").doc(uid).get();
    const prefs = (userSnap.data() as { preferences?: { providerConsoleProviderId?: unknown } } | undefined)?.preferences;
    const allowedProviderId = typeof prefs?.providerConsoleProviderId === "string" ? prefs?.providerConsoleProviderId : "";
    isProviderActor = allowedProviderId === providerId;
  }

  if (!isProviderActor) {
    await assertPetAccess(petId, uid);
  }
  const ref = db.collection("pets").doc(petId).collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found");
  const cur = snap.data() as { status?: unknown; providerId?: unknown; providerName?: unknown; scheduledAt?: unknown };
  const curStatus = typeof cur.status === "string" ? cur.status : "requested";

  if (isProviderActor && String(cur.providerId ?? "") !== providerId) {
    throw new HttpsError("permission-denied", "Not allowed");
  }

  const allowed: Record<string, string[]> = {
    requested: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    no_show: [],
  };
  if (!allowed[curStatus]?.includes(nextStatus)) {
    throw new HttpsError("failed-precondition", `Invalid transition ${curStatus} -> ${nextStatus}`);
  }
  if (nextStatus === "cancelled") {
    if (isProviderActor && cancelReason !== "provider_cancel") {
      throw new HttpsError("invalid-argument", "cancelReason must be provider_cancel");
    }
    if (!isProviderActor && cancelReason !== "user_cancel") {
      throw new HttpsError("invalid-argument", "cancelReason must be user_cancel");
    }
  }

  await ref.set(
    {
      status: nextStatus,
      cancelReason: nextStatus === "cancelled" ? cancelReason : null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  const providerName = typeof cur.providerName === "string" ? cur.providerName : "Professionista";
  const scheduledAt = typeof cur.scheduledAt === "number" ? cur.scheduledAt : null;
  await createPetNotification(petId, {
    type: `booking_${nextStatus}`,
    title: "Aggiornamento prenotazione",
    body: scheduledAt ? `${providerName}: ${nextStatus} · ${new Date(scheduledAt).toLocaleString()}` : `${providerName}: ${nextStatus}`,
    severity: nextStatus === "cancelled" ? "warning" : "info",
  });
  return { ok: true };
});

export const deleteBookingSecure = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const petId = String(req.data?.petId ?? "");
  const bookingId = String(req.data?.bookingId ?? "");
  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!bookingId) throw new HttpsError("invalid-argument", "bookingId is required");
  await assertPetAccess(petId, uid);
  await db.collection("pets").doc(petId).collection("bookings").doc(bookingId).delete();
  return { ok: true };
});

export const getProviderBookings = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const providerId = String(req.data?.providerId ?? "");
  if (!providerId) throw new HttpsError("invalid-argument", "providerId is required");

  const userSnap = await db.collection("users").doc(uid).get();
  const prefs = (userSnap.data() as { preferences?: { providerConsoleProviderId?: unknown } } | undefined)?.preferences;
  const allowedProviderId = typeof prefs?.providerConsoleProviderId === "string" ? prefs?.providerConsoleProviderId : "";
  if (allowedProviderId !== providerId) throw new HttpsError("permission-denied", "Not allowed");

  const snap = await db.collectionGroup("bookings").where("providerId", "==", providerId).limit(200).get();
  const items = snap.docs
    .map(
      (d) =>
        ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Record<string, unknown> & {
          id: string;
          scheduledAt?: unknown;
        })
    )
    .sort((a, b) => Number(a.scheduledAt ?? 0) - Number(b.scheduledAt ?? 0));
  return { items };
});


export const smartCareSweep = onSchedule("every 6 hours", async () => {
  const now = Date.now();
  const from24h = now - 24 * 60 * 60 * 1000;
  const from48h = now - 48 * 60 * 60 * 1000;
  const from30d = now - 30 * 24 * 60 * 60 * 1000;
  const dedupeFrom = now - 12 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const petsSnap = await db.collection("pets").orderBy("createdAt", "desc").limit(300).get();
  await Promise.all(
    petsSnap.docs.map(async (petDoc) => {
      const petId = petDoc.id;
      const petData = petDoc.data() as { weightKg?: unknown };
      const weightKg = typeof petData.weightKg === "number" ? petData.weightKg : NaN;
      const logs48h = await fetchRecentLogsSince(petId, from48h, 120);
      const hasFood24h = logs48h.some((l) => l.type === "food" && (l.occurredAt ?? 0) >= from24h);
      const hasWater24h = logs48h.some((l) => l.type === "water" && (l.occurredAt ?? 0) >= from24h);
      const hasActivity48h = logs48h.some((l) => l.type === "activity" && (l.occurredAt ?? 0) >= from48h);

      if (Number.isFinite(weightKg) && weightKg > 0) {
        const waterMl24h = logs48h
          .filter((l) => l.type === "water" && (l.occurredAt ?? 0) >= from24h)
          .map((l) => toMl(l.value?.amount, l.value?.unit))
          .filter((x): x is number => typeof x === "number")
          .reduce((s, v) => s + v, 0);

        const expectedMl = weightKg * 50;
        if (waterMl24h > 0 && waterMl24h < expectedMl * 0.5) {
          const type = "hydration_low";
          if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
            await createPetNotification(petId, {
              type,
              title: "Idratazione: bassa",
              body: `Acqua stimata 24h: ~${Math.round(waterMl24h)} ml (atteso ~${Math.round(expectedMl)} ml). Monitora e valuta il veterinario se persistente.`,
              severity: "warning",
              data: { url: `/app/wellness?petId=${petId}` },
            });
          }
        }
      }

      try {
        const gps = await fetchLatestGpsPoint(petId);
        if (gps && gps.recordedAt >= now - 12 * 60 * 60 * 1000) {
          const t = await fetchCurrentTempC(gps.lat, gps.lng);
          if (typeof t === "number" && t >= 30) {
            const type = "heat";
            if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
              await createPetNotification(petId, {
                type,
                title: "Attenzione al caldo",
                body: `Temperatura attuale ~${Math.round(t)}°C. Evita sforzi, assicurati acqua e zone d’ombra.`,
                severity: "warning",
                data: { url: `/app/gps?petId=${petId}` },
              });
            }
          }
        }
      } catch (e) {
        void e;
      }

      if (!hasWater24h) {
        const type = "hydration";
        if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
          await createPetNotification(petId, {
            type,
            title: "Idratazione: check",
            body: "Nessun log acqua nelle ultime 24h. Cambia l’acqua e monitora.",
            severity: "warning",
            data: { url: `/app/wellness?petId=${petId}` },
          });
        }
      }

      if (!hasActivity48h) {
        const type = "activity";
        if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
          await createPetNotification(petId, {
            type,
            title: "Attività: promemoria",
            body: "Nessun log attività nelle ultime 48h. Aggiungi una breve sessione (gioco/passeggiata).",
            severity: "info",
            data: { url: `/app/wellness?petId=${petId}` },
          });
        }
      }

      if (!hasFood24h) {
        const type = "nutrition";
        if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
          await createPetNotification(petId, {
            type,
            title: "Pasti: promemoria",
            body: "Nessun log cibo nelle ultime 24h. Controlla pasti e appetito.",
            severity: "warning",
            data: { url: `/app/nutrition?petId=${petId}` },
          });
        }
      }

      const from14d = now - 14 * 24 * 60 * 60 * 1000;
      const logs14d = await fetchRecentLogsSince(petId, from14d, 500);
      const prev7Start = now - 14 * 24 * 60 * 60 * 1000;
      const prev7End = now - 7 * 24 * 60 * 60 * 1000;
      const cur7Start = prev7End;

      const countIn = (t: string, a: number, b: number) =>
        logs14d.filter((l) => l.type === t && (l.occurredAt ?? 0) >= a && (l.occurredAt ?? 0) < b).length;

      const prevActivity = countIn("activity", prev7Start, prev7End);
      const curActivity = countIn("activity", cur7Start, now);
      if (prevActivity >= 2 && curActivity <= Math.floor(prevActivity / 2)) {
        const type = "activity_drop_7d";
        if (!(await hasRecentNotification(petId, type, weekAgo))) {
          await createPetNotification(petId, {
            type,
            title: "Attività in calo",
            body: `Attività ultimi 7 giorni: ${curActivity} vs ${prevActivity} (settimana precedente).`,
            severity: "warning",
          });
        }
      }

      const prevWater = countIn("water", prev7Start, prev7End);
      const curWater = countIn("water", cur7Start, now);
      if (prevWater >= 3 && curWater <= Math.floor(prevWater / 2)) {
        const type = "water_drop_7d";
        if (!(await hasRecentNotification(petId, type, weekAgo))) {
          await createPetNotification(petId, {
            type,
            title: "Idratazione in calo",
            body: `Log acqua ultimi 7 giorni: ${curWater} vs ${prevWater}. Monitora ciotola e abitudini.`,
            severity: "warning",
          });
        }
      }

      const prevFood = countIn("food", prev7Start, prev7End);
      const curFood = countIn("food", cur7Start, now);
      if (prevFood >= 3 && curFood <= Math.floor(prevFood / 2)) {
        const type = "food_drop_7d";
        if (!(await hasRecentNotification(petId, type, weekAgo))) {
          await createPetNotification(petId, {
            type,
            title: "Pasti in calo",
            body: `Log cibo ultimi 7 giorni: ${curFood} vs ${prevFood}. Controlla appetito e routine.`,
            severity: "warning",
          });
        }
      }

      const logs30d = await fetchRecentLogsSince(petId, from30d, 220);
      const hasWeight30d = logs30d.some((l) => l.type === "weight");
      if (!hasWeight30d) {
        const type = "weight";
        if (!(await hasRecentNotification(petId, type, weekAgo))) {
          await createPetNotification(petId, {
            type,
            title: "Peso: check",
            body: "Nessun log peso negli ultimi 30 giorni. Aggiungi una pesata rapida.",
            severity: "info",
          });
        }
      }

      const vaxSnap = await petDoc.ref.collection("vaccines").orderBy("nextDueAt", "asc").limit(10).get();
      for (const v of vaxSnap.docs) {
        const data = v.data() as { name?: string; nextDueAt?: number; reminderDaysBefore?: number };
        const nextDueAt = typeof data.nextDueAt === "number" ? data.nextDueAt : null;
        if (!nextDueAt) continue;
        const reminderDaysBefore = typeof data.reminderDaysBefore === "number" ? data.reminderDaysBefore : 14;
        const remindAt = nextDueAt - reminderDaysBefore * 24 * 60 * 60 * 1000;
        if (now < remindAt) continue;

        const type = `vaccine_due:${v.id}`;
        if (await hasRecentNotification(petId, type, weekAgo)) continue;
        await createPetNotification(petId, {
          type,
          title: "Vaccino in scadenza",
          body: `${data.name ?? "Vaccino"} previsto il ${new Date(nextDueAt).toLocaleDateString()}.`,
          severity: "info",
        });
      }
    })
  );

});

export const healthScoreSweep = onSchedule("every 24 hours", async () => {
  const now = Date.now();
  const from30d = now - 30 * 24 * 60 * 60 * 1000;
  const from7d = now - 7 * 24 * 60 * 60 * 1000;
  const today = ymd(new Date());

  const petsSnap = await db.collection("pets").orderBy("createdAt", "desc").limit(300).get();
  await Promise.all(
    petsSnap.docs.map(async (petDoc) => {
      const petId = petDoc.id;

      const logs30d = await fetchRecentLogsSince(petId, from30d, 800);
      const symptomCount30d = logs30d.filter((l) => l.type === "symptom").length;
      const weightLogs30d = logs30d.filter((l) => l.type === "weight").length;
      const activityLogs7d = logs30d.filter((l) => l.type === "activity" && (l.occurredAt ?? 0) >= from7d).length;
      const waterLogs7d = logs30d.filter((l) => l.type === "water" && (l.occurredAt ?? 0) >= from7d).length;

      const dueSnap = await petDoc.ref
        .collection("tasks")
        .where("dueAt", ">=", from7d)
        .where("dueAt", "<=", now)
        .orderBy("dueAt", "asc")
        .limit(800)
        .get();
      const dueTasks7d = dueSnap.docs.filter((d) => String((d.data() as { status?: unknown }).status ?? "") === "due").length;
      const completedTasks7d = dueSnap.docs.filter((d) => String((d.data() as { status?: unknown }).status ?? "") === "done").length;

      const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
      const symptomPenalty = clamp(symptomCount30d * 7, 0, 50);
      const weightBonus = clamp(weightLogs30d * 4, 0, 25);
      const activityBonus = clamp(activityLogs7d * 2, 0, 12);
      const hydrationBonus = clamp(waterLogs7d * 1, 0, 10);
      const adherence = dueTasks7d === 0 ? 0.7 : clamp(completedTasks7d / Math.max(1, dueTasks7d), 0, 1);
      const adherenceScore = Math.round(adherence * 35);
      const base = 55;
      const score = clamp(base + weightBonus + adherenceScore + activityBonus + hydrationBonus - symptomPenalty, 0, 100);
      const status = score >= 75 ? "green" : score >= 45 ? "yellow" : "red";

      await petDoc.ref.collection("healthScores").doc(today).set(
        {
          petId,
          score,
          status,
          computedAt: now,
          inputs: {
            symptomCount30d,
            weightLogs30d,
            completedTasks7d,
            dueTasks7d,
            activityLogs7d,
            waterLogs7d,
          },
        },
        { merge: true }
      );
    })
  );
});

export const expenseSeriesSweep = onSchedule("every day 02:05", async () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = now.getDate();
  const key = `${yyyy}${mm}`;
  const nowMs = Date.now();

  const petsSnap = await db.collection("pets").orderBy("createdAt", "desc").limit(300).get();
  await Promise.all(
    petsSnap.docs.map(async (petDoc) => {
      const petId = petDoc.id;
      const seriesSnap = await db
        .collection("pets")
        .doc(petId)
        .collection("expenseSeries")
        .where("enabled", "==", true)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

      await Promise.all(
        seriesSnap.docs.map(async (sdoc) => {
          const s = sdoc.data() as {
            title?: unknown;
            amount?: unknown;
            currency?: unknown;
            category?: unknown;
            note?: unknown;
            startAt?: unknown;
            endAt?: unknown;
            recurrence?: { dayOfMonth?: unknown };
          };

          const dayOfMonth = typeof s.recurrence?.dayOfMonth === "number" ? Math.round(s.recurrence.dayOfMonth) : NaN;
          if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) return;
          if (dd < dayOfMonth) return;
          const startAt = typeof s.startAt === "number" ? s.startAt : 0;
          const endAt = typeof s.endAt === "number" ? s.endAt : undefined;
          if (startAt && nowMs < startAt) return;
          if (endAt && nowMs > endAt) return;

          const amount = typeof s.amount === "number" ? s.amount : NaN;
          if (!Number.isFinite(amount) || amount <= 0) return;

          const docId = `series_${sdoc.id}_${key}`;
          const expenseRef = db.collection("pets").doc(petId).collection("expenses").doc(docId);
          const exists = await expenseRef.get();
          if (exists.exists) return;

          const title = typeof s.title === "string" ? s.title.trim() : "Ricorrente";
          const note = typeof s.note === "string" && s.note.trim() ? `${title} · ${s.note.trim()}` : title;
          const currency = typeof s.currency === "string" ? s.currency : "EUR";
          const category = typeof s.category === "string" ? s.category : "other";

          await expenseRef.set({
            petId,
            amount,
            currency,
            category,
            occurredAt: nowMs,
            note,
            seriesId: sdoc.id,
            createdAt: nowMs,
            createdBy: "system",
          });
        })
      );
    })
  );
});

export const recordSharesRetentionSweep = onSchedule("every day 03:10", async () => {
  const now = Date.now();
  const snap = await db.collection("recordShares").where("expiresAt", "<", now).limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
});

function agendaKindLabel(kind: string) {
  if (kind === "vet") return "Veterinario";
  if (kind === "grooming") return "Toelettatura";
  if (kind === "training") return "Training";
  if (kind === "cleaning") return "Pulizia";
  return "Promemoria";
}

export const agendaReminderSweep = onSchedule("every 5 minutes", async () => {
  const now = Date.now();
  const lookAheadMs = 14 * 24 * 60 * 60 * 1000;

  const snap = await db
    .collectionGroup("agendaEvents")
    .where("dueAt", ">=", now - 60 * 60 * 1000)
    .where("dueAt", "<=", now + lookAheadMs)
    .limit(400)
    .get();

  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as AgendaEventDoc;
      const petId = typeof data.petId === "string" ? data.petId : null;
      const dueAt = typeof data.dueAt === "number" ? data.dueAt : null;
      const reminderMinutesBefore = typeof data.reminderMinutesBefore === "number" ? data.reminderMinutesBefore : 0;
      const reminderSentAt = typeof data.reminderSentAt === "number" ? data.reminderSentAt : null;
      if (!petId || !dueAt) return;
      if (reminderMinutesBefore <= 0) return;
      if (reminderSentAt) return;

      const remindAt = dueAt - reminderMinutesBefore * 60 * 1000;
      const windowMs = 6 * 60 * 1000;
      if (now < remindAt || now > remindAt + windowMs) return;

      const titleStr = typeof data.title === "string" ? data.title : "Evento";
      const kindStr = typeof data.kind === "string" ? data.kind : "other";

      await createPetNotification(petId, {
        type: `agenda_due:${d.id}`,
        title: `${agendaKindLabel(kindStr)} tra ${reminderMinutesBefore} min`,
        body: `${titleStr} · ${new Date(dueAt).toLocaleString()}`,
        severity: "info",
      });

      await d.ref.set({ reminderSentAt: now }, { merge: true });
    })
  );
});

type AgendaSeriesDoc = {
  petId?: unknown;
  title?: unknown;
  kind?: unknown;
  enabled?: unknown;
  startAt?: unknown;
  timeOfDay?: unknown;
  reminderMinutesBefore?: unknown;
  recurrence?: unknown;
  createdBy?: unknown;
};

function parseTimeOfDay(v: unknown) {
  const s = String(v ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [hh, mm] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function computeAgendaSeriesDueAts(input: {
  startAt: number;
  recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] };
  timeOfDay?: string | null;
  fromMs: number;
  toMs: number;
}) {
  const out: number[] = [];
  const start = Math.max(input.startAt, input.fromMs);
  const t = parseTimeOfDay(input.timeOfDay);
  const cur = new Date(start);
  cur.setSeconds(0, 0);
  if (t) cur.setHours(t.hh, t.mm, 0, 0);
  if (cur.getTime() < start) cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(input.toMs);
  while (cur <= end) {
    if (input.recurrence.type === "daily") {
      out.push(cur.getTime());
      cur.setDate(cur.getDate() + 1);
      continue;
    }
    const wd = cur.getDay();
    if (input.recurrence.weekdays.includes(wd)) out.push(cur.getTime());
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export const agendaSeriesSweep = onSchedule("every 12 hours", async () => {
  const now = Date.now();
  const horizonMs = now + 30 * 24 * 60 * 60 * 1000;

  const seriesSnap = await db.collectionGroup("agendaSeries").where("enabled", "==", true).limit(300).get();
  if (seriesSnap.empty) return;

  await Promise.all(
    seriesSnap.docs.map(async (s) => {
      const data = s.data() as AgendaSeriesDoc;
      const petId = typeof data.petId === "string" ? data.petId : null;
      const title = typeof data.title === "string" ? data.title : null;
      const kind = typeof data.kind === "string" ? data.kind : "other";
      const startAt = typeof data.startAt === "number" ? data.startAt : null;
      const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
      if (!petId || !title || !startAt || !createdBy) return;

      const reminderMinutesBefore = typeof data.reminderMinutesBefore === "number" ? data.reminderMinutesBefore : 0;
      const timeOfDay = typeof data.timeOfDay === "string" ? data.timeOfDay : null;

      const rec = data.recurrence as { type?: unknown; weekdays?: unknown } | undefined;
      const recurrence =
        rec?.type === "weekly" && Array.isArray(rec.weekdays)
          ? { type: "weekly" as const, weekdays: rec.weekdays.map((x) => Number(x)).filter((n) => Number.isFinite(n)) }
          : { type: "daily" as const };

      const dueAts = computeAgendaSeriesDueAts({ startAt, recurrence, timeOfDay, fromMs: now, toMs: horizonMs });
      if (dueAts.length === 0) return;

      const batch = db.batch();
      for (const dueAt of dueAts) {
        const eventId = `${s.id}_${dueAt}`;
        batch.set(
          db.collection("pets").doc(petId).collection("agendaEvents").doc(eventId),
          {
            petId,
            title,
            dueAt,
            kind,
            reminderMinutesBefore,
            seriesId: s.id,
            createdAt: now,
            createdBy,
          },
          { merge: true }
        );
      }
      await batch.commit();
    })
  );
});

export const taskReminderSweep = onSchedule("every 10 minutes", async () => {
  const now = Date.now();
  const windowAheadMs = 60 * 60 * 1000;
  const windowPastMs = 10 * 60 * 1000;

  const snap = await db
    .collectionGroup("tasks")
    .where("status", "==", "due")
    .where("dueAt", ">=", now - windowPastMs)
    .where("dueAt", "<=", now + windowAheadMs)
    .limit(400)
    .get();

  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as TaskDoc;
      const petId = typeof data.petId === "string" ? data.petId : null;
      const dueAt = typeof data.dueAt === "number" ? data.dueAt : null;
      const status = typeof data.status === "string" ? data.status : "";
      const reminderSentAt = typeof data.reminderSentAt === "number" ? data.reminderSentAt : null;
      if (!petId || !dueAt) return;
      if (status !== "due") return;
      if (reminderSentAt) return;

      const diffMin = Math.round((dueAt - now) / (60 * 1000));
      const when = new Date(dueAt).toLocaleString();
      const titleStr = typeof data.title === "string" ? data.title : "Task";

      const severity = diffMin <= 0 ? "warning" : "info";
      const prefix = diffMin <= 0 ? "Task scaduto" : diffMin <= 15 ? "Task imminente" : "Promemoria task";

      await createPetNotification(petId, {
        type: `task_due:${d.id}`,
        title: `${prefix}`,
        body: `${titleStr} · ${when}`,
        severity,
        data: {
          url: `/app/planner?petId=${petId}`,
          doneUrl: `/app/planner?petId=${petId}&completeTaskId=${d.id}`,
        },
      });

      await d.ref.set({ reminderSentAt: now }, { merge: true });
    })
  );
});

export const onGroupMessageCreated = onDocumentCreated("groups/{groupId}/messages/{messageId}", async (event) => {
  const groupId = event.params.groupId as string;
  const msg = event.data?.data() as GroupMessageDoc | undefined;
  if (!msg) return;
  const authorId = typeof msg.authorId === "string" ? msg.authorId : null;
  const text = typeof msg.text === "string" ? msg.text.trim() : "";

  const groupSnap = await db.collection("groups").doc(groupId).get();
  const groupName = groupSnap.exists ? String((groupSnap.data() as { name?: unknown }).name ?? "Community") : "Community";

  const membersSnap = await db.collection("groups").doc(groupId).collection("members").limit(500).get();
  const memberUids = membersSnap.docs
    .map((d) => String((d.data() as GroupMemberDoc).uid ?? d.id))
    .filter((uid) => uid && uid !== authorId);

  if (memberUids.length === 0) return;
  const body = text.length > 120 ? `${text.slice(0, 120)}…` : text;

  await Promise.all(
    memberUids.map((uid) =>
      sendPushToUser(uid, {
        title: `Nuovo messaggio · ${groupName}`,
        body: body || "Apri la chat per leggere.",
        data: { groupId, type: "group_message" },
      })
    )
  );
});

export const onListingDeleted = onDocumentDeleted("listings/{listingId}", async (event) => {
  const data = event.data?.data() as { photoPaths?: unknown } | undefined;
  const paths = Array.isArray(data?.photoPaths) ? data?.photoPaths.map((p) => String(p)) : [];
  await Promise.all(paths.filter(Boolean).map((p) => safeDeleteStoragePath(p)));
});

export const communityPostReportTrigger = onDocumentCreated("posts/{postId}/reports/{reportId}", async (event) => {
  const postId = event.params.postId as string;
  const postRef = db.collection("posts").doc(postId);
  const reportsRef = postRef.collection("reports");
  const count = await recountReports(reportsRef, 50);
  const patch: Record<string, unknown> = { reportCount: count };
  if (count >= 3) patch.status = "hidden";
  await postRef.set(patch, { merge: true });
});

export const communityCommentReportTrigger = onDocumentCreated(
  "posts/{postId}/comments/{commentId}/reports/{reportId}",
  async (event) => {
    const postId = event.params.postId as string;
    const commentId = event.params.commentId as string;
    const commentRef = db.collection("posts").doc(postId).collection("comments").doc(commentId);
    const reportsRef = commentRef.collection("reports");
    const count = await recountReports(reportsRef, 50);
    const patch: Record<string, unknown> = { reportCount: count };
    if (count >= 3) patch.status = "hidden";
    await commentRef.set(patch, { merge: true });
  }
);

export const adoptionReportTrigger = onDocumentCreated("adoptions/{adoptionId}/reports/{reportId}", async (event) => {
  const adoptionId = event.params.adoptionId as string;
  const ref = db.collection("adoptions").doc(adoptionId);
  const reportsRef = ref.collection("reports");
  const count = await recountReports(reportsRef, 50);
  const patch: Record<string, unknown> = { reportCount: count, updatedAt: Date.now() };
  if (count >= 3) patch.status = "hidden";
  await ref.set(patch, { merge: true });
});

export const communityGroupMessageReportTrigger = onDocumentCreated(
  "groups/{groupId}/messages/{messageId}/reports/{reportId}",
  async (event) => {
    const groupId = event.params.groupId as string;
    const messageId = event.params.messageId as string;
    const ref = db.collection("groups").doc(groupId).collection("messages").doc(messageId);
    const reportsRef = ref.collection("reports");
    const count = await recountReports(reportsRef, 50);
    const patch: Record<string, unknown> = { reportCount: count };
    if (count >= 3) patch.status = "hidden";
    await ref.set(patch, { merge: true });
  }
);

export const deletePetCascade = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const petId = String(req.data?.petId ?? "");
  if (!petId) throw new HttpsError("invalid-argument", "petId is required");

  await performDeletePetCascade(uid, petId);

  return { ok: true };
});

async function performDeletePetCascade(requestUid: string, petId: string) {
  const petRef = db.collection("pets").doc(petId);
  const petSnap = await petRef.get();
  if (!petSnap.exists) throw new HttpsError("not-found", "Pet not found");
  const pet = petSnap.data() as { ownerId?: unknown; photoPath?: unknown };
  const ownerId = typeof pet.ownerId === "string" ? pet.ownerId : null;
  if (!ownerId || ownerId !== requestUid) throw new HttpsError("permission-denied", "Not allowed");

  const docsSnap = await petRef.collection("documents").limit(500).get();
  const docPaths = docsSnap.docs
    .map((d) => String((d.data() as { storagePath?: unknown }).storagePath ?? ""))
    .filter(Boolean);

  const photoPath = typeof pet.photoPath === "string" ? pet.photoPath : null;

  const subcols = [
    "logs",
    "healthEvents",
    "documents",
    "expenses",
    "gpsPoints",
    "agendaEvents",
    "tasks",
    "routines",
    "notifications",
    "vaccines",
    "medications",
    "bookings",
  ];

  await Promise.all(subcols.map((name) => deleteCollection(petRef.collection(name), 300)));
  await petRef.delete();

  await Promise.all(docPaths.map((p) => safeDeleteStoragePath(p)));
  if (photoPath) await safeDeleteStoragePath(photoPath);
}

export const deleteAccountCascade = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const petsSnap = await db.collection("pets").where("ownerId", "==", uid).limit(50).get();
  await Promise.all(petsSnap.docs.map((d) => performDeletePetCascade(uid, d.id)));

  const userRef = db.collection("users").doc(uid);
  await Promise.all([deleteCollection(userRef.collection("pushTokens"), 300), deleteCollection(userRef.collection("usage"), 300)]);
  await userRef.delete().catch(() => null);

  const membersSnap = await db.collectionGroup("members").where("uid", "==", uid).limit(500).get();
  if (!membersSnap.empty) {
    const batch = db.batch();
    for (const d of membersSnap.docs) batch.delete(d.ref);
    await batch.commit();
  }

  await adminAuth.deleteUser(uid);
  return { ok: true };
});

export const gpsRetentionSweep = onSchedule("every 24 hours", async () => {
  const now = Date.now();
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;

  const snap = await db
    .collectionGroup("gpsPoints")
    .where("recordedAt", "<", cutoff)
    .orderBy("recordedAt", "asc")
    .limit(500)
    .get();

  if (snap.empty) return;
  const batch = db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
});

export const budgetSweep = onSchedule("every 6 hours", async () => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const toMs = Date.now();

  const petsSnap = await db.collection("pets").where("budgetMonthly", ">", 0).limit(200).get();
  await Promise.all(
    petsSnap.docs.map(async (petDoc) => {
      const petId = petDoc.id;
      const pet = petDoc.data() as { budgetMonthly?: unknown; budgetCurrency?: unknown };
      const budgetMonthly = typeof pet.budgetMonthly === "number" ? pet.budgetMonthly : null;
      if (!budgetMonthly || budgetMonthly <= 0) return;
      const currency = typeof pet.budgetCurrency === "string" ? pet.budgetCurrency : "EUR";

      const expSnap = await db
        .collection("pets")
        .doc(petId)
        .collection("expenses")
        .where("occurredAt", ">=", monthStart)
        .where("occurredAt", "<=", toMs)
        .limit(2000)
        .get();

      let sum = 0;
      for (const d of expSnap.docs) {
        const e = d.data() as { amount?: unknown; currency?: unknown };
        const amount = typeof e.amount === "number" ? e.amount : 0;
        const cur = typeof e.currency === "string" ? e.currency : "EUR";
        if (cur !== currency) continue;
        sum += amount;
      }

      if (sum <= budgetMonthly) return;
      const type = `budget_overrun:${monthKey}`;
      const dedupeFrom = Date.now() - 24 * 60 * 60 * 1000;
      if (await hasRecentNotification(petId, type, dedupeFrom)) return;

      await createPetNotification(petId, {
        type,
        title: "Budget mensile superato",
        body: `Speso ${currency} ${sum.toFixed(2)} su ${currency} ${budgetMonthly.toFixed(2)} (mese ${monthKey}).`,
        severity: "warning",
      });
    })
  );
});

type MsSubjectDoc = {
  type?: unknown;
  species?: unknown;
  displayName?: unknown;
  ownerId?: unknown;
  farmId?: unknown;
  herdId?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type MsDeviceDoc = {
  brand?: unknown;
  model?: unknown;
  adapterType?: unknown;
  externalDeviceId?: unknown;
  category?: unknown;
  connectivityType?: unknown;
  batteryLevel?: unknown;
  signalStrength?: unknown;
  isOnline?: unknown;
  lastSeenAt?: unknown;
  supportedMetrics?: unknown;
  supportedAlerts?: unknown;
  metadata?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type MsBindingDoc = {
  deviceId?: unknown;
  subjectId?: unknown;
  boundAt?: unknown;
  unboundAt?: unknown;
};

type MsRuleDoc = {
  type?: unknown;
  enabled?: unknown;
  scope?: unknown;
  subjectId?: unknown;
  subjectType?: unknown;
  metricType?: unknown;
  operator?: unknown;
  threshold?: unknown;
  windowMinutes?: unknown;
  severity?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  recommendedActions?: unknown;
  createdAt?: unknown;
};

type MsSampleDoc = {
  subjectId?: unknown;
  deviceId?: unknown;
  metricType?: unknown;
  value?: unknown;
  unit?: unknown;
  qualityScore?: unknown;
  sourceTimestamp?: unknown;
  receivedAt?: unknown;
  sourceType?: unknown;
  rawPayload?: unknown;
  normalizedPayload?: unknown;
};

type MsAlertDoc = {
  ruleId?: unknown;
  subjectId?: unknown;
  deviceId?: unknown;
  severity?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  recommendedActions?: unknown;
  triggeredAt?: unknown;
  resolvedAt?: unknown;
  source?: unknown;
  confidenceScore?: unknown;
  linkedMetrics?: unknown;
  status?: unknown;
};

function msUserRef(uid: string) {
  return db.collection("users").doc(uid);
}

function msCol(uid: string, name: string) {
  return msUserRef(uid).collection(name);
}

function msTelemetrySamplesCol(uid: string, subjectId: string) {
  return msUserRef(uid).collection("msTelemetry").doc(subjectId).collection("samples");
}

function msStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

async function msAudit(uid: string, action: string, details: Record<string, unknown>) {
  const now = Date.now();
  try {
    await msCol(uid, "msAuditLogs").add({ id: db.collection("_ids").doc().id, action, details, createdAt: now });
  } catch {
    return;
  }
}

async function msWriteDeadLetter(uid: string, doc: Record<string, unknown>) {
  const now = Date.now();
  await msCol(uid, "msDeadLetters").add({ id: db.collection("_ids").doc().id, createdAt: now, ...doc });
}

async function msWriteSyncLog(uid: string, doc: Record<string, unknown>) {
  const now = Date.now();
  await msCol(uid, "msSyncLogs").add({ id: db.collection("_ids").doc().id, createdAt: now, ...doc });
}

function msGetPath(obj: Record<string, unknown>, path: string): unknown {
  const p = String(path || "").trim();
  if (!p) return undefined;
  const parts = p.split(".").map((x) => x.trim()).filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

type MsIntegrationMappingRow = { path: unknown; metricType: unknown; unit?: unknown; transform?: unknown };

function msReadIntegrationMappings(v: unknown): Array<{ path: string; metricType: string; unit?: string; transform?: string }> {
  if (!v || typeof v !== "object") return [];
  const raw = (v as { mappings?: unknown }).mappings;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ path: string; metricType: string; unit?: string; transform?: string }> = [];
  for (const row of raw as MsIntegrationMappingRow[]) {
    const path = msStr(row.path);
    const metricType = msStr(row.metricType);
    const unit = msStr(row.unit);
    const transform = msStr(row.transform);
    if (!path || !metricType) continue;
    out.push({ path, metricType, unit: unit || undefined, transform: transform || undefined });
    if (out.length >= 200) break;
  }
  return out;
}

async function msResolveTarget(args: {
  uid: string;
  deviceIdInput: string;
  subjectIdInput: string;
  adapterTypeInput: string;
  externalDeviceIdInput: string;
}) {
  const uid = args.uid;

  let deviceId = args.deviceIdInput;
  if (!deviceId && args.externalDeviceIdInput) {
    const q = await msCol(uid, "msDevices").where("externalDeviceId", "==", args.externalDeviceIdInput).limit(2).get();
    const found = q.docs[0]?.id ?? "";
    if (!found) return { ok: false as const, error: "device_not_found" };
    deviceId = found;
  }
  if (!deviceId) return { ok: false as const, error: "missing_device" };

  let subjectId = args.subjectIdInput;
  if (!subjectId) {
    const bindSnap = await msCol(uid, "msBindings").where("deviceId", "==", deviceId).where("unboundAt", "==", null).limit(1).get();
    const b = bindSnap.docs[0]?.data() as MsBindingDoc | undefined;
    subjectId = b ? msStr(b.subjectId) : "";
  }
  if (!subjectId) return { ok: false as const, error: "missing_subject" };

  const deviceSnap = await msCol(uid, "msDevices").doc(deviceId).get();
  if (!deviceSnap.exists) return { ok: false as const, error: "device_not_found" };
  const dev = deviceSnap.data() as MsDeviceDoc;
  if (args.adapterTypeInput && args.adapterTypeInput !== msStr(dev.adapterType)) return { ok: false as const, error: "adapter_mismatch" };
  if (args.externalDeviceIdInput && args.externalDeviceIdInput !== msStr(dev.externalDeviceId)) return { ok: false as const, error: "external_device_mismatch" };
  return { ok: true as const, deviceId, subjectId, dev };
}

function msNum(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function msBool(v: unknown) {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function msClamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function msChance(p: number) {
  return Math.random() < p;
}

function msGaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function msCompare(op: unknown, a: unknown, b: unknown) {
  const o = msStr(op);
  if (o === "==") return a === b;
  const an = msNum(a);
  const bn = msNum(b);
  if (an === null || bn === null) return false;
  if (o === ">") return an > bn;
  if (o === ">=") return an >= bn;
  if (o === "<") return an < bn;
  if (o === "<=") return an <= bn;
  return false;
}

function msNormalizeSamples(args: {
  uid: string;
  subjectId: string;
  deviceId: string;
  receivedAt: number;
  payload: Record<string, unknown>;
  supportedMetrics: string[];
  adapterType: string;
  integrationMappings: Array<{ path: string; metricType: string; unit?: string; transform?: string }>;
  deviceMappings: Array<{ path: string; metricType: string; unit?: string; transform?: string }>;
}) {
  const ts = msNum(args.payload.ts) ?? args.receivedAt;
  const out: Array<{ id: string; doc: Record<string, unknown> }> = [];

  const push = (metricType: string, value: unknown, unit?: string) => {
    if (!args.supportedMetrics.includes(metricType)) return;
    const id = db.collection("_ids").doc().id;
    out.push({
      id,
      doc: {
        id,
        subjectId: args.subjectId,
        deviceId: args.deviceId,
        metricType,
        value,
        unit: unit ?? null,
        qualityScore: 0.92,
        sourceTimestamp: ts,
        receivedAt: args.receivedAt,
        sourceType: "device",
        rawPayload: args.payload,
        normalizedPayload: null,
      },
    });
  };

  const battery = msNum(args.payload.battery);
  const signal = msNum(args.payload.signal);
  const online = msBool(args.payload.online);
  if (battery !== null) push("device_battery_level", battery, "%");
  if (signal !== null) push("device_signal_strength", signal, "%");
  if (online !== null) push("device_online", online);

  const builtinByAdapter: Record<string, Array<{ path: string; metricType: string; unit?: string }>> = {
    TractiveAdapter: [
      { path: "lat", metricType: "location_lat", unit: "deg" },
      { path: "lng", metricType: "location_lng", unit: "deg" },
      { path: "speed", metricType: "speed", unit: "m/s" },
      { path: "activity", metricType: "activity_score" },
      { path: "sleepMin", metricType: "sleep_duration", unit: "min" },
      { path: "geofence", metricType: "geofence_status" },
      { path: "battery", metricType: "device_battery_level", unit: "%" },
      { path: "signal", metricType: "device_signal_strength", unit: "%" },
      { path: "online", metricType: "device_online" },
    ],
    PetPaceAdapter: [
      { path: "hr", metricType: "heart_rate", unit: "bpm" },
      { path: "rr", metricType: "respiratory_rate", unit: "rpm" },
      { path: "tempC", metricType: "body_temperature", unit: "°C" },
      { path: "hrv", metricType: "hrv", unit: "ms" },
      { path: "activity", metricType: "activity_score" },
    ],
    CowManagerAdapter: [
      { path: "ear_temperature", metricType: "ear_temperature", unit: "°C" },
      { path: "rumination_duration", metricType: "rumination_duration", unit: "min" },
      { path: "movement_activity", metricType: "movement_activity" },
      { path: "estrus_probability", metricType: "estrus_probability" },
      { path: "insemination_window_score", metricType: "insemination_window_score" },
    ],
    SmaxtecAdapter: [
      { path: "innerTemp", metricType: "inner_body_temperature", unit: "°C" },
      { path: "rumScore", metricType: "rumination_score" },
      { path: "illness", metricType: "illness_risk_score" },
      { path: "ph", metricType: "ph_value" },
    ],
    SenseHubAdapter: [
      { path: "activity", metricType: "activity_score" },
      { path: "rumMin", metricType: "rumination_duration", unit: "min" },
      { path: "estrusP", metricType: "estrus_probability" },
      { path: "insemination", metricType: "insemination_window_score" },
    ],
  };

  const genericFallback: Array<{ path: string; metricType: string; unit?: string }> = [
    { path: "hr", metricType: "heart_rate", unit: "bpm" },
    { path: "heart_rate", metricType: "heart_rate", unit: "bpm" },
    { path: "rr", metricType: "respiratory_rate", unit: "rpm" },
    { path: "respiratory_rate", metricType: "respiratory_rate", unit: "rpm" },
    { path: "temp", metricType: "body_temperature", unit: "°C" },
    { path: "tempC", metricType: "body_temperature", unit: "°C" },
    { path: "body_temperature", metricType: "body_temperature", unit: "°C" },
    { path: "earTemp", metricType: "ear_temperature", unit: "°C" },
    { path: "innerTemp", metricType: "inner_body_temperature", unit: "°C" },
    { path: "activity", metricType: "activity_score" },
    { path: "sleepMin", metricType: "sleep_duration", unit: "min" },
    { path: "steps", metricType: "step_count", unit: "count" },
    { path: "rumMin", metricType: "rumination_duration", unit: "min" },
    { path: "rumScore", metricType: "rumination_score" },
    { path: "inactiveMin", metricType: "inactivity_duration", unit: "min" },
    { path: "estrusP", metricType: "estrus_probability" },
    { path: "insemination", metricType: "insemination_window_score" },
    { path: "illness", metricType: "illness_risk_score" },
    { path: "ph", metricType: "ph_value" },
    { path: "lat", metricType: "location_lat", unit: "deg" },
    { path: "lng", metricType: "location_lng", unit: "deg" },
    { path: "speed", metricType: "speed", unit: "m/s" },
    { path: "geofence", metricType: "geofence_status" },
  ];

  const merged: Array<{ path: string; metricType: string; unit?: string; transform?: string }> = [];
  const seen = new Set<string>();

  const add = (rows: Array<{ path: string; metricType: string; unit?: string; transform?: string }>) => {
    for (const r of rows) {
      const k = `${r.metricType}:${r.path}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(r);
    }
  };

  add(args.deviceMappings);
  add(args.integrationMappings);
  add((builtinByAdapter[args.adapterType] ?? []) as Array<{ path: string; metricType: string; unit?: string; transform?: string }>);
  add(genericFallback);

  for (const r of merged) {
    if (!args.supportedMetrics.includes(r.metricType)) continue;
    const raw = msGetPath(args.payload, r.path);
    if (raw === undefined || raw === null) continue;

    if (r.metricType === "geofence_status") {
      const s = typeof raw === "string" ? raw : String(raw);
      if (s) push(r.metricType, s);
      continue;
    }
    if (r.metricType === "device_online") {
      const b = msBool(raw);
      if (b !== null) push(r.metricType, b);
      continue;
    }

    const n = msNum(raw);
    if (n === null) continue;

    let unit = r.unit;
    if (!unit && raw && typeof raw === "object") {
      const u = msStr((raw as Record<string, unknown>).unit);
      unit = u || undefined;
    }

    if (r.transform === "fahrenheit_to_celsius" && unit && unit.toLowerCase().includes("f")) {
      const c = ((n - 32) * 5) / 9;
      push(r.metricType, Number(c.toFixed(2)), "°C");
      continue;
    }

    push(r.metricType, n, unit);
  }

  const geofence = args.payload.geofence;
  const geofenceStr = typeof geofence === "string" ? geofence : geofence === null || geofence === undefined ? "" : String(geofence);
  if (geofenceStr) push("geofence_status", geofenceStr);

  return {
    samples: out,
    devicePatch: {
      batteryLevel: battery,
      signalStrength: signal,
      isOnline: online,
      lastSeenAt: args.receivedAt,
      status: online === false ? "offline" : battery !== null && battery <= 15 ? "battery_low" : "connected",
    },
  };
}

async function msIngestResolved(args: {
  uid: string;
  deviceId: string;
  subjectId: string;
  dev: MsDeviceDoc;
  payload: Record<string, unknown>;
  receivedAt: number;
  source: "webhook" | "queue" | "polling" | "csv";
}) {
  function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  const supportedMetrics = Array.isArray(args.dev.supportedMetrics) ? args.dev.supportedMetrics.map((x) => String(x)) : [];
  const adapterType = msStr(args.dev.adapterType);
  const deviceMappings = msReadIntegrationMappings((args.dev as { adapterConfig?: unknown }).adapterConfig);
  const integrationSnap = adapterType ? await msCol(args.uid, "msIntegrations").doc(adapterType).get() : null;
  const integrationMappings = integrationSnap && integrationSnap.exists ? msReadIntegrationMappings(integrationSnap.data()) : [];

  const normalized = msNormalizeSamples({
    uid: args.uid,
    subjectId: args.subjectId,
    deviceId: args.deviceId,
    receivedAt: args.receivedAt,
    payload: args.payload,
    supportedMetrics,
    adapterType,
    integrationMappings,
    deviceMappings,
  });

  const batch = db.batch();

  const subjSnap = await msCol(args.uid, "msSubjects").doc(args.subjectId).get();
  const subj = subjSnap.exists ? (subjSnap.data() as MsSubjectDoc) : null;

  const latDoc = normalized.samples.slice().reverse().find((s) => msStr(s.doc.metricType) === "location_lat");
  const lngDoc = normalized.samples.slice().reverse().find((s) => msStr(s.doc.metricType) === "location_lng");
  const lat = latDoc ? msNum(latDoc.doc.value) : null;
  const lng = lngDoc ? msNum(lngDoc.doc.value) : null;
  if (subj && lat !== null && lng !== null) {
    const farmId = msStr(subj.farmId);
    const herdId = msStr(subj.herdId);
    if (farmId) {
      const fencesSnap = await msCol(args.uid, "msGeofences").where("farmId", "==", farmId).limit(400).get();
      const fences = fencesSnap.docs.map((d) => d.data() as Record<string, unknown>);
      const candidates = fences.filter((f) => {
        const hid = msStr(f.herdId);
        if (hid) return herdId && hid === herdId;
        return true;
      });
      if (candidates.length) {
        const point = { lat, lng };
        let insideAny = false;
        const distances: Array<{ id: string; distanceM: number; radiusM: number }> = [];
        for (const f of candidates) {
          const id = msStr(f.id);
          const center = (f.center ?? null) as unknown;
          const radiusM = msNum(f.radiusM) ?? 0;
          const cLat = center && typeof center === "object" ? msNum((center as Record<string, unknown>).lat) : null;
          const cLng = center && typeof center === "object" ? msNum((center as Record<string, unknown>).lng) : null;
          if (!id || cLat === null || cLng === null || radiusM <= 0) continue;
          const dM = haversineM({ lat: cLat, lng: cLng }, point);
          distances.push({ id, distanceM: Math.round(dM), radiusM: Math.round(radiusM) });
          if (dM <= radiusM) insideAny = true;
        }
        const value = insideAny ? "inside" : "outside";
        const id = db.collection("_ids").doc().id;
        const doc = {
          id,
          subjectId: args.subjectId,
          deviceId: args.deviceId,
          metricType: "geofence_status",
          value,
          unit: null,
          qualityScore: 0.9,
          sourceTimestamp: args.receivedAt,
          receivedAt: Date.now(),
          sourceType: "inferred",
          normalizedPayload: { method: "circle", insideAny, distances },
        };
        batch.set(msTelemetrySamplesCol(args.uid, args.subjectId).doc(id), doc, { merge: true });
      }
    }
  }

  for (const s of normalized.samples) {
    batch.set(msTelemetrySamplesCol(args.uid, args.subjectId).doc(s.id), s.doc, { merge: true });
  }
  batch.set(
    msCol(args.uid, "msDevices").doc(args.deviceId),
    {
      batteryLevel: normalized.devicePatch.batteryLevel ?? null,
      signalStrength: normalized.devicePatch.signalStrength ?? null,
      isOnline: normalized.devicePatch.isOnline ?? null,
      lastSeenAt: normalized.devicePatch.lastSeenAt ?? null,
      status: normalized.devicePatch.status ?? null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
  await batch.commit();

  const [subjectsSnap, devicesSnap, bindingsSnap, rulesSnap] = await Promise.all([
    msCol(args.uid, "msSubjects").limit(300).get(),
    msCol(args.uid, "msDevices").limit(500).get(),
    msCol(args.uid, "msBindings").limit(800).get(),
    msCol(args.uid, "msRules").limit(500).get(),
  ]);
  await msEvaluateAndPersist({
    uid: args.uid,
    now: Date.now(),
    subjects: subjectsSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsSubjectDoc })),
    devices: devicesSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsDeviceDoc })),
    bindings: bindingsSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsBindingDoc })),
    rules: rulesSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsRuleDoc })),
  });

  await msWriteSyncLog(args.uid, {
    kind: args.source,
    ok: true,
    inserted: normalized.samples.length,
    deviceId: args.deviceId,
    subjectId: args.subjectId,
  });
  return { inserted: normalized.samples.length };
}

async function msEvaluateAndPersist(args: {
  uid: string;
  now: number;
  subjects: Array<{ id: string; doc: MsSubjectDoc }>;
  devices: Array<{ id: string; doc: MsDeviceDoc }>;
  bindings: Array<{ id: string; doc: MsBindingDoc }>;
  rules: Array<{ id: string; doc: MsRuleDoc }>;
}) {
  const uid = args.uid;
  const now = args.now;

  const subjectsById = new Map(args.subjects.map((s) => [s.id, s.doc] as const));
  const subjectIdByDeviceId = new Map<string, string>();
  for (const b of args.bindings) {
    const d = b.doc;
    if (typeof d.unboundAt === "number") continue;
    const deviceId = msStr(d.deviceId);
    const subjectId = msStr(d.subjectId);
    if (!deviceId || !subjectId) continue;
    subjectIdByDeviceId.set(deviceId, subjectId);
  }

  const maxWindow = args.rules.reduce((m, r) => {
    const w = msNum(r.doc.windowMinutes);
    return Math.max(m, w ?? (msStr(r.doc.type) === "anomaly" ? 120 : 30));
  }, 30);
  const windowMs = Math.max(10, maxWindow) * 60 * 1000;

  const recentBySubjectMetric = new Map<string, Array<{ id: string; doc: MsSampleDoc }>>();
  for (const s of args.subjects) {
    const snap = await msTelemetrySamplesCol(uid, s.id)
      .where("sourceTimestamp", ">=", now - windowMs)
      .orderBy("sourceTimestamp", "desc")
      .limit(220)
      .get();
    for (const d of snap.docs) {
      const data = d.data() as MsSampleDoc;
      const key = `${s.id}:${msStr(data.metricType)}`;
      const arr = recentBySubjectMetric.get(key) ?? [];
      arr.push({ id: d.id, doc: data });
      recentBySubjectMetric.set(key, arr);
    }
  }

  const existingAlertsSnap = await msCol(uid, "msAlerts").limit(2000).get();
  const openAlertsByKey = new Map<string, { id: string; doc: MsAlertDoc }>();
  for (const d of existingAlertsSnap.docs) {
    const a = d.data() as MsAlertDoc;
    if (msStr(a.status) !== "open") continue;
    const ruleId = msStr(a.ruleId);
    const subjectId = msStr(a.subjectId);
    if (!ruleId || !subjectId) continue;
    openAlertsByKey.set(`${ruleId}:${subjectId}`, { id: d.id, doc: a });
  }

  const batch = db.batch();
  const notificationsToCreate: Array<{ alertId: string; subjectId: string; title: string; body: string }> = [];

  for (const r of args.rules) {
    const ruleId = r.id;
    const rule = r.doc;
    if (rule.enabled !== true) continue;
    const type = msStr(rule.type);
    if (type !== "threshold" && type !== "anomaly" && type !== "trend") continue;

    for (const s of args.subjects) {
      const subjectId = s.id;
      const subject = s.doc;

      const scope = msStr(rule.scope);
      if (scope === "subject") {
        if (msStr(rule.subjectId) !== subjectId) continue;
      } else if (scope === "type") {
        if (msStr(rule.subjectType) !== msStr(subject.type)) continue;
      } else {
        continue;
      }

      const metricType = msStr(rule.metricType);
      if (!metricType) continue;
      const relevant = recentBySubjectMetric.get(`${subjectId}:${metricType}`) ?? [];
      const existing = openAlertsByKey.get(`${ruleId}:${subjectId}`);

      const alertDocId = `${ruleId}_${subjectId}`;
      if (type === "threshold") {
        const triggered = relevant.some((x) => msCompare(rule.operator, x.doc.value, rule.threshold));
        if (triggered && !existing) {
          const first = relevant.find((x) => msCompare(rule.operator, x.doc.value, rule.threshold));
          const deviceId = first ? msStr(first.doc.deviceId) : "";
          const title = msStr(rule.title) || metricType;
          const description = msStr(rule.description) || `${metricType} oltre soglia`;
          const severity = msStr(rule.severity) || "warning";
          const category = msStr(rule.category) || "health";
          const rec = Array.isArray(rule.recommendedActions) ? rule.recommendedActions.map((x) => String(x)).filter(Boolean).slice(0, 8) : [];
          const linked = first ? [{ metricType, sampleId: first.id }] : [];
          batch.set(
            msCol(uid, "msAlerts").doc(alertDocId),
            {
              ruleId,
              subjectId,
              deviceId,
              severity,
              category,
              title,
              description,
              recommendedActions: rec,
              triggeredAt: now,
              resolvedAt: null,
              source: "engine:threshold",
              confidenceScore: 0.72,
              linkedMetrics: linked,
              status: "open",
              updatedAt: now,
            },
            { merge: true }
          );
          notificationsToCreate.push({ alertId: alertDocId, subjectId, title, body: description || title });
        }
        if (!triggered && existing) {
          batch.set(
            msCol(uid, "msAlerts").doc(existing.id),
            { status: "closed", resolvedAt: now, updatedAt: now },
            { merge: true }
          );
          openAlertsByKey.delete(`${ruleId}:${subjectId}`);
        }
      }

      if (type === "trend") {
        const numbers = relevant
          .map((x) => ({ x, v: msNum(x.doc.value) }))
          .filter((y) => y.v !== null) as Array<{ x: { id: string; doc: Record<string, unknown> }; v: number }>;
        const triggered =
          numbers.length >= 2
            ? msCompare(rule.operator, numbers[0].v - numbers[numbers.length - 1].v, rule.threshold)
            : false;

        if (triggered && !existing) {
          const first = numbers[0]?.x;
          const deviceId = first ? msStr(first.doc.deviceId) : "";
          const title = msStr(rule.title) || metricType;
          const description = msStr(rule.description) || `${metricType} trend`;
          const severity = msStr(rule.severity) || "warning";
          const category = msStr(rule.category) || "health";
          const rec = Array.isArray(rule.recommendedActions) ? rule.recommendedActions.map((x) => String(x)).filter(Boolean).slice(0, 8) : [];
          const linked = first ? [{ metricType, sampleId: first.id }] : [];
          batch.set(
            msCol(uid, "msAlerts").doc(alertDocId),
            {
              ruleId,
              subjectId,
              deviceId,
              severity,
              category,
              title,
              description,
              recommendedActions: rec,
              triggeredAt: args.now,
              status: "open",
              source: "engine:trend",
              confidenceScore: 0.7,
              linkedMetrics: linked,
            },
            { merge: true }
          );
          notificationsToCreate.push({ alertId: alertDocId, subjectId, title, body: description });
          openAlertsByKey.set(`${ruleId}:${subjectId}`, { id: alertDocId, doc: { status: "open" } });
        }

        if (!triggered && existing) {
          batch.set(msCol(uid, "msAlerts").doc(existing.id), { status: "closed", resolvedAt: args.now }, { merge: true });
          openAlertsByKey.delete(`${ruleId}:${subjectId}`);
        }
      }

      if (type === "anomaly") {
        const numbers = relevant
          .map((x) => ({ x, v: msNum(x.doc.value) }))
          .filter((y) => y.v !== null) as Array<{ x: { id: string; doc: MsSampleDoc }; v: number }>;

        if (numbers.length < 8) {
          if (existing) {
            batch.set(msCol(uid, "msAlerts").doc(existing.id), { status: "closed", resolvedAt: now, updatedAt: now }, { merge: true });
            openAlertsByKey.delete(`${ruleId}:${subjectId}`);
          }
          continue;
        }

        const vs = numbers.map((n) => n.v);
        const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
        const variance = vs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / Math.max(1, vs.length - 1);
        const std = Math.sqrt(variance) || 1;
        const latest = numbers[0];
        const z = Math.abs((latest.v - mean) / std);
        const triggered = z >= 2.8;

        if (triggered && !existing) {
          const deviceId = msStr(latest.x.doc.deviceId);
          const title = msStr(rule.title) || "Anomalia";
          const description = msStr(rule.description) || `Anomalia su ${metricType} (z=${z.toFixed(2)})`;
          const severity = msStr(rule.severity) || "warning";
          const category = msStr(rule.category) || "health";
          const rec = Array.isArray(rule.recommendedActions) ? rule.recommendedActions.map((x) => String(x)).filter(Boolean).slice(0, 8) : [];
          batch.set(
            msCol(uid, "msAlerts").doc(alertDocId),
            {
              ruleId,
              subjectId,
              deviceId,
              severity,
              category,
              title,
              description,
              recommendedActions: rec,
              triggeredAt: now,
              resolvedAt: null,
              source: "engine:anomaly",
              confidenceScore: Math.min(0.95, 0.6 + z / 10),
              linkedMetrics: [{ metricType, sampleId: latest.x.id }],
              status: "open",
              updatedAt: now,
            },
            { merge: true }
          );
          notificationsToCreate.push({ alertId: alertDocId, subjectId, title, body: description || title });
        }

        if (!triggered && existing) {
          batch.set(msCol(uid, "msAlerts").doc(existing.id), { status: "closed", resolvedAt: now, updatedAt: now }, { merge: true });
          openAlertsByKey.delete(`${ruleId}:${subjectId}`);
        }
      }
    }
  }

  for (const d of args.devices) {
    const deviceId = d.id;
    const device = d.doc;
    const online = msBool(device.isOnline);
    if (online !== false) {
      const existing = openAlertsByKey.get(`offline:${deviceId}:_`);
      void existing;
      continue;
    }
    const sid = subjectIdByDeviceId.get(deviceId);
    if (!sid) continue;
    const subject = subjectsById.get(sid);
    if (!subject) continue;
    const ruleId = `offline:${deviceId}`;
    const alertId = `offline_${deviceId}`;
    const existing = openAlertsByKey.get(`${ruleId}:${sid}`);
    if (existing) continue;
    const title = "Dispositivo offline";
    const description = `${msStr(device.brand)} ${msStr(device.model)} non risponde.`;
    batch.set(
      msCol(uid, "msAlerts").doc(alertId),
      {
        ruleId,
        subjectId: sid,
        deviceId,
        severity: "warning",
        category: "device",
        title,
        description,
        recommendedActions: ["Verifica batteria", "Verifica copertura", "Riprova sincronizzazione"],
        triggeredAt: now,
        resolvedAt: null,
        source: "engine:device",
        confidenceScore: 0.8,
        linkedMetrics: [],
        status: "open",
        updatedAt: now,
      },
      { merge: true }
    );
    notificationsToCreate.push({ alertId, subjectId: sid, title, body: description });
    openAlertsByKey.set(`${ruleId}:${sid}`, { id: alertId, doc: { status: "open" } });
  }

  for (const n of notificationsToCreate) {
    const id = db.collection("_ids").doc().id;
    batch.set(msCol(uid, "msNotifications").doc(id), {
      id,
      alertId: n.alertId,
      subjectId: n.subjectId,
      createdAt: now,
      channel: "in_app",
      title: n.title,
      body: n.body,
      readAt: null,
    });
  }

  await batch.commit();
}

async function msEnsureSeedInternal(uid: string) {
  const subjectsSnap = await msCol(uid, "msSubjects").limit(1).get();
  if (!subjectsSnap.empty) return { seeded: false };

  const now = Date.now();
  const batch = db.batch();

  const farmId = msCol(uid, "msFarms").doc().id;
  batch.set(msCol(uid, "msFarms").doc(farmId), { id: farmId, name: "Cascina San Martino", createdAt: now - 60 * 24 * 60 * 60 * 1000, ownerId: uid });

  const herdA = msCol(uid, "msHerds").doc().id;
  const herdB = msCol(uid, "msHerds").doc().id;
  batch.set(msCol(uid, "msHerds").doc(herdA), { id: herdA, farmId, name: "Mandria A", createdAt: now - 60 * 24 * 60 * 60 * 1000 });
  batch.set(msCol(uid, "msHerds").doc(herdB), { id: herdB, farmId, name: "Mandria B", createdAt: now - 40 * 24 * 60 * 60 * 1000 });

  const dogId = msCol(uid, "msSubjects").doc().id;
  batch.set(msCol(uid, "msSubjects").doc(dogId), {
    id: dogId,
    type: "pet",
    species: "dog",
    displayName: "Luna",
    breed: "Meticcio",
    sex: "female",
    microchipNumber: "IT-DEMO-0001",
    ownerId: uid,
    status: "normal",
    createdAt: now - 20 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  });

  const catId = msCol(uid, "msSubjects").doc().id;
  batch.set(msCol(uid, "msSubjects").doc(catId), {
    id: catId,
    type: "pet",
    species: "cat",
    displayName: "Milo",
    breed: "European",
    sex: "male",
    microchipNumber: "IT-DEMO-0002",
    ownerId: uid,
    status: "normal",
    createdAt: now - 40 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  });

  const cowIds: string[] = [];
  for (let i = 0; i < 50; i++) {
    const id = msCol(uid, "msSubjects").doc().id;
    cowIds.push(id);
    const heat = i % 17 === 0;
    batch.set(msCol(uid, "msSubjects").doc(id), {
      id,
      type: "livestock",
      species: "cow",
      displayName: `Bov${String(i + 1).padStart(3, "0")}`,
      sex: "female",
      reproductiveStatus: heat ? "in_heat" : "cycling",
      earTag: `IT-${String(1000 + i)}`,
      farmTagNumber: String(2000 + i),
      ownerId: uid,
      farmId,
      herdId: i % 2 === 0 ? herdA : herdB,
      status: heat ? "attention" : "normal",
      createdAt: now - (30 + i) * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
  }

  const sheepIds: string[] = [];
  for (let i = 0; i < 12; i++) {
    const id = msCol(uid, "msSubjects").doc().id;
    sheepIds.push(id);
    batch.set(msCol(uid, "msSubjects").doc(id), {
      id,
      type: "livestock",
      species: "sheep",
      displayName: `Ovi${String(i + 1).padStart(3, "0")}`,
      sex: i % 2 === 0 ? "female" : "male",
      earTag: `IT-OV-${String(3000 + i)}`,
      ownerId: uid,
      farmId,
      herdId: herdA,
      status: "normal",
      createdAt: now - (25 + i) * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
  }

  const goatIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = msCol(uid, "msSubjects").doc().id;
    goatIds.push(id);
    batch.set(msCol(uid, "msSubjects").doc(id), {
      id,
      type: "livestock",
      species: "goat",
      displayName: `Cap${String(i + 1).padStart(3, "0")}`,
      sex: i % 2 === 0 ? "female" : "male",
      earTag: `IT-CA-${String(4000 + i)}`,
      ownerId: uid,
      farmId,
      herdId: herdB,
      status: "normal",
      createdAt: now - (22 + i) * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
  }

  const pigIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = msCol(uid, "msSubjects").doc().id;
    pigIds.push(id);
    batch.set(msCol(uid, "msSubjects").doc(id), {
      id,
      type: "livestock",
      species: "pig",
      displayName: `Sui${String(i + 1).padStart(3, "0")}`,
      sex: i % 2 === 0 ? "female" : "male",
      farmTagNumber: `SU-${String(5000 + i)}`,
      ownerId: uid,
      farmId,
      herdId: herdA,
      status: "normal",
      createdAt: now - (18 + i) * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
  }

  const horseIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = msCol(uid, "msSubjects").doc().id;
    horseIds.push(id);
    batch.set(msCol(uid, "msSubjects").doc(id), {
      id,
      type: "livestock",
      species: "horse",
      displayName: `Cav${String(i + 1).padStart(3, "0")}`,
      sex: i % 2 === 0 ? "female" : "male",
      microchipNumber: `IT-HR-${String(6000 + i)}`,
      ownerId: uid,
      farmId,
      herdId: herdB,
      status: "normal",
      createdAt: now - (40 + i) * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
  }

  const makeDevice = (input: {
    adapterType: string;
    brand: string;
    model: string;
    category: string;
    connectivityType: string;
    subjectId: string;
    supportedMetrics: string[];
    supportedAlerts: string[];
  }) => {
    const id = msCol(uid, "msDevices").doc().id;
    batch.set(msCol(uid, "msDevices").doc(id), {
      id,
      brand: input.brand,
      model: input.model,
      adapterType: input.adapterType,
      category: input.category,
      connectivityType: input.connectivityType,
      batteryLevel: 78,
      signalStrength: 62,
      isOnline: true,
      lastSeenAt: now - 30 * 1000,
      supportedMetrics: input.supportedMetrics,
      supportedAlerts: input.supportedAlerts,
      metadata: {},
      status: "connected",
      createdAt: now - 15 * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
    const bId = msCol(uid, "msBindings").doc().id;
    batch.set(msCol(uid, "msBindings").doc(bId), {
      id: bId,
      deviceId: id,
      subjectId: input.subjectId,
      boundAt: now - 10 * 24 * 60 * 60 * 1000,
      unboundAt: null,
    });
    return id;
  };

  makeDevice({
    adapterType: "TractiveAdapter",
    brand: "Tractive",
    model: "GPS Tracker",
    category: "gps_tracker",
    connectivityType: "lte",
    subjectId: dogId,
    supportedMetrics: ["location_lat", "location_lng", "speed", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
  });

  makeDevice({
    adapterType: "GenericBluetoothHealthTagAdapter",
    brand: "Generic",
    model: "BLE Tag",
    category: "biometric_sensor",
    connectivityType: "bluetooth",
    subjectId: catId,
    supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["fever", "tachycardia", "battery_low", "device_offline"],
  });

  for (let i = 0; i < cowIds.length; i++) {
    if (i % 3 === 0) {
      makeDevice({
        adapterType: "CowManagerAdapter",
        brand: "CowManager",
        model: "Ear Tag",
        category: "ear_tag",
        connectivityType: "gateway",
        subjectId: cowIds[i],
        supportedMetrics: ["ear_temperature", "movement_activity", "inactivity_duration", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["estrus_detected", "rumination_drop", "fever", "device_offline", "battery_low"],
      });
    } else {
      makeDevice({
        adapterType: "SmaxtecAdapter",
        brand: "Smaxtec",
        model: "Bolus",
        category: "bolus",
        connectivityType: "gateway",
        subjectId: cowIds[i],
        supportedMetrics: ["inner_body_temperature", "rumination_score", "movement_activity", "illness_risk_score", "ph_value", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["illness_risk", "fever", "device_offline"],
      });
    }
  }

  for (let i = 0; i < horseIds.length; i++) {
    makeDevice({
      adapterType: "GenericGpsCollarAdapter",
      brand: "Generic",
      model: "GPS Collar",
      category: "gps_tracker",
      connectivityType: "lte",
      subjectId: horseIds[i],
      supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
    });
  }

  for (let i = 0; i < sheepIds.length; i++) {
    if (i % 2 === 0) {
      makeDevice({
        adapterType: "ManualFarmSensorAdapter",
        brand: "Manual",
        model: "Farm Intake",
        category: "clip",
        connectivityType: "gateway",
        subjectId: sheepIds[i],
        supportedMetrics: ["body_temperature", "movement_activity", "inactivity_duration", "eating_duration", "drinking_duration", "water_intake", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["manual_flag"],
      });
    } else {
      makeDevice({
        adapterType: "GenericBluetoothHealthTagAdapter",
        brand: "Generic",
        model: "BLE Health Tag",
        category: "biometric_sensor",
        connectivityType: "bluetooth",
        subjectId: sheepIds[i],
        supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["fever", "tachycardia", "battery_low", "device_offline"],
      });
    }
  }

  for (let i = 0; i < goatIds.length; i++) {
    makeDevice({
      adapterType: "GenericGpsCollarAdapter",
      brand: "Generic",
      model: "GPS Tag",
      category: "gps_tracker",
      connectivityType: "lte",
      subjectId: goatIds[i],
      supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
    });
  }

  for (let i = 0; i < pigIds.length; i++) {
    makeDevice({
      adapterType: "ManualFarmSensorAdapter",
      brand: "Manual",
      model: "Farm Health",
      category: "clip",
      connectivityType: "gateway",
      subjectId: pigIds[i],
      supportedMetrics: ["body_temperature", "movement_activity", "inactivity_duration", "water_intake", "ambient_temperature", "ambient_humidity", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["manual_flag"],
    });
  }

  const rules: Array<{ docId: string; doc: Record<string, unknown> }> = [
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "threshold",
        enabled: true,
        scope: "type",
        subjectType: "pet",
        metricType: "respiratory_rate",
        operator: ">=",
        threshold: 40,
        windowMinutes: 10,
        severity: "warning",
        category: "health",
        title: "Respirazione alta",
        description: "La frequenza respiratoria è sopra soglia.",
        recommendedActions: ["Riduci attività", "Controlla temperatura", "Se persiste contatta il veterinario"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "threshold",
        enabled: true,
        scope: "type",
        subjectType: "pet",
        metricType: "geofence_status",
        operator: "==",
        threshold: "breach",
        windowMinutes: 5,
        severity: "critical",
        category: "safety",
        title: "Uscita geofence",
        description: "Possibile fuga: geofence violato.",
        recommendedActions: ["Apri mappa", "Attiva modalità ricerca", "Contatta familiari"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "threshold",
        enabled: true,
        scope: "type",
        subjectType: "livestock",
        metricType: "geofence_status",
        operator: "==",
        threshold: "outside",
        windowMinutes: 5,
        severity: "critical",
        category: "safety",
        title: "Recinto digitale: uscita",
        description: "Animale fuori area consentita (recinto digitale).",
        recommendedActions: ["Verifica posizione", "Controlla recinzioni/gateway", "Ispeziona eventuale fuga"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "threshold",
        enabled: true,
        scope: "type",
        subjectType: "livestock",
        metricType: "inner_body_temperature",
        operator: ">=",
        threshold: 39.6,
        windowMinutes: 30,
        severity: "critical",
        category: "health",
        title: "Febbre sospetta",
        description: "Temperatura interna elevata.",
        recommendedActions: ["Controllo clinico", "Valuta isolamento", "Valuta terapia"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "threshold",
        enabled: true,
        scope: "type",
        subjectType: "livestock",
        metricType: "rumination_duration",
        operator: "<",
        threshold: 240,
        windowMinutes: 60,
        severity: "warning",
        category: "farm",
        title: "Calo ruminazione",
        description: "Ruminazione bassa nell'ultima ora.",
        recommendedActions: ["Verifica alimentazione", "Controlla eventuale stress", "Valuta visita"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "anomaly",
        enabled: true,
        scope: "type",
        subjectType: "livestock",
        metricType: "movement_activity",
        windowMinutes: 120,
        severity: "warning",
        category: "farm",
        title: "Attività anomala",
        description: "Attività diversa dal baseline recente.",
        recommendedActions: ["Verifica comportamento", "Controlla alimentazione/ruminazione"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
    {
      docId: msCol(uid, "msRules").doc().id,
      doc: {
        type: "trend",
        enabled: true,
        scope: "type",
        subjectType: "livestock",
        metricType: "inner_body_temperature",
        operator: ">=",
        threshold: 0.6,
        windowMinutes: 180,
        severity: "warning",
        category: "health",
        title: "Temperatura in aumento",
        description: "Trend di aumento temperatura nelle ultime 3 ore.",
        recommendedActions: ["Controllo clinico", "Valuta contesto caldo/stress", "Monitora ruminazione"],
        createdAt: now - 60 * 60 * 1000,
      },
    },
  ];
  for (const r of rules) {
    batch.set(msCol(uid, "msRules").doc(r.docId), { id: r.docId, ...r.doc }, { merge: true });
  }

  batch.set(msUserRef(uid), { msSeededAt: now, updatedAt: now }, { merge: true });
  await batch.commit();
  return { seeded: true };
}

async function msSimTickInternal(uid: string, intensityRaw: unknown) {
  const intensity = msClamp(msNum(intensityRaw) ?? 0.35, 0.05, 1);
  const now = Date.now();

  const [subjectsSnap, devicesSnap, bindingsSnap, rulesSnap] = await Promise.all([
    msCol(uid, "msSubjects").limit(200).get(),
    msCol(uid, "msDevices").limit(300).get(),
    msCol(uid, "msBindings").limit(600).get(),
    msCol(uid, "msRules").limit(300).get(),
  ]);

  const subjects = subjectsSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsSubjectDoc }));
  const devices = devicesSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsDeviceDoc }));
  const bindings = bindingsSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsBindingDoc }));
  const rules = rulesSnap.docs.map((d) => ({ id: d.id, doc: d.data() as MsRuleDoc }));

  const subjectById = new Map(subjects.map((s) => [s.id, s.doc] as const));
  const subjectIdByDeviceId = new Map<string, string>();
  for (const b of bindings) {
    if (typeof b.doc.unboundAt === "number") continue;
    const deviceId = msStr(b.doc.deviceId);
    const subjectId = msStr(b.doc.subjectId);
    if (!deviceId || !subjectId) continue;
    subjectIdByDeviceId.set(deviceId, subjectId);
  }

  const batch = db.batch();

  for (const d of devices) {
    const deviceId = d.id;
    const dev = d.doc;
    const subjectId = subjectIdByDeviceId.get(deviceId);
    if (!subjectId) continue;
    const subj = subjectById.get(subjectId);
    if (!subj) continue;

    const type = msStr(subj.type);
    const species = msStr(subj.species);
    const basePet = {
      hr: species === "cat" ? 140 : 96,
      rr: species === "cat" ? 28 : 22,
      temp: species === "cat" ? 38.6 : 38.4,
      activity: species === "cat" ? 48 : 55,
    };
    const baseCow = {
      earTemp: 38.2,
      innerTemp: 38.6,
      rumMin: 320,
      rumScore: 62,
      activity: 44,
      inactiveMin: 18,
      estrusP: 0.08,
      insemination: 0.05,
      illness: 0.12,
      ph: 6.5,
    };

    const batteryPrev = msNum(dev.batteryLevel) ?? 70;
    const signalPrev = msNum(dev.signalStrength) ?? 60;
    const onlinePrev = msBool(dev.isOnline);

    const battery = msClamp(batteryPrev - (Math.random() * 0.08) * (intensity * 4), 3, 100);
    const signal = msClamp(signalPrev + msGaussian() * 1.5, 5, 100);
    const online = msChance(0.01 * intensity) ? false : onlinePrev !== null ? onlinePrev : true;

    const spike = msChance(0.02 * intensity);
    const fever = msChance(0.008 * intensity);
    const rumDrop = type !== "pet" && msChance(0.02 * intensity);
    const geofenceBreach = type === "pet" && msChance(0.01 * intensity);
    const estrus = type !== "pet" && msChance(0.015 * intensity);

    const payload: Record<string, unknown> = {
      ts: now,
      battery,
      signal,
      online,
    };

    if (type === "pet") {
      payload.hr = msClamp(basePet.hr + msGaussian() * 6 + (spike ? 28 : 0), 40, 220);
      payload.rr = msClamp(basePet.rr + msGaussian() * 3 + (spike ? 18 : 0), 8, 90);
      payload.temp = msClamp(basePet.temp + msGaussian() * 0.15 + (fever ? 1.0 : 0), 36.5, 41.8);
      payload.activity = msClamp(basePet.activity + msGaussian() * 8 + (spike ? 25 : 0), 0, 100);
      payload.sleepMin = msClamp(60 + Math.random() * 240, 0, 600);

      const centerLat = 45.4642;
      const centerLng = 9.19;
      const drift = 0.0012;
      payload.lat = centerLat + msGaussian() * drift + (geofenceBreach ? 0.008 : 0);
      payload.lng = centerLng + msGaussian() * drift + (geofenceBreach ? 0.008 : 0);
      payload.speed = msClamp(Math.random() * 2.2 + (spike ? 3.2 : 0), 0, 10);
      payload.geofence = geofenceBreach ? "breach" : "ok";
      payload.steps = Math.round(msClamp(Math.random() * 230 + (spike ? 420 : 0), 0, 2000));
    } else {
      payload.earTemp = msClamp(baseCow.earTemp + msGaussian() * 0.18 + (fever ? 0.8 : 0), 36.5, 41.8);
      payload.innerTemp = msClamp(baseCow.innerTemp + msGaussian() * 0.15 + (fever ? 1.0 : 0), 36.5, 42.2);
      payload.rumMin = msClamp(baseCow.rumMin + msGaussian() * 35 + (rumDrop ? -190 : 0), 40, 520);
      payload.rumScore = msClamp(baseCow.rumScore + msGaussian() * 8 + (rumDrop ? -18 : 0), 0, 100);
      payload.activity = msClamp(baseCow.activity + msGaussian() * 9 + (estrus ? 30 : 0), 0, 100);
      payload.inactiveMin = msClamp(baseCow.inactiveMin + msGaussian() * 6 + (rumDrop ? 28 : 0), 0, 240);
      payload.estrusP = msClamp(baseCow.estrusP + (estrus ? 0.75 : 0) + msGaussian() * 0.06, 0, 1);
      payload.insemination = msClamp(baseCow.insemination + (estrus ? 0.65 : 0) + msGaussian() * 0.05, 0, 1);
      payload.illness = msClamp(baseCow.illness + (rumDrop || fever ? 0.5 : 0) + msGaussian() * 0.05, 0, 1);
      payload.ph = msClamp(baseCow.ph + msGaussian() * 0.08, 5.5, 7.4);
    }

    const supportedMetrics = Array.isArray(dev.supportedMetrics) ? dev.supportedMetrics.map((x) => String(x)) : [];
    const adapterType = msStr(dev.adapterType);
    const deviceMappings = msReadIntegrationMappings((dev as { adapterConfig?: unknown }).adapterConfig);
    const integrationSnap = adapterType ? await msCol(uid, "msIntegrations").doc(adapterType).get() : null;
    const integrationMappings = integrationSnap && integrationSnap.exists ? msReadIntegrationMappings(integrationSnap.data()) : [];

    const normalized = msNormalizeSamples({ uid, subjectId, deviceId, receivedAt: now, payload, supportedMetrics, adapterType, integrationMappings, deviceMappings });

    for (const s of normalized.samples) {
      batch.set(msTelemetrySamplesCol(uid, subjectId).doc(s.id), s.doc, { merge: true });
    }

    batch.set(
      msCol(uid, "msDevices").doc(deviceId),
      {
        batteryLevel: normalized.devicePatch.batteryLevel ?? null,
        signalStrength: normalized.devicePatch.signalStrength ?? null,
        isOnline: normalized.devicePatch.isOnline ?? null,
        lastSeenAt: normalized.devicePatch.lastSeenAt ?? null,
        status: normalized.devicePatch.status ?? null,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  await msEvaluateAndPersist({ uid, now, subjects, devices: (await msCol(uid, "msDevices").limit(300).get()).docs.map((d) => ({ id: d.id, doc: d.data() as MsDeviceDoc })), bindings, rules });
  return { ok: true };
}

export const msEnsureSeed = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  return msEnsureSeedInternal(uid);
});

export const msSimTick = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  await msEnsureSeedInternal(uid);
  return msSimTickInternal(uid, req.data?.intensity);
});

export const msUpdateDevice = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const deviceId = msStr(req.data?.deviceId);
  const patch = (req.data?.patch ?? {}) as Record<string, unknown>;
  if (!deviceId) throw new HttpsError("invalid-argument", "deviceId required");

  const externalDeviceId = msStr(patch.externalDeviceId);
  const adapterConfig = typeof patch.adapterConfig === "object" && patch.adapterConfig ? (patch.adapterConfig as Record<string, unknown>) : null;

  const next: Record<string, unknown> = { updatedAt: Date.now() };
  if (externalDeviceId != null) {
    if (externalDeviceId.length > 120) throw new HttpsError("invalid-argument", "externalDeviceId too long");
    next.externalDeviceId = externalDeviceId;
  }
  if (adapterConfig != null) next.adapterConfig = adapterConfig;

  await msCol(uid, "msDevices").doc(deviceId).set(next, { merge: true });
  await msAudit(uid, "device.update", { deviceId, patch: next });
  return { ok: true };
});

export const msUpsertFarm = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const id = msStr(req.data?.id);
  const name = msStr(req.data?.name);
  if (!name) throw new HttpsError("invalid-argument", "name required");
  const now = Date.now();

  if (id) {
    await msCol(uid, "msFarms").doc(id).set({ name, updatedAt: now }, { merge: true });
    await msAudit(uid, "farm.update", { farmId: id, name });
    return { id };
  }
  const ref = msCol(uid, "msFarms").doc();
  await ref.set({ id: ref.id, name, createdAt: now, updatedAt: now }, { merge: true });
  await msAudit(uid, "farm.create", { farmId: ref.id, name });
  return { id: ref.id };
});

export const msUpsertHerd = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const id = msStr(req.data?.id);
  const farmId = msStr(req.data?.farmId);
  const name = msStr(req.data?.name);
  if (!farmId || !name) throw new HttpsError("invalid-argument", "farmId and name required");
  const now = Date.now();

  if (id) {
    await msCol(uid, "msHerds").doc(id).set({ farmId, name, updatedAt: now }, { merge: true });
    await msAudit(uid, "herd.update", { herdId: id, farmId, name });
    return { id };
  }
  const ref = msCol(uid, "msHerds").doc();
  await ref.set({ id: ref.id, farmId, name, createdAt: now, updatedAt: now }, { merge: true });
  await msAudit(uid, "herd.create", { herdId: ref.id, farmId, name });
  return { id: ref.id };
});

export const msSetSubjectHerd = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const subjectId = msStr(req.data?.subjectId);
  const herdId = msStr(req.data?.herdId);
  if (!subjectId) throw new HttpsError("invalid-argument", "subjectId required");
  await msCol(uid, "msSubjects").doc(subjectId).set({ herdId: herdId ?? null, updatedAt: Date.now() }, { merge: true });
  await msAudit(uid, "subject.setHerd", { subjectId, herdId: herdId ?? null });
  return { ok: true };
});

export const msUpsertGeofence = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const id = msStr(req.data?.id);
  const farmId = msStr(req.data?.farmId);
  const herdId = msStr(req.data?.herdId);
  const name = msStr(req.data?.name);
  const shape = msStr(req.data?.shape);
  const center = (req.data?.center ?? null) as unknown;
  const radiusM = msNum(req.data?.radiusM);

  if (!farmId || !name) throw new HttpsError("invalid-argument", "farmId and name required");
  if (shape !== "circle") throw new HttpsError("invalid-argument", "only circle supported");
  if (!center || typeof center !== "object") throw new HttpsError("invalid-argument", "center required");
  const lat = msNum((center as Record<string, unknown>).lat);
  const lng = msNum((center as Record<string, unknown>).lng);
  if (lat === null || lng === null) throw new HttpsError("invalid-argument", "invalid center");
  if (radiusM === null || radiusM <= 10 || radiusM > 200_000) throw new HttpsError("invalid-argument", "invalid radiusM");

  const now = Date.now();
  const ref = id ? msCol(uid, "msGeofences").doc(id) : msCol(uid, "msGeofences").doc();
  await ref.set(
    {
      id: ref.id,
      farmId,
      herdId: herdId || null,
      name,
      shape: "circle",
      center: { lat, lng },
      radiusM,
      createdAt: id ? undefined : now,
      updatedAt: now,
    },
    { merge: true }
  );
  await msAudit(uid, id ? "geofence.update" : "geofence.create", { geofenceId: ref.id, farmId, herdId: herdId || null, name, radiusM });
  return { id: ref.id };
});

export const msDeleteGeofence = onCall({ maxInstances: 1 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const geofenceId = msStr(req.data?.geofenceId);
  if (!geofenceId) throw new HttpsError("invalid-argument", "geofenceId required");
  await msCol(uid, "msGeofences").doc(geofenceId).delete();
  await msAudit(uid, "geofence.delete", { geofenceId });
  return { ok: true };
});

export const msEnqueueIngest = onCall({ maxInstances: 10 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const payload = (req.data?.payload ?? null) as unknown;
  if (!payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "payload required");

  const item = {
    deviceId: msStr(req.data?.deviceId),
    subjectId: msStr(req.data?.subjectId),
    adapterType: msStr(req.data?.adapterType),
    externalDeviceId: msStr(req.data?.externalDeviceId),
    payload: payload as Record<string, unknown>,
    receivedAt: typeof req.data?.receivedAt === "number" ? req.data.receivedAt : Date.now(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
    source: msStr(req.data?.source) || "queue",
  };
  const ref = await msCol(uid, "msIngestQueue").add(item);
  await msAudit(uid, "ingest.enqueue", { queueId: ref.id, adapterType: item.adapterType, externalDeviceId: item.externalDeviceId });
  return { id: ref.id };
});

export const msImportTelemetryBatch = onCall({ maxInstances: 2 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const rows = req.data?.rows;
  if (!Array.isArray(rows)) throw new HttpsError("invalid-argument", "rows required");
  const limited = rows.slice(0, 500) as Array<Record<string, unknown>>;
  const now = Date.now();

  let count = 0;
  for (let i = 0; i < limited.length; i += 400) {
    const slice = limited.slice(i, i + 400);
    const batch = db.batch();
    for (const r of slice) {
      const payload = (r.payload ?? null) as unknown;
      if (!payload || typeof payload !== "object") continue;
      const ref = msCol(uid, "msIngestQueue").doc();
      batch.set(ref, {
        createdAt: now,
        attempts: 0,
        status: "pending",
        source: "csv",
        adapterType: msStr(r.adapterType),
        deviceId: msStr(r.deviceId),
        subjectId: msStr(r.subjectId),
        externalDeviceId: msStr(r.externalDeviceId),
        payload: payload as Record<string, unknown>,
        receivedAt: typeof r.receivedAt === "number" ? r.receivedAt : now,
      });
      count += 1;
    }
    await batch.commit();
  }
  await msAudit(uid, "csv.import", { enqueued: count });
  await msWriteSyncLog(uid, { kind: "csv_import", ok: true, enqueued: count });
  return { enqueued: count };
});

export const msProcessIngestQueue = onSchedule("every 1 minutes", async () => {
  const snap = await db.collectionGroup("msIngestQueue").where("status", "==", "pending").limit(30).get();
  await Promise.all(
    snap.docs.map(async (d) => {
      const uid = d.ref.parent.parent?.id;
      if (!uid) return;

      const data = d.data() as Record<string, unknown>;
      const attempts = typeof data.attempts === "number" ? data.attempts : 0;
      const deviceIdInput = msStr(data.deviceId);
      const subjectIdInput = msStr(data.subjectId);
      const adapterTypeInput = msStr(data.adapterType);
      const externalDeviceIdInput = msStr(data.externalDeviceId);
      const payload = (data.payload ?? {}) as Record<string, unknown>;
      const receivedAt = typeof data.receivedAt === "number" ? data.receivedAt : Date.now();
      const source: "queue" | "polling" | "csv" = msStr(data.source) === "polling" ? "polling" : msStr(data.source) === "csv" ? "csv" : "queue";

      try {
        await d.ref.set({ status: "processing", startedAt: Date.now() }, { merge: true });
        const resolved = await msResolveTarget({ uid, deviceIdInput, subjectIdInput, adapterTypeInput, externalDeviceIdInput });
        if (!resolved.ok) throw new Error(resolved.error);
        const result = await msIngestResolved({ uid, deviceId: resolved.deviceId, subjectId: resolved.subjectId, dev: resolved.dev, payload, receivedAt, source });
        await d.ref.set({ status: "done", doneAt: Date.now(), inserted: result.inserted }, { merge: true });
      } catch (e) {
        const nextAttempts = attempts + 1;
        const msg = e instanceof Error ? e.message : "error";
        if (nextAttempts >= 5) {
          await msWriteDeadLetter(uid, { kind: "ingest_queue", error: msg, queueId: d.id, payload: data });
          await d.ref.set({ status: "dead", doneAt: Date.now(), attempts: nextAttempts, lastError: msg }, { merge: true });
        } else {
          await d.ref.set({ status: "pending", attempts: nextAttempts, lastError: msg, updatedAt: Date.now() }, { merge: true });
        }
        await msWriteSyncLog(uid, { kind: "queue", ok: false, error: msg, queueId: d.id, attempts: nextAttempts });
      }
    })
  );
});

const MS_WEBHOOK_SECRET = defineSecret("MS_WEBHOOK_SECRET");

export const msIngestWebhook = onRequest({ secrets: [MS_WEBHOOK_SECRET] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-MS-Secret");
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const secret = String(req.headers["x-ms-secret"] ?? "");
  if (!secret || secret !== MS_WEBHOOK_SECRET.value()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const uid = msStr(body.uid);
  const deviceIdInput = msStr(body.deviceId);
  const subjectIdInput = msStr(body.subjectId);
  const adapterTypeInput = msStr(body.adapterType);
  const externalDeviceIdInput = msStr(body.externalDeviceId);
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const receivedAt = typeof body.receivedAt === "number" ? body.receivedAt : Date.now();
  if (!uid) {
    res.status(400).json({ error: "missing_uid" });
    return;
  }
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ error: "missing_payload" });
    return;
  }

  try {
    const resolved = await msResolveTarget({ uid, deviceIdInput, subjectIdInput, adapterTypeInput, externalDeviceIdInput });
    if (!resolved.ok) {
      const status = resolved.error === "device_not_found" ? 404 : 400;
      res.status(status).json({ error: resolved.error });
      return;
    }
    const result = await msIngestResolved({
      uid,
      deviceId: resolved.deviceId,
      subjectId: resolved.subjectId,
      dev: resolved.dev,
      payload,
      receivedAt,
      source: "webhook",
    });
    await msAudit(uid, "ingest.webhook", { deviceId: resolved.deviceId, subjectId: resolved.subjectId, inserted: result.inserted });
    res.json({ ok: true, uid, deviceId: resolved.deviceId, subjectId: resolved.subjectId, inserted: result.inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await msWriteDeadLetter(uid, {
      kind: "webhook",
      error: msg,
      adapterType: adapterTypeInput,
      deviceId: deviceIdInput,
      externalDeviceId: externalDeviceIdInput,
      subjectId: subjectIdInput,
      payload,
    });
    await msWriteSyncLog(uid, { kind: "webhook", ok: false, error: msg });
    res.status(500).json({ error: "ingest_failed" });
  }
});

export const msMockPollingSweep = onSchedule("every 5 minutes", async () => {
  if (!MS_ENABLE_SIMULATION) return;
  const now = Date.now();
  const usersSnap = await db.collection("users").where("msSeededAt", ">", 0).limit(50).get();
  await Promise.all(
    usersSnap.docs.map(async (u) => {
      const uid = u.id;
      const integrationsSnap = await msCol(uid, "msIntegrations").doc("mock").get();
      const enabled = integrationsSnap.exists ? (integrationsSnap.data() as { enabled?: unknown }).enabled === true : false;
      if (!enabled) return;
      await msSimTickInternal(uid, 0.3);
      await msCol(uid, "msSyncLogs").add({ id: db.collection("_ids").doc().id, uid, kind: "mock_poll", ok: true, createdAt: now });
    })
  );
});

export const msPollingSweep = onSchedule("every 10 minutes", async () => {
  if (!MS_ENABLE_SIMULATION) return;
  const now = Date.now();
  const usersSnap = await db.collection("users").where("msSeededAt", ">", 0).limit(50).get();
  await Promise.all(
    usersSnap.docs.map(async (u) => {
      const uid = u.id;
      const integrationsSnap = await msCol(uid, "msIntegrations").limit(50).get();
      for (const doc of integrationsSnap.docs) {
        const adapterType = doc.id;
        const data = doc.data() as Record<string, unknown>;
        const pollingEnabled = (data.pollingEnabled ?? false) === true;
        if (!pollingEnabled) continue;
        const ids = Array.isArray(data.pollingExternalDeviceIds) ? data.pollingExternalDeviceIds.map((x) => String(x)).filter(Boolean).slice(0, 10) : [];
        if (ids.length === 0) continue;

        for (const externalDeviceId of ids) {
          const payload: Record<string, unknown> = { ts: now, online: true, battery: 60 + Math.round(Math.random() * 30), signal: 55 + Math.round(Math.random() * 35) };
          if (adapterType === "TractiveAdapter") {
            payload.lat = 45.4642 + (Math.random() - 0.5) * 0.01;
            payload.lng = 9.19 + (Math.random() - 0.5) * 0.01;
            payload.speed = Math.random() * 2.2;
          } else if (adapterType === "PetPaceAdapter") {
            payload.hr = 90 + Math.round(Math.random() * 30);
            payload.rr = 18 + Math.round(Math.random() * 10);
            payload.tempC = 38.2 + Math.random() * 0.6;
          } else if (adapterType === "CowManagerAdapter") {
            payload.ear_temperature = 38.4 + Math.random() * 0.9;
            payload.rumination_duration = 300 + Math.round(Math.random() * 120);
            payload.estrus_probability = Math.random();
          }

          await msCol(uid, "msIngestQueue").add({
            createdAt: now,
            attempts: 0,
            status: "pending",
            source: "polling",
            adapterType,
            externalDeviceId,
            payload,
            receivedAt: now,
          });
        }
        await msWriteSyncLog(uid, { kind: "polling_sweep", ok: true, adapterType, createdAt: now, enqueued: ids.length });
      }
    })
  );
});

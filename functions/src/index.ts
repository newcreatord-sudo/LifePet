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

setGlobalOptions({ region: "us-central1" });

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const adminAuth = getAuth();

async function recountReports(ref: FirebaseFirestore.CollectionReference, max: number) {
  const snap = await ref.orderBy("createdAt", "desc").limit(max).get();
  return snap.size;
}

const SKIP_AI = process.env.SKIP_AI === "1";
const OPENAI_API_KEY = SKIP_AI ? null : defineSecret("OPENAI_API_KEY");

const BILLING_DISABLED = process.env.BILLING_DISABLED !== "0";
const BETA_PRO_UNTIL_MS = Number(process.env.BETA_PRO_UNTIL_MS || "0") || 0;
const APP_URL = process.env.APP_URL || "https://trae67p1lnc4.vercel.app";
const STRIPE_TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || "30") || 30;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "";

const STRIPE_SECRET_KEY = BILLING_DISABLED ? null : defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = BILLING_DISABLED ? null : defineSecret("STRIPE_WEBHOOK_SECRET");

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

async function createPetNotification(petId: string, input: { type: string; title: string; body: string; severity: "info" | "warning" | "danger" }) {
  const ownerId = await getPetOwnerId(petId);
  if (ownerId && !(await shouldCreateNotificationForOwner(ownerId, input.type))) return;

  await db.collection("pets").doc(petId).collection("notifications").add({
    petId,
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
      data: { petId, type: input.type, severity: input.severity },
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
  return snap.docs.map((d) => d.data() as { type?: string; occurredAt?: number; note?: string });
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
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
    success_url: `${APP_URL}/app/settings?checkout=success`,
    cancel_url: `${APP_URL}/app/settings?checkout=cancel`,
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
    return_url: `${APP_URL}/app/settings`,
  });

  return { url: session.url };
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

function getOpenAi(apiKey: string) {
  if (!apiKey) throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
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
  const client = getOpenAi(OPENAI_API_KEY!.value());

  const prompt = [
    "You are LifePet AI.",
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
  const client = getOpenAi(OPENAI_API_KEY!.value());

  const system = [
    "You are LifePet AI.",
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
      const client = getOpenAi(OPENAI_API_KEY!.value());

      const system = [
        "You are LifePet AI.",
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

export const likePost = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const postId = String(req.data?.postId ?? "");
  if (!postId) throw new HttpsError("invalid-argument", "postId is required");
  const ref = db.collection("posts").doc(postId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Post not found");
    const prev = Number((snap.data() as { likeCount?: number }).likeCount ?? 0);
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
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const petId = String(req.data?.petId ?? "");
  const providerId = String(req.data?.providerId ?? "");
  const scheduledAt = Number(req.data?.scheduledAt ?? NaN);
  const confirmByRaw = req.data?.confirmBy;
  const confirmBy = confirmByRaw === null || confirmByRaw === undefined ? null : Number(confirmByRaw);
  const notes = typeof req.data?.notes === "string" ? req.data.notes.trim() : "";

  if (!petId) throw new HttpsError("invalid-argument", "petId is required");
  if (!providerId) throw new HttpsError("invalid-argument", "providerId is required");
  if (!Number.isFinite(scheduledAt) || scheduledAt < Date.now() + 5 * 60 * 1000) {
    throw new HttpsError("invalid-argument", "scheduledAt must be at least 5 minutes in the future");
  }
  if (confirmBy !== null && (!Number.isFinite(confirmBy) || confirmBy > scheduledAt)) {
    throw new HttpsError("invalid-argument", "confirmBy must be <= scheduledAt");
  }

  await assertPetAccess(petId, uid);
  const providerSnap = await db.collection("providers").doc(providerId).get();
  if (!providerSnap.exists) throw new HttpsError("not-found", "Provider not found");
  const provider = providerSnap.data() as { kind?: unknown; name?: unknown };
  const providerKind = typeof provider.kind === "string" ? provider.kind : "vet";
  const providerName = typeof provider.name === "string" ? provider.name : "Professionista";

  const base = {
    petId,
    userId: uid,
    providerId,
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
      const logs48h = await fetchRecentLogsSince(petId, from48h, 120);
      const hasFood24h = logs48h.some((l) => l.type === "food" && (l.occurredAt ?? 0) >= from24h);
      const hasWater24h = logs48h.some((l) => l.type === "water" && (l.occurredAt ?? 0) >= from24h);
      const hasActivity48h = logs48h.some((l) => l.type === "activity" && (l.occurredAt ?? 0) >= from48h);

      if (!hasWater24h) {
        const type = "hydration";
        if (!(await hasRecentNotification(petId, type, dedupeFrom))) {
          await createPetNotification(petId, {
            type,
            title: "Idratazione: check",
            body: "Nessun log acqua nelle ultime 24h. Cambia l’acqua e monitora.",
            severity: "warning",
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

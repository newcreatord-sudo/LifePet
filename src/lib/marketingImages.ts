import home1 from "@/assets/marketing/home-1.png";
import home2 from "@/assets/marketing/home-2.png";
import login1 from "@/assets/marketing/login-1.jpg";
import login2 from "@/assets/marketing/login-2.png";
import onboarding1 from "@/assets/marketing/onboarding-1.png";
import onboarding2 from "@/assets/marketing/onboarding-2.png";
import dashboard1 from "@/assets/marketing/dashboard-1.png";
import dashboard2 from "@/assets/marketing/dashboard-2.png";

import planner1 from "@/assets/marketing/planner-1.png";
import planner2 from "@/assets/marketing/planner-2.png";
import agenda1 from "@/assets/marketing/agenda-1.png";
import agenda2 from "@/assets/marketing/agenda-2.png";
import health1 from "@/assets/marketing/health-1.png";
import health2 from "@/assets/marketing/health-2.png";
import records1 from "@/assets/marketing/records-1.png";
import records2 from "@/assets/marketing/records-2.png";
import documents1 from "@/assets/marketing/documents-1.png";
import documents2 from "@/assets/marketing/documents-2.png";

import gps1 from "@/assets/marketing/gps-1.png";
import gps2 from "@/assets/marketing/gps-2.png";
import nearby1 from "@/assets/marketing/nearby-1.png";
import nearby2 from "@/assets/marketing/nearby-2.png";
import expenses1 from "@/assets/marketing/expenses-1.png";
import expenses2 from "@/assets/marketing/expenses-2.png";

import community1 from "@/assets/marketing/community-1.jpg";
import community2 from "@/assets/marketing/community-2.png";
import marketplace1 from "@/assets/marketing/marketplace-1.png";
import marketplace2 from "@/assets/marketing/marketplace-2.png";
import training1 from "@/assets/marketing/training-1.png";
import training2 from "@/assets/marketing/training-2.png";
import ai1 from "@/assets/marketing/ai-1.png";
import ai2 from "@/assets/marketing/ai-2.png";

import notifications1 from "@/assets/marketing/notifications-1.png";
import notifications2 from "@/assets/marketing/notifications-2.png";
import settings1 from "@/assets/marketing/settings-1.png";
import settings2 from "@/assets/marketing/settings-2.png";

import vaccines1 from "@/assets/marketing/vaccines-1.png";
import vaccines2 from "@/assets/marketing/vaccines-2.png";
import nutrition1 from "@/assets/marketing/nutrition-1.png";
import nutrition2 from "@/assets/marketing/nutrition-2.png";
import medications1 from "@/assets/marketing/medications-1.jpg";
import medications2 from "@/assets/marketing/medications-2.png";

import explore1 from "@/assets/marketing/explore-1.png";
import explore2 from "@/assets/marketing/explore-2.png";
import insights1 from "@/assets/marketing/insights-1.png";
import insights2 from "@/assets/marketing/insights-2.png";
import vision1 from "@/assets/marketing/vision-1.png";
import vision2 from "@/assets/marketing/vision-2.png";
import video1 from "@/assets/marketing/video-1.png";
import video2 from "@/assets/marketing/video-2.png";

import pets1 from "@/assets/marketing/pets-1.png";
import pets2 from "@/assets/marketing/pets-2.png";
import bookings1 from "@/assets/marketing/bookings-1.png";
import bookings2 from "@/assets/marketing/bookings-2.png";
import adoptions1 from "@/assets/marketing/adoptions-1.png";
import adoptions2 from "@/assets/marketing/adoptions-2.png";
import moderation1 from "@/assets/marketing/moderation-1.png";
import moderation2 from "@/assets/marketing/moderation-2.png";
import provider1 from "@/assets/marketing/provider-1.png";
import provider2 from "@/assets/marketing/provider-2.png";

type ImageKey =
  | "home"
  | "login"
  | "onboarding"
  | "dashboard"
  | "planner"
  | "agenda"
  | "health"
  | "records"
  | "documents"
  | "gps"
  | "nearby"
  | "expenses"
  | "community"
  | "marketplace"
  | "training"
  | "ai"
  | "notifications"
  | "settings"
  | "vaccines"
  | "nutrition"
  | "medications"
  | "explore"
  | "insights"
  | "vision"
  | "video"
  | "pets"
  | "bookings"
  | "adoptions"
  | "moderation"
  | "provider";

function getImageSalt() {
  const w = globalThis as unknown as { __lpImageSalt?: string };
  if (w.__lpImageSalt) return w.__lpImageSalt;
  let salt = "0";
  try {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    salt = `${buf[0].toString(16)}${buf[1].toString(16)}`;
  } catch {
    salt = String(Date.now());
  }
  w.__lpImageSalt = salt;
  return salt;
}

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function localFallbackUrl(key: ImageKey, seed: string) {
  const salt = String(hash32(`${key}:${seed}`));
  return `/api/marketing-image?key=${encodeURIComponent(key)}&salt=${encodeURIComponent(salt)}`;
}

export function getLocalFallbackImageFromSeed(seed?: string) {
  const s = String(seed || "").toLowerCase();
  if (/(spese|expense|budget|costi|€|euro)/.test(s)) return localFallbackUrl("expenses", s);
  if (/(cartella|records|timeline|storico)/.test(s)) return localFallbackUrl("records", s);
  if (/(documenti|document|refert|allegat|pdf)/.test(s)) return localFallbackUrl("documents", s);
  if (/(agenda)/.test(s)) return localFallbackUrl("agenda", s);
  if (/(planner|calend|routine|task|promem)/.test(s)) return localFallbackUrl("planner", s);
  if (/(notific|notification|push|campan)/.test(s)) return localFallbackUrl("notifications", s);
  if (/(impostaz|settings|preferenz)/.test(s)) return localFallbackUrl("settings", s);
  if (/(community|comunit|grupp|walks|passeggiate|social)/.test(s)) return localFallbackUrl("community", s);
  if (/(market|shop|adozioni|adoption)/.test(s)) return localFallbackUrl("marketplace", s);
  if (/(training|addestr|comandi)/.test(s)) return localFallbackUrl("training", s);
  if (/(nutriz|nutrition|cibo|dieta)/.test(s)) return localFallbackUrl("nutrition", s);
  if (/(vaccin|vaccine|richiam)/.test(s)) return localFallbackUrl("vaccines", s);
  if (/(terapi|medic|pill|farmac)/.test(s)) return localFallbackUrl("medications", s);
  if (/(vision|foto|camera|immagin)/.test(s)) return localFallbackUrl("vision", s);
  if (/(video)/.test(s)) return localFallbackUrl("video", s);
  if (/(insight|statist|trend|analisi)/.test(s)) return localFallbackUrl("insights", s);
  if (/(esplora|explore|scopri)/.test(s)) return localFallbackUrl("explore", s);
  if (/(vicino|nearby)/.test(s)) return localFallbackUrl("nearby", s);
  if (/(mappa|map|gps|geofence|posizion)/.test(s)) return localFallbackUrl("gps", s);
  if (/(pet|animali|animals)/.test(s)) return localFallbackUrl("pets", s);
  if (/(prenot|booking|appunt)/.test(s)) return localFallbackUrl("bookings", s);
  if (/(moderaz|moderation)/.test(s)) return localFallbackUrl("moderation", s);
  if (/(provider|professionist|veterinar|toelett)/.test(s)) return localFallbackUrl("provider", s);
  if (/(salute|health|sintom|symptom|vet)/.test(s)) return localFallbackUrl("health", s);
  if (/(ai)/.test(s)) return localFallbackUrl("ai", s);
  return localFallbackUrl("dashboard", s);
}

const PHOTO: Record<ImageKey, string[]> = {
  home: [home1, home2],
  login: [login1, login2],
  onboarding: [onboarding1, onboarding2],
  dashboard: [dashboard1, dashboard2],
  planner: [planner1, planner2],
  agenda: [agenda1, agenda2],
  health: [health1, health2],
  records: [records1, records2],
  documents: [documents1, documents2],
  gps: [gps1, gps2],
  nearby: [nearby1, nearby2],
  expenses: [expenses1, expenses2],
  community: [community1, community2],
  marketplace: [marketplace1, marketplace2],
  training: [training1, training2],
  ai: [ai1, ai2],
  notifications: [notifications1, notifications2],
  settings: [settings1, settings2],
  vaccines: [vaccines1, vaccines2],
  nutrition: [nutrition1, nutrition2],
  medications: [medications1, medications2],
  explore: [explore1, explore2],
  insights: [insights1, insights2],
  vision: [vision1, vision2],
  video: [video1, video2],
  pets: [pets1, pets2],
  bookings: [bookings1, bookings2],
  adoptions: [adoptions1, adoptions2],
  moderation: [moderation1, moderation2],
  provider: [provider1, provider2],
};

function imageUrl(key: ImageKey, touch = 0) {
  const salt = getImageSalt();
  const list = PHOTO[key] || PHOTO.home;
  const idx = hash32(`${key}:${salt}:${touch}`) % list.length;
  return list[idx];
}

export type MarketingHeroKey = "home" | "login" | "onboarding" | "dashboard";

export function getMarketingHeroImage(key: MarketingHeroKey, touch = 0) {
  return imageUrl(key, touch);
}

export type FeatureImageKey =
  | "dashboard"
  | "planner"
  | "agenda"
  | "health"
  | "records"
  | "documents"
  | "gps"
  | "expenses"
  | "community"
  | "marketplace"
  | "training"
  | "ai"
  | "settings"
  | "notifications"
  | "nutrition"
  | "vaccines"
  | "medications"
  | "nearby"
  | "explore"
  | "insights"
  | "vision"
  | "video"
  | "pets"
  | "bookings"
  | "adoptions"
  | "moderation"
  | "provider";

export function getFeatureImage(key: FeatureImageKey, touch = 0) {
  return imageUrl(key, touch);
}

export function getPageHeaderImage(seed?: string, touch = 0) {
  const s = String(seed || "").toLowerCase();
  if (/(spese|expense|budget|costi|€|euro)/.test(s)) return imageUrl("expenses", touch);
  if (/(cartella|records|timeline|storico)/.test(s)) return imageUrl("records", touch);
  if (/(documenti|document|refert|allegat|pdf)/.test(s)) return imageUrl("documents", touch);
  if (/(agenda)/.test(s)) return imageUrl("agenda", touch);
  if (/(planner|calend|routine|task|promem)/.test(s)) return imageUrl("planner", touch);
  if (/(notific|notification|push|campan)/.test(s)) return imageUrl("notifications", touch);
  if (/(impostaz|settings|preferenz)/.test(s)) return imageUrl("settings", touch);
  if (/(community|comunit|grupp|walks|passeggiate|social)/.test(s)) return imageUrl("community", touch);
  if (/(market|shop|adozioni|adoption)/.test(s)) return imageUrl("marketplace", touch);
  if (/(training|addestr|comandi)/.test(s)) return imageUrl("training", touch);
  if (/(nutriz|nutrition|cibo|dieta)/.test(s)) return imageUrl("nutrition", touch);
  if (/(vaccin|vaccine|richiam)/.test(s)) return imageUrl("vaccines", touch);
  if (/(terapi|medic|pill|farmac)/.test(s)) return imageUrl("medications", touch);
  if (/(vision|foto|camera|immagin)/.test(s)) return imageUrl("vision", touch);
  if (/(video)/.test(s)) return imageUrl("video", touch);
  if (/(insight|statist|trend|analisi)/.test(s)) return imageUrl("insights", touch);
  if (/(esplora|explore|scopri)/.test(s)) return imageUrl("explore", touch);
  if (/(vicino|nearby)/.test(s)) return imageUrl("nearby", touch);
  if (/(mappa|map|gps|geofence|posizion)/.test(s)) return imageUrl("gps", touch);
  if (/(pet|animali|animals)/.test(s)) return imageUrl("pets", touch);
  if (/(prenot|booking|appunt)/.test(s)) return imageUrl("bookings", touch);
  if (/(moderaz|moderation)/.test(s)) return imageUrl("moderation", touch);
  if (/(provider|professionist|veterinar|toelett)/.test(s)) return imageUrl("provider", touch);
  if (/(salute|health|sintom|symptom|vet)/.test(s)) return imageUrl("health", touch);
  if (/(ai)/.test(s)) return imageUrl("ai", touch);
  return imageUrl("dashboard", touch);
}

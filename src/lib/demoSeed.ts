import type {
  AgendaEvent,
  CommunityPost,
  Expense,
  GpsPoint,
  HealthEvent,
  MarketplaceListing,
  Pet,
  PetLog,
  PetNotification,
  PetTask,
} from "@/types";
import { demoId, demoWrite } from "@/lib/demoDb";

const SEEDED_KEY = "lifepet:demoSeeded";

function petKey(petId: string, sub: string) {
  return `lifepet:demo:pet:${petId}:${sub}`;
}

export function ensureDemoSeed(userId: string) {
  try {
    if (localStorage.getItem(SEEDED_KEY) === "1") return;
  } catch {
    return;
  }

  const now = Date.now();

  const pet1: Pet = {
    id: demoId(),
    ownerId: userId,
    name: "Luna",
    species: "dog",
    breed: "Meticcio",
    dob: "2021-05-12",
    microchipId: "IT-DEMO-0001",
    dietNotes: "Dieta demo: pasti divisi, evita uva/cioccolato.",
    geofence: { enabled: true, centerLat: 45.4642, centerLng: 9.19, radiusM: 250 },
    createdAt: now - 1000 * 60 * 60 * 24 * 14,
  };

  const pet2: Pet = {
    id: demoId(),
    ownerId: userId,
    name: "Milo",
    species: "cat",
    breed: "European",
    dob: "2019-09-03",
    microchipId: "IT-DEMO-0002",
    dietNotes: "Dieta demo: umido mattina/sera + fontanella acqua.",
    geofence: { enabled: false, centerLat: 45.4642, centerLng: 9.19, radiusM: 250 },
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
  };

  demoWrite<Pet[]>("lifepet:demo:pets", [pet1, pet2]);

  const tasks1: PetTask[] = [
    {
      id: demoId(),
      petId: pet1.id,
      title: "Pasto serale",
      dueAt: now + 1000 * 60 * 30,
      status: "due",
      createdAt: now - 1000 * 60 * 60,
      createdBy: userId,
    },
    {
      id: demoId(),
      petId: pet1.id,
      title: "Spazzola il pelo",
      dueAt: now + 1000 * 60 * 60 * 3,
      status: "due",
      createdAt: now - 1000 * 60 * 60 * 3,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "tasks"), tasks1);

  const logs1: PetLog[] = [
    {
      id: demoId(),
      petId: pet1.id,
      type: "food",
      occurredAt: now - 1000 * 60 * 60 * 8,
      note: "Colazione",
      createdAt: now - 1000 * 60 * 60 * 8,
      createdBy: userId,
    },
    {
      id: demoId(),
      petId: pet1.id,
      type: "weight",
      occurredAt: now - 1000 * 60 * 60 * 24 * 3,
      note: "22.4 kg",
      createdAt: now - 1000 * 60 * 60 * 24 * 3,
      createdBy: userId,
    },
    {
      id: demoId(),
      petId: pet1.id,
      type: "symptom",
      occurredAt: now - 1000 * 60 * 60 * 24,
      note: "Leggermente meno attivo",
      createdAt: now - 1000 * 60 * 60 * 24,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "logs"), logs1);

  const health1: HealthEvent[] = [
    {
      id: demoId(),
      petId: pet1.id,
      type: "vaccine",
      occurredAt: now - 1000 * 60 * 60 * 24 * 10,
      title: "Vaccino rabbia",
      note: "Prossimo richiamo tra 12 mesi",
      severity: "low",
      createdAt: now - 1000 * 60 * 60 * 24 * 10,
      createdBy: userId,
    },
    {
      id: demoId(),
      petId: pet1.id,
      type: "symptom",
      occurredAt: now - 1000 * 60 * 60 * 12,
      title: "Tosse",
      note: "Monitorare per 24 ore",
      severity: "medium",
      createdAt: now - 1000 * 60 * 60 * 12,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "healthEvents"), health1);

  const agenda1: AgendaEvent[] = [
    {
      id: demoId(),
      petId: pet1.id,
      title: "Controllo veterinario",
      dueAt: now + 1000 * 60 * 60 * 24 * 7,
      kind: "vet",
      reminderMinutesBefore: 60,
      createdAt: now - 1000 * 60 * 30,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "agendaEvents"), agenda1);

  const gps1: GpsPoint[] = [
    {
      id: demoId(),
      petId: pet1.id,
      lat: 45.4642,
      lng: 9.19,
      accuracyM: 12,
      recordedAt: now - 1000 * 60 * 8,
      createdAt: now - 1000 * 60 * 8,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "gpsPoints"), gps1);

  const expenses1: Expense[] = [
    {
      id: demoId(),
      petId: pet1.id,
      amount: 49.9,
      currency: "EUR",
      category: "food",
      occurredAt: now - 1000 * 60 * 60 * 24 * 2,
      note: "Crocchette 12kg",
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
      createdBy: userId,
    },
  ];
  demoWrite(petKey(pet1.id, "expenses"), expenses1);

  const notifications1: PetNotification[] = [
    {
      id: demoId(),
      petId: pet1.id,
      type: "hydration",
      title: "Controllo acqua",
      body: "L'assunzione di acqua oggi sembra bassa. Riempi la ciotola e monitora.",
      severity: "warning",
      createdAt: now - 1000 * 60 * 25,
      read: false,
    },
  ];
  demoWrite(petKey(pet1.id, "notifications"), notifications1);

  const posts: CommunityPost[] = [
    {
      id: demoId(),
      authorId: userId,
      createdAt: now - 1000 * 60 * 60 * 5,
      text: "Consigli per prurito in primavera?",
      petTag: { species: "dog" },
      likeCount: 2,
    },
  ];
  demoWrite<CommunityPost[]>("lifepet:demo:posts", posts);

  const listings: MarketplaceListing[] = [
    {
      id: demoId(),
      sellerId: userId,
      createdAt: now - 1000 * 60 * 60 * 24,
      title: "Ciotola in ceramica",
      description: "Antiscivolo, facile da pulire.",
      category: "accessories",
      price: 9.99,
      currency: "EUR",
      status: "active",
      contact: "demo@lifepet.app",
    },
  ];
  demoWrite<MarketplaceListing[]>("lifepet:demo:listings", listings);

  try {
    localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    return;
  }
}

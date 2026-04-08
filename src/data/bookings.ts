import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { Booking, BookingStatus, Provider, PetNotification } from "@/types";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";

function bookingsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "bookings");
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:bookings`;
}

export function subscribeUpcomingBookings(petId: string, onData: (items: Booking[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Booking[]>(demoKey(petId), [], (all) => {
      const now = Date.now();
      const items = all
        .filter((b) => b.scheduledAt >= now - 24 * 60 * 60 * 1000)
        .slice()
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .slice(0, 50);
      onData(items);
    });
  }
  const now = Date.now();
  const q = query(
    bookingsCol(petId),
    where("scheduledAt", ">=", now - 24 * 60 * 60 * 1000),
    orderBy("scheduledAt", "asc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const items: Booking[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, "id">) }));
    onData(items);
  });
}

export function subscribeBookingsHistoryRange(
  petId: string,
  fromMs: number,
  toMs: number,
  limitCount: number,
  onData: (items: Booking[]) => void
) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Booking[]>(demoKey(petId), [], (all) => {
      const items = all
        .filter((b) => b.scheduledAt >= fromMs && b.scheduledAt <= toMs)
        .slice()
        .sort((a, b) => b.scheduledAt - a.scheduledAt)
        .slice(0, limitCount);
      onData(items);
    });
  }
  const q = query(
    bookingsCol(petId),
    where("scheduledAt", ">=", fromMs),
    where("scheduledAt", "<=", toMs),
    orderBy("scheduledAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const items: Booking[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, "id">) }));
    onData(items);
  });
}

export async function createBooking(petId: string, userId: string, provider: Provider, scheduledAt: number, confirmBy: number | null, notes?: string) {
  const base: Omit<Booking, "id"> = {
    petId,
    userId,
    providerId: provider.id,
    providerKind: provider.kind,
    providerName: provider.name,
    scheduledAt,
    confirmBy: confirmBy ?? undefined,
    status: "requested",
    notes: notes?.trim() || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (shouldUseDemoData()) {
    const id = demoId();
    const next: Booking = { id, ...(base as Omit<Booking, "id">) };
    demoUpdate<Booking[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    const notifKey = `lifepet:demo:pet:${petId}:notifications`;
    demoUpdate<PetNotification[]>(notifKey, [], (prev) => [
      {
        id: demoId(),
        petId,
        type: "booking_requested",
        title: "Booking requested",
        body: confirmBy ? `Confirm before ${new Date(confirmBy).toLocaleString()}` : `Scheduled at ${new Date(scheduledAt).toLocaleString()}`,
        severity: "info",
        createdAt: Date.now(),
        read: false,
      },
      ...prev,
    ]);
    return id;
  }

  const ref = await addDoc(bookingsCol(petId), base);
  return ref.id;
}

export async function setBookingStatus(petId: string, bookingId: string, status: BookingStatus, cancelReason?: Booking["cancelReason"]) {
  if (shouldUseDemoData()) {
    demoUpdate<Booking[]>(demoKey(petId), [], (prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status, cancelReason, updatedAt: Date.now() } : b))
    );
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "bookings", bookingId), {
    status,
    cancelReason: cancelReason ?? null,
    updatedAt: Date.now(),
  });
}

export async function deleteBooking(petId: string, bookingId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<Booking[]>(demoKey(petId), [], (prev) => prev.filter((b) => b.id !== bookingId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "bookings", bookingId));
}

import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { Booking, BookingStatus } from "@/types";

export async function getProviderBookings(providerId: string) {
  if (shouldUseDemoData()) return [] as Booking[];
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "getProviderBookings");
  const res = await fn({ providerId });
  return (res.data as { items?: Booking[] } | null)?.items ?? [];
}

export async function providerSetBookingStatus(providerId: string, petId: string, bookingId: string, status: BookingStatus) {
  if (shouldUseDemoData()) return;
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "setBookingStatusSecure");
  await fn({ providerId, petId, bookingId, status, cancelReason: status === "cancelled" ? "provider_cancel" : null });
}

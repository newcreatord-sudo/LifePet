import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import type { FinderReportStatus, PetId } from "@/types";

export async function setFinderReportStatus(petId: PetId, reportId: string, status: Exclude<FinderReportStatus, "new">) {
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "setFinderReportStatusSecure");
  await fn({ petId, reportId, status });
}


import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoId } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { AiChatResponse, AiSummaryResponse } from "@/types";

export async function aiGenerateSummary(petId: string, days: number) {
  if (shouldUseDemoData()) {
    const res: AiSummaryResponse = {
      summary:
        `Demo summary for the last ${days} days for pet ${petId}:\n\n` +
        "• Keep meals consistent and track weight weekly.\n" +
        "• If symptoms persist or worsen, contact your vet.\n" +
        "• Add a daily hydration check task.",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiGenerateSummary");
  try {
    const res = await fn({ petId, days });
    return res.data as AiSummaryResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    throw new Error(msg);
  }
}

export async function aiChat(petId: string, conversationId: string | null, message: string) {
  if (shouldUseDemoData()) {
    const res: AiChatResponse & { conversationId: string } = {
      conversationId: conversationId ?? demoId(),
      answer:
        "Demo AI response (not veterinary advice):\n\n" +
        "1) Log the symptom with severity and time.\n" +
        "2) Check water + activity for 24h.\n" +
        "3) If appetite drops, vomiting/diarrhea appears, or breathing changes: contact a vet.",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiChat");
  try {
    const res = await fn({ petId, conversationId, message });
    return res.data as AiChatResponse & { conversationId: string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    throw new Error(msg);
  }
}

export async function aiVisionAnalyze(petId: string, imageDataUrl: string, prompt: string) {
  if (shouldUseDemoData()) {
    const res: AiChatResponse & { conversationId: string } = {
      conversationId: demoId(),
      answer: "Demo AI vision response (not veterinary advice).",
      citations: [],
    };
    return res;
  }
  const fn = httpsCallable(getFirebase().functions, "aiVisionAnalyze");
  try {
    const res = await fn({ petId, imageDataUrl, prompt });
    return res.data as AiChatResponse & { conversationId?: string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    throw new Error(msg);
  }
}

export function aiUserMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("daily ai limit reached")) {
    return "Limite AI giornaliero raggiunto. Vai in Settings → Plan.";
  }
  if (lower.includes("unauthenticated") || lower.includes("sign in required")) {
    return "Devi essere loggato per usare l’AI.";
  }
  if (lower.includes("openai_api_key") || lower.includes("ai is not configured")) {
    return "AI non configurata sul backend. Verifica Cloud Functions e secret OPENAI_API_KEY.";
  }

  return "Richiesta AI fallita. Riprova tra poco.";
}


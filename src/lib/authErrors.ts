export function authUserMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("auth/configuration-not-found") || lower.includes("configuration_not_found")) {
    return "Firebase Authentication non è attiva sul progetto. Vai in Firebase Console → Authentication → Get started, poi abilita Email/Password.";
  }
  if (lower.includes("auth/operation-not-allowed")) {
    return "Metodo di accesso non abilitato. Vai in Firebase Console → Authentication → Sign-in method e abilita Email/Password.";
  }
  if (lower.includes("auth/invalid-api-key") || lower.includes("api key not valid")) {
    return "API key Firebase non valida o con restrizioni errate. Verifica la config della Web App su Firebase.";
  }
  if (lower.includes("auth/user-not-found") || lower.includes("auth/wrong-password")) {
    return "Email o password non corretti.";
  }
  if (lower.includes("auth/email-already-in-use")) {
    return "Email già registrata. Prova ad accedere.";
  }
  if (lower.includes("auth/weak-password")) {
    return "Password troppo debole. Usa almeno 6 caratteri.";
  }

  return msg || "Autenticazione fallita.";
}


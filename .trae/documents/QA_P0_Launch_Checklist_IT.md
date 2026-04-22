# QA P0 Launch Checklist — PetLyon (IT)

Obiettivo: checklist eseguibile per validare **golden path** + **emergency path** prima del go‑live.

## Gate automatici (dev/CI)
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:e2e:emulators` (Playwright + Firebase emulators)

## Gate manuali (smoke)
- Nessun errore/warn in console
- Mobile: modali scrollabili, tap target OK, back/indietro sempre disponibile
- PWA: nessun loop di reload, aggiornamento non distrugge sessione

---

# 1) Golden path (attivazione)

## 1.1 Signup → Onboarding
- **Passi**: apri app → signup → arrivi a `/onboarding`.
- **Expected**: nessun redirect loop; copy chiaro; “Salta” funziona.
- **Fail**: torna a login, perde stato onboarding.

## 1.2 Onboarding goal picker
- **Passi**: seleziona goal (o continua senza selezionare).
- **Expected**: goal persistito; stepper successivo visibile.
- **Fail**: goal non salvato; CTA non coerenti.

## 1.3 Crea 1 pet
- **Passi**: CTA “Crea pet” → completa nome/specie; foto opzionale.
- **Expected**: pet creato senza freeze; torna a stepper con step 1 segnato.
- **Fail**: blocco su foto; timeout senza messaggio.

## 1.4 Protezione (percezione sicurezza)
- **Passi**: CTA “Apri protezione” → visualizza QR/link.
- **Expected**: step protezione segnato; pagina chiara; nessun dato sensibile pubblico.
- **Fail**: pagina vuota; errori su link/QR.

## 1.5 Documento o vaccino
- **Passi**: carica 1 documento (modal) o aggiungi 1 vaccino.
- **Expected**: stato upload chiaro; retry disponibile se fallisce; onboarding step segnato.
- **Fail**: upload fallito senza recovery; preview rotta.

## 1.6 Crea 1 promemoria
- **Passi**: crea task o evento agenda.
- **Expected**: reminder creato; step segnato.
- **Fail**: promemoria non persistito; UI senza feedback.

## 1.7 Completa onboarding
- **Passi**: premi “Completa onboarding”.
- **Expected**: `onboardingCompleted=1`, redirect a dashboard.
- **Fail**: ritorna a onboarding al refresh.

---

# 2) Emergency path (smarrimento/ritrovamento)

## 2.1 Attiva protezione (se non attiva)
- **Passi**: Protezione → attiva → ottieni QR/link.
- **Expected**: messaggio success; pagina pubblica raggiungibile.

## 2.2 Apri pagina pubblica
- **Passi**: apri `/p/{publicId}`.
- **Expected**: mostra info essenziali; CTA contatto/segnalazione.
- **Fail**: mostra PII inattesa; pagina 404.

## 2.3 Invia segnalazione finder
- **Passi**: invia form segnalazione.
- **Expected**: conferma invio; owner riceve notifica in app.
- **Fail**: spam facile; nessuna conferma.

## 2.4 Owner vede in Notifiche
- **Passi**: apri `/app/notifications`.
- **Expected**: segnalazione in “Urgenti” con contesto pet.
- **Fail**: segnalazione persa o misclassificata.

---

# 3) Regression set (coerenza premium)

## 3.1 Navigazione IA (Core vs Secondaria vs Farm)
- **Expected**: Core minimale e chiaro; Secondaria collassabile; Farm separata.

## 3.2 Microcopy e stati
- **Expected**: empty/loading/error coerenti tra Dashboard/Documenti/Protezione.

## 3.3 Offline
- **Expected**: banner offline non blocca; retry e messaggi chiari.

## 3.4 Privacy
- **Expected**: default “nulla pubblico”; spiegazioni accessibili.

---

# 4) Mapping test E2E (emulators)

## Suite consigliata
- `e2e/firebase-emulators.e2e.ts`: golden path end‑to‑end (signup → pet → doc → reminder → share)
- `e2e/pet-protection-finder.e2e.ts`: emergency path (public page → finder report → notifications)

## Pass/Fail criteri
- 0 flaky: ogni test deve passare 3 run consecutivi.
- Se un test fallisce, si blocca il deploy.


# Backlog P0 Launch — PetLyon (IT)

Obiettivo: consegnare un **Core MVP di lancio** “granito” (stabile, coerente, misurabile) con gate di qualità automatizzati.

## Definizioni
- **P0**: blocca il lancio se non è completo e testato.
- **Gate**: `check` + `lint` + `build` + E2E su emulatori Firebase (golden path + emergency path).

## Funnel target (P0)
1) Signup/Login → Onboarding
2) Crea 1 pet
3) Attiva percezione sicurezza: apri Protezione + (opzionale) abilita/QR
4) Carica 1 documento o aggiungi 1 vaccino
5) Crea 1 promemoria
6) Emergency path: pagina pubblica → segnalazione finder → notifica owner

---

# EPIC P0-A — Account, sessione, onboarding

## P0-A1 — Auth e redirect affidabili
- **Scopo**: accesso e ritorno al punto d’origine (`from`) senza loop.
- **Problema**: drop-off da redirect errati e sessione non pronta.
- **UX**: login/signup con messaggi chiari; ritorno al percorso desiderato; demo accessibile.
- **Modello dati**: nessuno nuovo.
- **API/back-end**: Firebase Auth.
- **Analytics**:
  - `auth_signup`
  - `auth_login_success`
  - `auth_login_error`
- **Rischi**: loop onboarding, user state non sincronizzato.
- **Acceptance**:
  - Signup porta sempre a `/onboarding`.
  - Login porta sempre a `from` (o `/app/dashboard`).

## P0-A2 — Onboarding goal-based (4 step) + persistenza
- **Scopo**: portare l’utente a valore reale (pet + protezione + doc/vaccino + promemoria).
- **Problema**: onboarding incompleto → bassa attivazione e bassa retention.
- **UX**:
  - Welcome “valore in <30s”
  - Goal picker: `protection | documents | routine`
  - Stepper 4 step con CTA contestuali
  - Skip consentito per step non critici
- **Modello dati**:
  - `lifepet:onboardingSteps:v2` (local)
  - `lifepet:onboardingMeta:v2` (local: `startedAt`, `goal`, timestamp step)
- **API/back-end**: none.
- **Analytics**:
  - `onboarding_started`
  - `onboarding_goal_selected`
  - `onboarding_step_cta`
  - `onboarding_skipped`
  - `onboarding_completed`
- **Rischi**: percezione “protezione fatta” solo perché vista.
- **Acceptance**:
  - Refresh non resetta lo step.
  - Completamento possibile e persistente.

---

# EPIC P0-B — Pet profile e multi-pet

## P0-B1 — Crea pet (foto opzionale) senza blocchi
- **Scopo**: identità pet immediata.
- **Problema**: se pet creation si blocca, l’utente abbandona.
- **UX**: nome/specie obbligatori, foto opzionale; errori inline; success chiaro.
- **Modello dati**: `pets/{petId}` (ownerId, name, species, photoUrl?).
- **API/back-end**: Firestore + Storage.
- **Analytics**: `pet_created`.
- **Rischi**: upload foto lento, permessi storage.
- **Acceptance**:
  - Pet creato anche senza foto.
  - Nessun freeze su mobile.

## P0-B2 — Contesto pet sempre evidente
- **Scopo**: evitare azioni sul pet sbagliato.
- **UX**: pet switcher + nome pet attivo visibile.
- **Dati**: `activePetId` client.
- **Analytics**: `pet_switch`.
- **Acceptance**:
  - Cambiare pet aggiorna contenuti nelle pagine core.

---

# EPIC P0-C — Documenti

## P0-C1 — Upload resiliente + preview + retry
- **Scopo**: archivio affidabile e consultabile.
- **UX**: modal upload, progress, stati `uploading/ready/failed`, retry per singolo/tutti.
- **Modello dati**: `pets/{petId}/documents/{docId}` con `uploadStatus`, `storagePath`, `sha256`, `ownerId`.
- **API/back-end**: Storage resumable + Firestore; rules strette.
- **Analytics**:
  - `doc_upload_started`
  - `doc_upload_success`
  - `doc_upload_failed`
  - `doc_preview_open`
- **Rischi**: rete instabile, duplicati.
- **Acceptance**:
  - Un fallimento non perde metadati.
  - Retry riprende con lo stesso record.

## P0-C2 — Empty state guidato documenti
- **Scopo**: portare a “1 documento” senza confusione.
- **UX**: suggerimenti precompilati (Microchip/Vaccini/Referto) + CTA primaria unica.
- **Analytics**: `documents_empty_cta_click`.
- **Acceptance**:
  - 1 CTA primaria; prefill coerente.

---

# EPIC P0-D — Cartella clinica e share

## P0-D1 — Timeline cartella clinica (base)
- **Scopo**: storia del pet consultabile.
- **UX**: timeline + filtri + link ai documenti.
- **Modello dati**: `healthEvents`, `logs`, riferimenti doc.
- **Analytics**: `records_open`, `records_filter_used`.
- **Rischi**: performance.
- **Acceptance**:
  - load rapido, empty state chiaro.

## P0-D2 — Link temporaneo read-only (condivisione)
- **Scopo**: condividere con vet/famiglia senza accesso account.
- **UX**: genera link con scadenza + copia.
- **Modello dati**: `recordsShares/{shareId}` (`petId`, `expiresAt`, `scope`).
- **API/back-end**: callable per generare share + endpoint pubblico read-only.
- **Analytics**: `records_share_created`, `records_share_opened`.
- **Rischi**: privacy leak, brute force.
- **Acceptance**:
  - scadenza enforced server-side; rate limit.

---

# EPIC P0-E — Vaccini, routine e promemoria

## P0-E1 — Vaccini (CRUD + scadenza)
- **Scopo**: gestione richiami.
- **UX**: lista semplice + CTA “Aggiungi vaccino”.
- **Dati**: `pets/{petId}/vaccines/{id}` (`dueAt`, `doneAt`).
- **Analytics**: `vaccine_added`, `vaccine_marked_done`.
- **Rischi**: date errate.
- **Acceptance**:
  - titolo + data obbligatori; validazioni base.

## P0-E2 — Promemoria (task/agenda)
- **Scopo**: retention minima.
- **UX**: template, default sensati, opt-in notifiche.
- **Dati**: `tasks` / `agenda`.
- **Analytics**: `reminder_created`.
- **Rischi**: notifiche invadenti.
- **Acceptance**:
  - opt-in chiaro; disattivabile; quiet hours.

---

# EPIC P0-F — Smarrimento e ritrovamento

## P0-F1 — Protezione (QR/pagina pubblica) + Lost mode
- **Scopo**: emergenza pronta.
- **UX**: pagina Protezione dedicata, QR/link, nota pubblica, toggle smarrito.
- **Dati**: `petCards/{publicId}` (`isLost`, `publicNote`) + `pets.petProtection`.
- **Analytics**: `pet_protection_enabled`, `lost_mode_enabled`.
- **Rischi**: privacy, spam.
- **Acceptance**:
  - pubblico minimal; safe defaults.

## P0-F2 — Finder report → Notifiche owner
- **Scopo**: chi trova invia segnalazione; owner la vede e agisce.
- **UX**: form pubblico semplice + conferma; inbox “Urgenti”.
- **Dati**: `finderReports/{id}`.
- **Analytics**: `finder_report_sent`, `finder_report_viewed`.
- **Rischi**: abuso.
- **Acceptance**:
  - validazioni; anti‑spam; owner vede la segnalazione.

---

# EPIC P0-G — Privacy/Security + resilienza base + export

## P0-G1 — Privacy controls e chiarezza pubblico/privato
- **Scopo**: fiducia.
- **UX**: sezione privacy + “cosa è pubblico” con linguaggio semplice.
- **Analytics**: `privacy_open`.
- **Rischi**: ambiguità.
- **Acceptance**:
  - default “nulla pubblico”; copy coerente.

## P0-G2 — Offline messaging + retry
- **Scopo**: evitare “si è rotto tutto” senza rete.
- **UX**: banner offline non invasivo + retry.
- **Analytics**: `offline_detected`.
- **Acceptance**:
  - banner solo quando serve; nessuna perdita di stato.

## P0-G3 — Export base
- **Scopo**: compliance e fiducia.
- **UX**: export da Settings con feedback.
- **API/back-end**: callable + signed URL.
- **Analytics**: `export_requested`, `export_downloaded`.
- **Rischi**: sicurezza link.
- **Acceptance**:
  - URL con scadenza; rate limit.


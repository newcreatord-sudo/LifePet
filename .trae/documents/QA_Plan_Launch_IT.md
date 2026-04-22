# QA Plan Launch — PetLyon (IT)

Piano QA completo per un lancio solido.

---

## 1) Test strategy
- Piramide: Unit → Integration (emulators) → E2E (Playwright)
- Gate: `check`, `lint`, `test:run`, `test:e2e:emulators`
- Anti-flaky: zero dipendenze esterne, assertions su `role/status/dialog` e tempi controllati

---

## 2) Matrice flussi critici
**P0**
- Activation: signup/login → onboarding → pet → doc/vaccino → promemoria
- Safety: protezione → pagina pubblica → segnalazione → notifiche + moderazione
- Docs: upload + preview + retry
- ACL/Privacy: owner-only, pubblico minimal

**P1**
- Multi-pet: switch e isolamento
- Offline/poor network: app non si rompe

---

## 3) Test cases dettagliati (estratto P0)

### TC-ACT-01 Signup → Onboarding
- Preconditions: emulators; utente non loggato
- Steps: signup → verifica redirect `/onboarding`
- Expected: onboarding visibile; no loop
- Severity if fail: Blocker
- Fix priority: P0

### TC-SAFE-02 Finder report → Notifiche owner
- Preconditions: public page attiva
- Steps: invia segnalazione su `/p/:publicId` → apri Notifiche
- Expected: segnalazione in “Urgenti”, stato “Nuova”
- Severity: Blocker
- Priority: P0

### TC-ACL-01 Utente B non accede a pet di A
- Preconditions: utenti A e B; pet di A esiste
- Steps: loggati B → tenta accesso ai dati di A
- Expected: `PERMISSION_DENIED` gestito; no leak
- Severity: Blocker
- Priority: P0

---

## 4) Smoke tests (10 minuti)
- Auth
- Create pet
- Upload doc + preview
- Vaccino/evento salute
- Promemoria
- Protezione + public page
- Finder report + Notifiche + moderazione
- Nessun errore console

---

## 5) Regression suite
- E2E emulators (golden + safety)
- Upload retry
- ACL negative
- Multi-pet

---

## 6) Acceptance tests
- Ogni feature P0: 1 E2E + 1 negativo (permessi/errore)
- 3 run consecutive senza flaky

---

## 7) Error handling tests
- 401/unauth → redirect+message
- 403/permission denied → alert
- rate limit (finder) → messaggio “Troppi invii”
- upload fail → retry

---

## 8) Permessi/ruoli
- Owner-only su subcollection pet
- Public read-only
- Finder create diretto Firestore negato

---

## 9) Document upload
- allowlist type/size
- retry/resumable
- preview

---

## 10) Reminder/notifiche
- create
- quiet hours
- urgent vs digest

---

## 11) Multi-pet
- switch pet su core pages
- isolamento dati

---

## 12) Public profiles/smarrimento
- minimal data
- rate limit
- moderation

---

## 13) Offline/poor network
- offline banner
- retry

---

## 14) Performance
- Lighthouse budget
- query count budget

---

## 15) Accessibility
- focus management
- contrast
- roles

---

## 16) Cross-device
- iOS Safari/PWA
- Android Chrome
- Desktop

---

## 17) Incident checklist pre-deploy
- E2E verdi (3 run)
- no P0/P1 su Safety/Docs/Auth
- rules diff review
- rollback plan


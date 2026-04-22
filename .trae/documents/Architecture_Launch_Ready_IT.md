# PetLyon — Architettura Launch‑Ready (IT)

Questo documento è il **source of truth** architetturale per PetLyon (launch-ready) con focus su: scalabilità ragionevole, semplicità, manutenibilità, sicurezza, performance, analytics e osservabilità.

---

## 1) Architettura generale

**Stack target**
- **Frontend**: React + Vite PWA su Vercel (CDN, preview deploy, rollback veloce)
- **Backend core**: Firebase
  - Auth (identità)
  - Firestore (dati applicativi)
  - Storage (documenti e media)
  - Cloud Functions (callable + trigger)
- **AI**: chiamate server-side (callable) con provider configurabile e fallback non‑AI
- **Osservabilità**: Cloud Logging + Error Reporting + metriche custom; telemetry client opt‑in

**Principio non negoziabile**
- Qualunque cosa sia **pubblica** o **abuse‑prone** (es. segnalazioni finder) passa da **Cloud Functions**.
- Firestore Rules: **no write pubbliche** su dati sensibili; access control coerente per pet.

---

## 2) Domini funzionali
- Identity & Entitlements
- Pets & Profile
- Health
- Docs
- Safety & Recovery
- Sharing
- Notifications
- Analytics & Audit

---

## 3) Schema dati principale
- Un **User** possiede **Pet[]**.
- Ogni **Pet** ha: `documents`, `healthEvents`, `vaccines`, `therapies`, `metrics`, `finderReports`, `safetyEvents`.
- `petCards/{publicId}` è l’entrypoint pubblico per Safety.
- `recordsShares/{shareId}` è l’entrypoint pubblico temporaneo per condivisione cartella (read-only).

---

## 4) Collezioni/modelli (Firestore)

### 4.1 Users
- `users/{uid}`
  - `profile` (displayName?)
  - `preferences` (telemetry opt‑in, notifiche, AI)
  - `entitlements` (piano, flag)
  - `createdAt`, `updatedAt`

### 4.2 Pets
- `pets/{petId}`
  - `ownerId`
  - `name`, `species`, `photoUrl?`
  - `petProtection?` (enabled, publicId, …)
  - `createdAt`, `updatedAt`
  - subcollections:
    - `documents/{docId}`
    - `healthEvents/{eventId}`
    - `vaccines/{id}`
    - `therapies/{id}`
    - `metrics/{id}`
    - `finderReports/{reportId}`
    - `safetyEvents/{eventId}`

### 4.3 Public entrypoints
- `petCards/{publicId}`
  - `petId`, `ownerId`
  - `publicFields` (flags) + `publicNote`
  - `isLost` + `lostSinceAt?`
  - `createdAt`, `updatedAt`

- `recordsShares/{shareId}`
  - `petId`, `createdBy`
  - `expiresAt`, `scope`
  - `revokedAt?`
  - `createdAt`

---

## 5) Relazioni
- 1:N user→pets e pet→subcollections.
- `publicId → petId` tramite `petCards/{publicId}`.
- `shareId → petId` tramite `recordsShares/{shareId}`.
- Link doc↔event: `healthEvents.attachments[{docId, storagePath}]` (denormalizzazione minima).

---

## 6) File storage
- `petDocs/{petId}/{docId}/{filename}`
- `petMedia/{petId}/profile/{...}`

**Regole**
- Nessun oggetto “public” in Storage.
- Accesso via signed URL solo per share temporanei.

---

## 7) Gestione documenti
- Record Firestore creato prima dell’upload (`uploading`).
- Upload resumable; a fine upload: update a `ready` con meta file.
- Retry riprende sullo stesso record.
- Thumbnail/preview server-side post-lancio (trigger).

---

## 8) Autenticazione e autorizzazioni
- Auth: Firebase Auth.
- Owner: `pets.ownerId == auth.uid`.
- (Post-lancio) Members: `pets/{petId}/members/{uid}.role`.

---

## 9) Sharing e access control
- Public Pet Profile: read-only, safe defaults, niente PII.
- Finder reports: callable pubblico con rate limit + honeypot.
- Records share: read-only, TTL enforced server-side, revoca, scope.

---

## 10) Notifiche push/email
- In-app: feed urgenti/aggiornamenti.
- Push: FCM per segnalazioni finder e scadenze (digest).
- Email (post-lancio): export pronto, security alerts.

---

## 11) Search
- MVP: query Firestore + filtri.
- Core Plus: indice esterno su metadati.
- Post-lancio: full-text OCR con retention e privacy controls.

---

## 12) Audit log
- Append-only e server-side per azioni sensibili:
  - share create/revoke
  - lost enable/resolve
  - finder report moderation
  - export requested

---

## 13) Feature flags
- Global: Remote Config.
- Per utente: `users/{uid}.entitlements`.
- Enforcement: UI + server gating.

---

## 14) Analytics events
- Onboarding: started/goal/cta/completed/skipped.
- Docs: upload started/success/fail, preview, link to event.
- Safety: lost enabled, public opened, report sent, moderation.
- AI: call success/fail, prompt type, save.

---

## 15) Monitoring e alerting
- Callable error rate/latency per safety/share/AI.
- Spike `resource-exhausted` su endpoint pubblici.
- Permission denied spikes (rules regression).
- Client error boundary (opt‑in) + crash-free.

---

## 16) Backup/export
- Firestore scheduled export su GCS.
- Storage retention policy.
- Export utente: callable async + signed URL TTL.

---

## 17) Ambienti demo/staging/prod
- 3 progetti Firebase separati.
- Vercel preview→staging, prod→prod.
- Segreti isolati per ambiente.

---

## 18) Piano migrazioni
- `schemaVersion` per doc principali.
- Migrazioni lazy on-read + write-back opzionale.
- Batch migrations solo quando necessario.

---

## 19) Performance budget
- Dashboard: max 3–5 query leggere.
- Timeline: paginazione (limit 25).
- P95 first load < 2.5s su 4G mid device.
- Upload: resumable + retry.

---

## 20) Rischi e mitigazioni
- Abuso endpoint pubblici: callable + rate limit + honeypot + logging.
- Leak privacy share: TTL + revoca + scope + audit log.
- Costi AI: quota + caching + fallback + kill switch.
- Crescita Firestore: indici + paginazione + summary.
- Regressioni PWA: update prompt + monitor.


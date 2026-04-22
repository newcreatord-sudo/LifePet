# PetLyon Farm — Estensione (Piano Esecutivo)

Obiettivo: introdurre **Modalità Fattoria** senza rompere l’esperienza semplice del pet owner.

---

## 1) Prodotto: separazione Pet vs Farm

### Shared (riuso)
- Auth + entitlements
- Notification framework (in-app/push)
- Docs engine (upload/metadata/export) con scope per `farmId`
- Analytics schema + guardrail AI

### Separate (no confusione)
- Dati primari: `pets/*` vs `farms/*`
- Navigazione: `/app/*` vs `/app/farm/*`
- Terminologia: Pet vs Soggetti/Mandrie/Recinti/Dispositivi

---

## 2) P0 Launch (Small Breeder) — Backlog eseguibile

### EPIC F0 — Farm Shell & Access
**User stories**
- F0.1 Come utente voglio attivare Farm solo se abilitato (feature flag).
- F0.2 Come utente voglio switch Pet/Farm sempre chiaro.

**Data model**
- `users/{uid}.entitlements.farmEnabled: boolean`

**Security**
- Farm routes accessibili solo se `farmEnabled` e membership.

**Analytics**
- `farm_mode_opened`

**QA**
- access denied se flag off.

---

### EPIC F1 — Farms & RBAC base
**User stories**
- F1.1 Come owner creo una farm e divento owner.
- F1.2 Come owner aggiungo un operatore (role=operator) e posso revocare.

**Data model**
- `farms/{farmId}`: `name`, `ownerId`, `createdAt`
- `farms/{farmId}/members/{uid}`: `role=owner|operator|viewer`, `createdAt`

**Backend**
- callable `farmCreate`, `farmInvite`, `farmRevoke` (server-side validation)

**Security**
- rules: read/write solo se membership; solo owner può gestire membri.

**Edge cases**
- invito duplicato; revoca mentre operatore è online.

**Analytics**
- `farm_created`, `farm_member_added`, `farm_member_revoked`

**QA**
- operator non può invitare; viewer non può editare.

---

### EPIC F2 — Subjects (Animali) & Herds
**User stories**
- F2.1 Creo soggetto con tagId e lo assegno a una mandria.
- F2.2 Sposto più soggetti tra mandrie.

**Data model**
- `farms/{farmId}/herds/{herdId}`: `name`
- `farms/{farmId}/subjects/{subjectId}`: `tagId`, `species`, `herdId`, `status`, `createdAt`

**Backend**
- callable per bulk move (`subjectsBulkMove`) per atomicità.

**Security**
- operator può creare/modificare soggetti; viewer read-only.

**Analytics**
- `subject_created`, `subjects_bulk_moved`

**QA**
- bulk move aggiorna conteggi e viste.

---

### EPIC F3 — Devices & Telemetry ingest (GPS/Heartbeat)
**User stories**
- F3.1 Registro device e lo associo a subject.
- F3.2 Vedo ultimo contatto e batteria.

**Data model**
- `farms/{farmId}/devices/{deviceId}`: `subjectId`, `lastSeenAt`, `batteryPct`, `fw`, `status`
- `farms/{farmId}/telemetry/{subjectId}/points/{id}`: `lat`, `lng`, `at`

**Backend**
- HTTP ingest endpoint con device auth (token/cert) + dedup
- retention sweep (30 giorni)

**Security**
- device write solo su endpoint, non Firestore client

**Analytics**
- `device_registered`, `device_offline_detected`

**QA**
- ingest → lastSeen aggiorna; retention cancella punti vecchi.

---

### EPIC F4 — Geofences & Alerts
**User stories**
- F4.1 Creo un recinto (polygon) e lo associo a herd.
- F4.2 Ricevo alert quando soggetto è fuori recinto o device offline.
- F4.3 Acknowledge alert con nota.

**Data model**
- `farms/{farmId}/geofences/{id}`: `name`, `polygon`, `herdId`, `createdAt`
- `farms/{farmId}/alerts/{id}`: `type`, `severity`, `subjectId`, `createdAt`, `status=open|ack|resolved`, `ackBy?`, `ackAt?`, `note?`

**Backend**
- point-in-polygon su ingest (o sweep) → crea alert

**Security**
- operator ack; viewer read-only; audit su ack/resolution.

**Analytics**
- `alert_created`, `alert_acknowledged`, `alert_resolution_time`

**QA**
- simulazione punto fuori → alert; ack aggiorna UI.

---

### EPIC F5 — Farm Dashboard (valore reale)
**User stories**
- F5.1 Vedo “mancanti”, “offline”, “fuori recinto” e “alert aperti”.

**UX**
- 4 card + lista “top alert” con CTA.

**Analytics**
- `farm_dashboard_viewed`

**QA**
- conteggi coerenti con dati.

---

## 3) Sprint plan (Farm P0)

### Sprint 1
- Farm shell + feature flag
- Farm create + membership RBAC base
- Subjects CRUD + Herds

### Sprint 2
- Devices registry + association
- Telemetry ingest + lastSeen/battery
- Farm map base (ultima posizione)

### Sprint 3
- Geofence create
- Alerts (outside/offline) + inbox + ack
- Retention sweep

### Sprint 4
- Farm dashboard KPI
- Security hardening + audit
- QA regression + staging rollout

---

## 4) Definition of Done (Farm)
- Feature flag off non mostra Farm.
- RBAC: owner/operator/viewer testato.
- Ingest affidabile + dedup + retention.
- Alerts: create/ack/resolved funzionanti.
- Nessun impatto su Pet mode (performance e nav).
- E2E smoke farm + permessi + negative tests.


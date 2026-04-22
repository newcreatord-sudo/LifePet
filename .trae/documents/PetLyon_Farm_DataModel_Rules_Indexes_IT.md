# PetLyon Farm — Data Model + Rules + Indexes (IT)

Documento implementativo per introdurre `farms/*` senza impattare `pets/*`.

---

## 1) Collezioni Farm (Firestore)

### farms
- `farms/{farmId}`
  - `name`
  - `ownerId`
  - `createdAt`, `updatedAt`

### members (RBAC)
- `farms/{farmId}/members/{uid}`
  - `role: owner|operator|viewer`
  - `createdAt`

### herds
- `farms/{farmId}/herds/{herdId}`
  - `name`
  - `species?`
  - `createdAt`, `updatedAt`

### subjects
- `farms/{farmId}/subjects/{subjectId}`
  - base: `species`, `breed?`, `sex`, `birthDate?`, `status`, `statusAt`
  - grouping: `herdId?`, `penId?`
  - tags: `primaryTagId?`, `tagIds[]`
  - location snapshot: `lastLat?`, `lastLng?`, `lastSeenAt?`, `accuracyM?`, `source`
  - snapshots: `healthSnapshot`, `weightSnapshot`, `productionSnapshot`, `reproSnapshot`
  - `createdAt`, `updatedAt`

### tags
- `farms/{farmId}/tags/{tagId}`
  - `type: rfid|nfc|gps|ear_tag|collar`
  - `value` (normalizzato)
  - `status: active|lost|replaced|retired`
  - `assignedSubjectId?`, `assignedAt?`, `lastSeenAt?`
  - `deviceId?`
  - `createdAt`, `updatedAt`

### devices
- `farms/{farmId}/devices/{deviceId}`
  - `subjectId?`
  - `lastSeenAt`, `batteryPct?`, `fw?`, `status`
  - `createdAt`, `updatedAt`

### telemetry (time series)
- `farms/{farmId}/telemetry/{subjectId}/points/{pointId}`
  - `lat`, `lng`, `at`
  - `accuracyM?`, `source`

### geofences
- `farms/{farmId}/geofences/{geofenceId}`
  - `name`, `herdId?`
  - `polygon` (array coordinate)
  - `createdAt`, `updatedAt`

### alerts
- `farms/{farmId}/alerts/{alertId}`
  - `type: outside_geofence|device_offline|anomaly`
  - `severity: low|medium|high`
  - `subjectId?`, `herdId?`
  - `status: open|ack|resolved`
  - `createdAt`
  - `ackBy?`, `ackAt?`, `note?`

---

## 2) Callable/API minime (P0)

### farmCreate
- Input: `name`
- Output: `farmId`
- Regole: auth required; crea farm + membership owner.

### farmInvite / farmRevoke
- Owner-only.

### tagAssign (transazione)
- Input: `farmId`, `tagId`, `subjectId`
- Atomico: se tag già assegnato → errore o reassign esplicito.

### subjectsBulkMove
- Input: `subjectIds[]`, `toHerdId`
- Server-side validation + aggiornamento massivo.

### telemetryIngest (HTTP)
- Auth device token/cert.
- Dedup + update `devices.lastSeenAt` + update `subjects.location snapshot`.
- Eventi alert su fuori recinto/offline.

---

## 3) Security model (RBAC)

### Accesso Farm
- Read farm data: solo membri (`members/{uid}` esiste)
- Write:
  - owner: tutto
  - operator: soggetti, eventi, alerts ack
  - viewer: read-only

### Device security
- Device non usa Firestore client.
- Device scrive solo tramite endpoint ingest autenticato.

---

## 4) Firestore rules (linee guida)
- Isolamento tenant: ogni rule verifica `isFarmMember(farmId)`.
- Owner-only per membership e configurazioni sensibili (geofences, device registry).
- Nessuna write pubblica.

---

## 5) Indexes consigliati (P0)
- `subjects`: `herdId + status + updatedAt desc`
- `subjects`: `status + lastSeenAt asc` (per offline)
- `alerts`: `status + createdAt desc`
- `alerts`: `type + status + createdAt desc`
- `devices`: `status + lastSeenAt asc`

---

## 6) Retention policies
- Telemetry points: 30–90 giorni
- Alerts: 180 giorni
- Audit log: 1–2 anni (enterprise)


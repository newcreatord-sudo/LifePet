# PetLyon — Security & Privacy Hardening Plan (Go‑Live)

Documento operativo per hardening pre-lancio.

---

## Threat model (asset, attori, superfici)
**Asset**: profili pet, documenti (referti/ricette/ID), timeline salute, contatti proprietario, link pubblici/QR, share temporanei, segnalazioni finder, token push, segreti (AI/Stripe/Firebase), log/telemetry.

**Attori**: utente legittimo, caregiver, finder anonimo, spammer/bot, attacker opportunista (enumerazione), insider/compromissione segreti.

**Superfici**: Firestore rules, Storage rules, callable pubbliche, pagine pubbliche `/p/:publicId` e `/share/:shareId`, upload file, push/email, configurazione env su Vercel, PWA/service worker.

---

## Top rischi
1) Leakage dati via share/public
2) Abuse/DoS endpoint pubblici
3) Broken access control (owner)
4) Upload malevolo / storage misconfig
5) Session/device token risk
6) Logging con PII/chiavi
7) AI prompt injection / cost explosion
8) Incident response assente

---

## Controlli P0 (prima del lancio)

### Auth & Sessioni
- Logout all devices (invalidate refresh tokens)
- Email verification per azioni sensibili (share/export)

### Access control
- Rules review e test (owner-only)
- Operazioni sensibili solo via callable

### Public links / Sharing
- ID ad alta entropia per `publicId` e `shareId`
- TTL enforced server-side + revoca immediata
- `noindex` per pagine pubbliche

### Finder reports (anti-abuso)
- Submit solo via callable
- Rate limiting durabile (non in-memory)
- Honeypot + validazioni server-side

### Storage hardening
- No public ACL
- Allowlist content-type + size
- Signed URLs TTL per share/export

### Logging/Audit
- Audit log server-side per safety/share/export
- No PII nei log (hash ip/ua)

### Consent/Minimization/Retention
- Telemetry opt-in
- AI opt-in (dove serve)
- Retention: finder/safety e export con TTL e cleanup schedulato

### Incident response
- Runbook + kill switches (AI, share, finder submit)

---

## Controlli post‑lancio (P1/P2)
- App Check enforcement completo
- Malware scanning su upload + EXIF stripping
- Caregiver RBAC + inviti + audit
- CSP stricter + report-only rollout
- DLP light su AI (bloccare documenti personali)

---

## Go‑live checklist
- Rules: nessuna write pubblica su `pets/*`
- Storage: nessun file public, signed URL TTL
- Finder: callable + limiter + audit
- Share: TTL + revoke + noindex
- Logs: no segreti/PII
- Export/Delete: callable, TTL, audit
- Monitor: alert su spike errori/abuso


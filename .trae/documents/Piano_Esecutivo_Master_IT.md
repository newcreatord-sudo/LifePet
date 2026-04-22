# PetLyon — Piano Esecutivo Master (Launch‑Ready)

Questo piano è pensato per essere eseguito **domani** da un team (PM/Design/FE/BE/QA). Ogni item ha outcome chiaro, dipendenze, e criteri di Done.

---

## 1) Backlog master (ordinato per priorità)

### P0 — Must ship (blocca il lancio)
1. Onboarding goal-based e attivazione (1 pet + protezione + 1 doc/health + 1 reminder)
2. Core IA: navigazione Core/Secondaria/Farm pulita + pagina Protezione
3. Safety & Recovery: pagina pubblica + finder report anti-abuso + inbox + moderazione + timeline safety
4. Health & Docs: upload affidabile + libreria + timeline salute + link doc→evento + card summary in Dashboard
5. Privacy/Security: safe defaults, rules harden, sharing TTL/revoca, no PII pubblico
6. QA gates: E2E emulatori (golden + emergency) + build/lint/check verdi
7. Documentazione operativa: Architettura, QA plan, Security plan, Growth/Analytics plan

### P1 — Core Plus (entro 2–4 settimane post‑launch)
1. Records share temporaneo completo (scope, TTL, revoca, audit)
2. Export account/documenti (async, signed URL TTL)
3. Offline resiliency (banner + retry queue light)
4. Family/Caregiver (ruoli base) — se allineato con pricing
5. AI credibile: doc classification assistita + summary visita (con conferma)

### P2 — Post-lancio
1. Malware scanning upload + thumbnails
2. Search indicizzata (metadati) + full text OCR (se serve)
3. Advanced reminders (digest, smart scheduling)
4. Farm mode separato (shell dedicata)

---

## 2) Epics (con owner e output)

### EPIC A — Activation & Onboarding
- Owner: FE + PM
- Output: funnel completo e misurabile fino a PRP

### EPIC B — Core IA & App Shell
- Owner: FE
- Output: nav coerente e riduzione carico cognitivo

### EPIC C — Safety & Recovery (Killer Feature)
- Owner: BE + FE
- Output: profilo pubblico sicuro + segnalazioni affidabili + moderazione + timeline

### EPIC D — Health & Docs (Affidabilità)
- Owner: FE + BE
- Output: archivio + timeline + collegamenti e quick summary

### EPIC E — Privacy/Security Hardening
- Owner: BE + Security
- Output: rules, TTL, rate limit durabile, audit, incident readiness

### EPIC F — Observability & Analytics
- Owner: BE + Data
- Output: eventi chiave + dashboard base + alert

### EPIC G — QA & Release Engineering
- Owner: QA
- Output: suite stabile (no flaky) + checklist go-live

---

## 3) User stories (per epic)

### EPIC A — Activation & Onboarding
**A1** Come nuovo utente voglio capire valore in <30s e creare 1 pet.
- AC: onboarding welcome + goal picker + create pet flow senza blocchi.

**A2** Come utente voglio completare setup guidato (protezione + doc/health + reminder).
- AC: stepper 4 step, skip gestito, ripresa stato, completion.

**A3** Come PM voglio misurare drop-off e TTV.
- AC: eventi onboarding e step CTA tracciati.

### EPIC B — Core IA & App Shell
**B1** Come utente voglio una navigazione chiara (Core vs Secondaria) con Protezione tra i pilastri.
- AC: Core minimal, secondaria collassabile, mobile nav coerente.

### EPIC C — Safety & Recovery
**C1** Come owner voglio attivare protezione e avere QR/link pronti.
- AC: pagina Protezione, publicId, preview e copy rassicurante.

**C2** Come finder voglio contattare il proprietario in modo sicuro.
- AC: pagina pubblica minimal; submit report via callable.

**C3** Come owner voglio gestire segnalazioni (attendibile/spam/risolta).
- AC: azioni in Notifiche; status aggiornato; safety event scritto.

**C4** Come owner voglio cronologia eventi safety.
- AC: timeline safety in Protezione.

### EPIC D — Health & Docs
**D1** Come utente voglio caricare e ritrovare documenti senza perdere nulla.
- AC: upload robusto + retry + preview.

**D2** Come utente voglio collegare documenti agli eventi salute.
- AC: attach doc esistente in create event e dalla timeline.

**D3** Come utente voglio un riepilogo in Dashboard (scadenze/ultimo evento/suggerimento).
- AC: card “Salute & documenti”.

### EPIC E — Privacy/Security Hardening
**E1** Come utente voglio che nulla sia pubblico per default.
- AC: public fields minimal; no PII.

**E2** Come piattaforma voglio prevenire abuso su endpoint pubblici.
- AC: rate limit durabile + honeypot + circuit breaker.

**E3** Come admin voglio audit su azioni sensibili.
- AC: audit log server-side (share/finder moderation/export).

### EPIC F — Observability & Analytics
**F1** Come team voglio dashboard activation/safety/docs.
- AC: event schema + dashboard base.

### EPIC G — QA & Release
**G1** Come QA voglio una suite E2E stabile (no flaky) per golden + emergency path.
- AC: 3 run consecutive verdi.

---

## 4) Priorità (MoSCoW + severità)
- **Must**: A, B, C, D, E, G (P0)
- **Should**: F (analytics base) + share cartella completa (P1)
- **Could**: AI premium features (P1/P2)
- **Won’t**: diagnosi AI al lancio

---

## 5) Dipendenze (esplicite)
- C (Safety) dipende da E (rules + callable) per anti-abuso
- D (Docs) dipende da Storage rules + upload flow
- F (Analytics) dipende da eventi client + privacy opt-in
- G (QA) dipende da stabilità emulatori + no dipendenze esterne nei test

---

## 6) Piano Sprint 1–2–3–4

### Sprint 1 (P0) — Activation + Core IA
- Deliverable: onboarding goal-based + nav Core/Secondaria + Protezione entry.
- QA: E2E golden path (signup→pet→doc→reminder) verde.

### Sprint 2 (P0) — Safety & Recovery hardening
- Deliverable: callable finder submit + rate limit + moderazione + safety timeline.
- QA: E2E emergency path (public page→report→notifiche) verde.

### Sprint 3 (P0) — Health & Docs “affidabile”
- Deliverable: upload robusto, link doc→evento, dashboard summary.
- QA: E2E upload + health linkage smoke.

### Sprint 4 (P0) — Security/Privacy + Release
- Deliverable: rules review, audit log min, headers, runbook IR.
- QA: regression suite + go-live checklist + deploy.

---

## 7) Definition of Done (per area)

### Activation/Onboarding
- Funnel completabile end-to-end
- Eventi analytics per step
- 3 run E2E consecutive verdi

### Safety
- Public page minimal + no PII
- Finder submit via callable + limiter
- Moderazione funzionante
- Timeline safety visibile

### Health & Docs
- Upload con retry e preview
- Attach doc esistente ad evento
- Dashboard summary

### Privacy/Security
- Rules: owner-only
- Share TTL + revoke
- No public writes su dati sensibili
- Incident runbook + kill switches

### QA/Release
- `check/lint/build` verdi
- E2E emulatori verdi
- Smoke test manuale eseguito

---

## 8) Rischi di progetto (e mitigazioni)
- Flaky E2E → eliminare dipendenze esterne, assertions robuste
- Abuse pubblico → rate limit durabile + App Check
- Scope creep (Farm/AI) → “won’t” al lancio, feature flags
- Privacy leak → review rules + share TTL + audit
- Costi AI → quota + kill switch

---

## 9) Must‑exist prima del lancio
- Protezione + public profile + finder report anti-abuso + moderazione
- Upload documenti affidabile
- Onboarding che porta a PRP
- Privacy by default + rules solide
- QA gates e regression
- Support/Status link + docs operative

---

## 10) Checklist finale launch‑ready
- P0 epics Done
- 3 run E2E consecutive verdi
- Nessun P0/P1 aperto su Safety/Docs/Auth
- Firestore/Storage rules review firmata
- Secrets/env review
- Rollback plan
- Monitoring alert base attivo


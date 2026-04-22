# Petlion — Launch Readiness (RC)

Data: 2026-04-21

## Obiettivo
Portare Petlion a uno stato pronto per utenti reali: affidabile, coerente, veloce, sicuro e “premium”, senza regressioni.

## Stato attuale (sintesi)
- Stack: React + Vite + TypeScript, routing `react-router-dom`, stato con `zustand`, dati su Firebase (Auth/Firestore/Storage), PWA.
- Struttura: pagine in `src/pages`, componenti riusabili in `src/components`, accesso dati in `src/data`, logica in `src/lib`.
- Punti forti già presenti: onboarding, dashboard con stato, documenti con preview/export, Pet Protetto con pagina pubblica e segnalazioni, error boundary e fallback runtime.

## Rischi “launch” da gestire (priorità)
### P0 — Sicurezza e abuso
- Form pubblici (segnalazioni “trovato/avvistato”): richiedere input minimo, limitare lunghezze, aggiungere anti-spam leggero.
- Testare RLS/regole Firestore/Storage per proteggere dati privati, garantire che la pagina pubblica esponga solo campi consentiti.

### P0 — Affidabilità UX
- Stati di loading/empty/error coerenti in tutte le pagine chiave.
- CTA chiare e un percorso “next best action” in Dashboard e Profilo Pet.

### P1 — Performance percepita
- Code-splitting per aree pesanti (export/ZIP, mappe) e fallback robusto a chunk reload.
- Ridurre peso iniziale e ridurre re-render inutili in liste (Documenti/Notifiche).

### P1 — Credibilità prodotto
- Microcopy più rassicurante e concreto.
- Focus su sicurezza/ritrovamento e “tutto pronto quando serve”.

## Definizione di “Ready” (RC)
- Nessun errore TS/ESLint.
- Suite test unit + build sempre verdi.
- Flussi critici completati:
  - signup/login → onboarding → crea pet → attiva Pet Protetto → pagina pubblica → invio segnalazione
  - carica documenti → preview → categorizza/rename → export
  - planner/agenda/notifiche con stati coerenti
- Mobile-first: tap targets, overflow, modali, bottom nav, safe-area.

## QA checklist (pratica)
- Tutti i bottoni/CTA fanno qualcosa (o sono disabilitati con motivo).
- Nessun overflow orizzontale in mobile.
- Modali chiudibili, blocco durante operazioni in corso.
- Validazioni sui form: lunghezze, required minimi, feedback immediato.
- Pagine pubbliche: nessun dato sensibile non necessario.

## Roadmap consigliata (incrementale)
### Sprint 1 (hardening)
- Stabilizzare “Pet Protetto” e pagina pubblica con validazioni, anti-spam e UX.
- Rafforzare Dashboard con “safety checklist” e suggerimenti basati su dati mancanti.

### Sprint 2 (premium UX)
- Uniformare microcopy e componenti ripetuti.
- Rendere Documents un “hub” (bulk edit/rename, template titoli, suggerimenti documenti).

### Sprint 3 (growth + retention)
- Trigger intelligenti: “completa microchip”, “aggiungi foto identificativa”, “attiva protezione”.
- Email/push (se presenti) con preferenze e opt-in chiaro.


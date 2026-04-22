# Rilascio (PetLyon)

## Obiettivo

- Rilasciare Pet + Farm in modo semplice, stabile e sicuro.

## Checklist pre‑deploy

- App: `npm run check && npm run lint && npm run test:run && npm run build`
- Functions: `npm --prefix functions run build`
- Verificare che in produzione **non** sia attivo il simulatore: `MS_ENABLE_SIMULATION` deve essere `0`/non impostato.

## Deploy Firebase (obbligatorio per Farm)

- Deploy Rules + Functions:
  - `npm run firebase:deploy:all`
  - Se vuoi evitare prompt per AI durante il deploy (AI disattiva): `npm run firebase:deploy:all:safe`

Variabili ambiente Functions (minimo):

- `APP_URL` (es. `https://petlion.app`)
- `BILLING_DISABLED` (default nel codice: billing ON se `BILLING_DISABLED=0`, altrimenti OFF)
- `MS_ENABLE_SIMULATION` (solo demo; lasciare OFF in produzione)

Secrets Functions (obbligatori se le feature sono attive):

- `MS_WEBHOOK_SECRET` (obbligatorio per `msIngestWebhook`)
  - Impostazione via CLI: `npx firebase-tools functions:secrets:set MS_WEBHOOK_SECRET`
  - In alternativa: Secret Manager da Console Firebase/GCP

Opzionale:

- Se non vuoi deployare l’AI senza configurarla, imposta `SKIP_AI=1` nell’ambiente Functions.

Altri secrets (solo se usati):

- `OPENAI_API_KEY` (se AI attiva e `SKIP_AI!=1`)
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (se billing attivo e `BILLING_DISABLED=0`)

## Deploy Web (Vercel)

- Deploy Vercel (quando disponibile):
  - rate limit “api-upload-free” può bloccare deploy per 24h.

## Note sicurezza

- Firestore rules sono restrittive per `users/{uid}`, `recordShares`, `msRules`, `msIntegrations`.
- I job schedulati di simulazione sono disabilitati di default e richiedono `MS_ENABLE_SIMULATION=1`.

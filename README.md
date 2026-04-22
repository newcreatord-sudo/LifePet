# PetLyon

App web/PWA per la gestione del benessere del pet (agenda, planner, salute, community) con assistente AI.

## Sviluppo

1) Crea un file `.env` partendo da `.env.example`
2) Avvia:

```bash
npm install
npm run dev
```

## Variabili ambiente (frontend)

Obbligatorie (Firebase Web SDK):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Opzionali:
- `VITE_FIREBASE_FUNCTIONS_REGION` (default `us-central1`)
- `VITE_FIREBASE_VAPID_KEY` (push)
- `VITE_FIREBASE_FORCE_LONG_POLLING=1` (solo se hai problemi di rete/proxy)
- `VITE_AI_API_BASE` (override base URL backend AI in dev)
- `VITE_REACT_STRICT_MODE=1` (riattiva StrictMode in dev)

## Backend AI (Vercel /api)

Gli endpoint AI sono in `api/` (Edge Runtime). In produzione imposta su Vercel:
- `AI_GATEWAY_API_KEY` (consigliata)
  - in alternativa: `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID` (obbligatoria per proteggere `/api/*` con token Firebase)
- `APP_ORIGINS=https://petlion.app` (opzionale; blocca CORS a origin specifiche)
- `OPENAI_MODEL` e/o `OPENAI_VISION_MODEL` (opzionali)

Nota: `vercel.json` include una rewrite che lascia passare `/api/*` e applica fallback SPA su tutto il resto.

## Dominio (petlion.app)

Puoi usare sia il dominio Vercel `*.vercel.app` sia un dominio custom.

Configurazione consigliata:
- dominio principale: `https://petlion.app`
- (opzionale) `https://www.petlion.app` solo come redirect verso `https://petlion.app`

Vercel → Project → Settings → Domains
- aggiungi `petlion.app`
- se aggiungi `www.petlion.app`, configura redirect `www` → root
- evita redirect verso domini diversi/non esistenti (es. typo `petlyon.app`)

DNS (tipico)
- root (`petlion.app`): record `A` → `76.76.21.21` (oppure i record indicati da Vercel)
- `www`: record `CNAME` → `cname.vercel-dns.com`

Impostazioni consigliate lato piattaforme:
- Vercel env (per API): `APP_ORIGINS=https://petlion.app,https://www.petlion.app` (opzionale; same-origin è già consentito)
- Firebase Console → Authentication → Settings → Authorized domains: aggiungi `petlion.app` (e `www.petlion.app` se lo usi)

## Firebase (regole e funzioni)

Il progetto include:
- `firestore.rules` e `firestore.indexes.json`
- `functions/` (Cloud Functions)

Per pubblicare regole/funzioni sul progetto Firebase configurato in `.firebaserc`:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

In alternativa (script npm):

```bash
npm run firebase:deploy:functions
npm run firebase:deploy:firestore
npm run firebase:deploy:all
```

### Funzioni Multi‑Specie (webhook/queue/polling/geofence)

Le funzioni nuove sono in `functions/src/index.ts` e includono:
- `msIngestWebhook` (webhook ingest)
- `msEnqueueIngest` + `msProcessIngestQueue` (queue + retry + DLQ)
- `msPollingSweep` (polling scheduler scaffold)
- `msImportTelemetryBatch` (import CSV → queue)
- `msUpsertGeofence` / `msDeleteGeofence` (recinti digitali)

Secrets richiesti su Firebase Functions:
- `MS_WEBHOOK_SECRET` (header `X-MS-Secret` per webhook)

### Variabili ambiente Functions

Su Firebase Functions imposta:
- `APP_URL` (es. `https://petlyon.tuodominio.tld`) per redirect Stripe e link app.

## Build

```bash
npm run check
npm run lint
npm run test:run
npm run build
```

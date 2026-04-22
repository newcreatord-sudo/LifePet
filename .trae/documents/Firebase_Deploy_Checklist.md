# Firebase deploy checklist (LifePet)

Project target: `lifepet-3c2195d42c1e`

## 1) Firebase Console

- Authentication: abilita Email/Password
- Firestore Database: crea DB (prod o test)
- Storage: abilita bucket (prima volta: scegli la location con “Get started”)
- Cloud Messaging: abilita Web Push certificates e genera una chiave VAPID

Nota: per deployare Cloud Functions (AI, scheduler anti-no-show, push) serve piano **Blaze**.

## 2) Variabili ambiente (Frontend)

- Crea `.env.local` partendo da `.env.example`
- Compila:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID` (opzionale)
  - `VITE_FIREBASE_FUNCTIONS_REGION` (default `us-central1`)
  - `VITE_FIREBASE_VAPID_KEY` (opzionale: serve per push notifications)

Importante: nel progetto Firebase può comparire più di una Web App `lifepet-web` (App ID diversi). Usa **un solo** set di `VITE_FIREBASE_*` coerente con l’App ID scelto.

Su Vercel imposta le stesse variabili in Project Settings → Environment Variables.

## 3) Secrets (AI) per Cloud Functions

- Imposta il secret:
  - `firebase functions:secrets:set OPENAI_API_KEY`

## 3b) Secrets (Multi‑Specie) per Cloud Functions

- (Opzionale ma consigliato) Webhook ingest:
  - `firebase functions:secrets:set MS_WEBHOOK_SECRET`

Nota: il webhook `msIngestWebhook` rifiuta le richieste se `X-MS-Secret` non corrisponde.

## 4) Deploy (Rules + Functions)

- Deploy rules + indexes:
  - `firebase deploy --only firestore:rules,firestore:indexes,storage`

- Deploy functions:
  - `firebase deploy --only functions`

## 4b) Abilitare polling mock (facoltativo)

- Per attivare il polling mock server-side:
  - Crea/aggiorna il doc `users/{uid}/msIntegrations/mock` con `{ enabled: true }`
- La schedule `msMockPollingSweep` esegue un tick ogni 5 minuti per gli utenti abilitati.

Nota (Documenti): è presente una function di cleanup `onPetDocumentDeleted` che elimina il file in Storage quando cancelli un documento da Firestore. Assicurati che il deploy functions sia aggiornato.

Se `firebase deploy --only functions` fallisce con richiesta Blaze, abilita Blaze in:
`https://console.firebase.google.com/project/lifepet-3c2195d42c1e/usage/details`

## 5) Test rapido

- Login
- Crea pet
- Carica documento (PDF o immagine)
- Crea evento salute “symptom” con severity “high” (genera alert)
- GPS: registra un punto fuori geofence (genera alert)
- Settings → Notifications → Enable push (se VAPID configurato)
- Piattaforma → Pet + Farm: avvia demo (usa `msSimTick` se non in demo mode)

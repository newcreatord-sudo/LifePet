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

## 4) Deploy (Rules + Functions)

- Deploy rules:
  - `firebase deploy --only firestore:rules,storage`

- Deploy functions:
  - `firebase deploy --only functions`

Se `firebase deploy --only functions` fallisce con richiesta Blaze, abilita Blaze in:
`https://console.firebase.google.com/project/lifepet-3c2195d42c1e/usage/details`

## 5) Test rapido

- Login
- Crea pet
- Carica documento (PDF o immagine)
- Crea evento salute “symptom” con severity “high” (genera alert)
- GPS: registra un punto fuori geofence (genera alert)
- Settings → Notifications → Enable push (se VAPID configurato)

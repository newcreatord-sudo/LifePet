## Release & Deploy (Vercel) — LifePet

### Build locale

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run test:e2e`

### Vercel (SPA)

- Il progetto include `vercel.json` con rewrite su `index.html` per routing SPA.
- Imposta su Vercel le variabili `VITE_FIREBASE_*` (vedi `Firebase_Deploy_Checklist.md`).
- Imposta su Vercel (API Edge):
  - `FIREBASE_PROJECT_ID=lifepet-3c2195d42c1e`
  - `AI_GATEWAY_API_KEY` (oppure `OPENAI_API_KEY`)
  - (opzionale) `APP_ORIGINS=https://petlion.app`
- Build command: `npm run build`
- Output directory: `dist`

### Post-deploy (smoke test)

- Home → Login → Demo
- Onboarding (prima volta) → Skip/Finish
- Dashboard → Crea pet → Refresh (persistenza)
- Apri una pagina con `RequireActivePet` (es. Salute) e verifica gate + CTA
- Carica un documento (se Firebase configurato) o usa demo
- Documenti: tag + preferiti + backup ZIP
- AI: apri Chat e verifica che risponda (se AI attiva)
- Push: Settings → Notifications → Enable push (se VAPID configurato)
- Piattaforma → Pet + Farm → Avvia demo → verifica telemetria + alert + inbox

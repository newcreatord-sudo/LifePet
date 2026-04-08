# LifePet — Documento “Definitivo” (Tema, Tutorial, QA)

## Obiettivo
Rendere LifePet coerente, navigabile e pronta per rilascio: identità visiva unica (azzurro chiaro come primary), tutorial/onboarding sempre attivabile, checklist funzionalità e QA.

## Tema UI (Design System)

### Colore principale (Primary)
- Primary: **Sky** (azzurro chiaro)
  - `sky-600` (azione primaria)
  - `sky-500` (hover)
  - `sky-600/10` + `sky-600/20` (chip, badge, highlight soft)

### Palette abbinata
- Neutri: `slate-900` (testo), `slate-700` (testo secondario), `slate-600` (muted), `slate-200/70` (bordi)
- Secondario (accent): **Indigo** (sfumature/ambient glow) `indigo-400/20`, `indigo-50`
- Stati:
  - Success: `emerald-600` (o `emerald-500` hover)
  - Warning: `amber-500`
  - Danger: `rose-500`

### Background & superfici
- Sfondo app: gradiente soft `from-sky-50 via-white to-indigo-50`
- Superfici: `bg-white/70` con `backdrop-blur-sm`
- Card: bordi sottili + shadow “hairline”

### Regole componenti
- CTA primaria: `.lp-btn-primary` (sky)
- CTA secondaria: `.lp-btn-secondary` (neutro)
- Focus ring: `focus:ring-sky-500/30`

## Linee guida UI/UX
### Navigazione
- Desktop: sidebar completa (tutte le funzioni principali)
- Mobile: bottom nav con 4 entry rapide + menu completo
- Ogni pagina deve avere:
  - titolo chiaro, microdescrizione
  - empty state + CTA per creare contenuti quando vuota
  - skeleton/loader per dati asincroni

### Accessibilità
- Bottoni e link sempre cliccabili e distinguibili
- Contrasto: testo principale `slate-900`, secondario `slate-700`
- Target touch: min ~44px per azioni principali su mobile

### Pattern di stato
- Errori: messaggio corto + azione (riprovare)
- Empty: spiegazione + “Crea/Importa/Aggiungi”
- Success: feedback visivo non invadente

## Tutorial / Onboarding in-app

### Requisiti
- Sempre **attivabile/disattivabile** da Impostazioni
- Avviabile da pulsante **“Tutorial”** visibile in app
- Guida per sezioni: ogni route principale ha una scheda tutorial con passi
- Progress persistente (salvato localmente): possibilità di reset

### Flusso consigliato
1) Prima apertura: tutorial si propone su Dashboard (una volta)
2) In qualunque pagina: pulsante “Tutorial” apre la guida di quella sezione
3) Impostazioni → Tutorial:
   - toggle “Tutorial attivo”
   - “Avvia tutorial”
   - “Reset tutorial”

### Copertura sezioni (minimo)
- Dashboard, Profilo pet, Salute, Cartella clinica, Documenti
- Terapie, Vaccini, Alimentazione, Benessere, Status
- Agenda, Planner, Training, Prenotazioni
- GPS, Spese, Notifiche, Community, Marketplace, Insights

## Checklist funzionalità (Definition of Done)
### Navigazione & UX
- Tutte le voci principali sono raggiungibili e caricano senza crash
- Ogni pagina gestisce: loading, empty state, errore
- Il cambio pet aggiorna correttamente i dati

### Sicurezza & accessi
- Export dati: solo Pro, enforcement server-side
- Chat community: scrittura solo membri del gruppo
- Link share: scadenza e cleanup server-side

### Notifiche & push
- Stato push coerente al refresh
- Refresh token gestito e persistito su Firestore

### Backend / job
- Sweep spese ricorrenti server-side
- Sweep recordShares scaduti server-side

## QA Checklist (pre-release)
### Funzionale
- Login/Logout, demo mode
- Creazione pet, switch pet
- Creazione eventi agenda e task planner
- Inserimento terapia/vaccino e verifica reminder
- Community: join gruppo → invio messaggi; senza join → blocco
- Export account/pet (Pro) → download firmato

### Affidabilità
- Nessun errore console bloccante
- Nessun crash su refresh di pagina
- Gestione rete lenta (loader visibile)

### Performance
- Navigazione reattiva, liste scrollabili

### Stile
- Nessun colore fuori palette (primary sky, accent indigo)
- Bottoni principali coerenti (sky)

## Note tecniche (implementazione)
- Persistenza tutorial: `localStorage` (chiave `lifepet:tutorial:v1`)
- Tutorial overlay: modale con passi, selettore sezioni, reset e disattiva
- Tema: sostituzione completa di `fuchsia-*` con `sky-*` (primary) e `indigo-*` (accent)


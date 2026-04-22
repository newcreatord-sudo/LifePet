# Design Pagine (Desktop-first) — PetLyon Ritrovamento/QR

## Global Styles
- Layout system: CSS Grid per strutture pagina + Flexbox per componenti (navbar, card actions).
- Breakpoints: Desktop (≥1200px) primary; Tablet (≥768px) 2-col; Mobile (<768px) 1-col.
- Tokens (esempio):
  - Background: #F6FAFF, Surface: #FFFFFF, Text: #0B1B2B, Muted: #5B6B7A
  - Primary: #2B7CFF, PrimaryHover: #1E66DA, Accent: #22C55E, Danger: #EF4444
  - Radius: 14px, Shadow: soft (0 10px 30px rgba(0,0,0,.08))
  - Typography: H1 44/52, H2 28/36, Body 16/24, Small 13/18
- Buttons:
  - Primary: filled Primary, hover darken, focus ring.
  - Secondary: outline Primary.
  - Danger: filled Danger per “Segnala abbandono”.
- Link: underline on hover, colore Primary.

## Page 1 — Landing / Home
### Meta Information
- Title: "PetLyon — Pet Protetto, ritrovamento rapido con QR/ID"
- Description: "Attiva Pet Protetto, salva documenti cloud e aiuta la community a ritrovare animali smarriti e supportare adozioni."
- Open Graph: og:title/description coerenti, og:image hero.

### Page Structure
- Header sticky + contenuto a sezioni verticali.
- Container max-width 1200px, padding 24–32px.

### Sections & Components
1. Top Navbar
   - Logo PetLyon (sx)
   - Link: Community, Adozioni (porta a /community tab), Come funziona
   - CTA: “Attiva protezione” (primary) + “Accedi” (text/secondary)
2. Hero (nuova)
   - Titolo principale: “Non perdere mai più il tuo animale”
   - Secondo titolo: “E non perdere mai più i suoi documenti”
   - Sottotitolo: “PetLyon protegge il tuo pet, conserva tutti i suoi dati e ti aiuta a ritrovarlo in caso di smarrimento”
   - CTA1: “Scarica gratis” (primary) → store links / PWA install
   - CTA2: “Registra il tuo animale” (secondary) → /attiva
   - Visual emozionale: cane smarrito → uso app → ritrovamento → abbraccio
3. Quick Actions (3 card)
   - “Scansiona / Inserisci ID” (campo + bottone) → /p/:publicId
   - “Pubblica segnalazione” → /community (tab Segnalazioni)
   - “Cerca adozione” → /community (tab Adozioni)
4. Come funziona (3 step)
   - Step 1: crea profilo pet
   - Step 2: associa QR/ID
   - Step 3: ricevi segnalazioni
5. Sistema “Pet Protetto PetLyon” (core feature)
   - Badge: 🛡️ “Pet Protetto PetLyon”
   - Sotto-badge: 📍 Tracciabile · 👤 Identificabile · 📄 Documenti sempre disponibili
   - Funzioni: scansione QR → scheda animale; contatto rapido; segnalazione trovato; storico eventi
   - Messaggio UX: “Se il tuo animale è registrato su PetLyon, sarà sempre riconducibile a te”
   - Nota copy anti-abbandono: usare “abbandono molto più difficile e facilmente tracciabile”
6. Documenti digitali (funzione chiave)
   - Titolo: “Non perdere mai più i documenti del tuo cane”
   - Funzioni: libretto sanitario; vaccini; visite; upload PDF/foto; accesso rapido
   - Messaggio: “Tutto sempre con te, in un unico posto sicuro”
7. Segnalazioni + Community
   - Funzioni: segnala smarrito; segnala trovato; mappa; notifiche vicine
   - Messaggio: “Una community che protegge gli animali insieme”
8. Adozioni (impatto sociale)
   - Titolo: “Aiutiamo a svuotare i canili”
   - Card animali + pulsante “Adotta”
   - Messaggio: “Dai una casa a chi ne ha bisogno”
9. Contro l’abbandono
   - Titolo: “Contro l’abbandono”
   - Testo: “PetLyon rende ogni animale registrato riconducibile al proprietario, aiutando a prevenire e contrastare l’abbandono”
10. Fiducia (obbligatorio)
   - Contatori: “Animali registrati”, “Animali aiutati”, “Utenti attivi”
   - Testimonianze utenti
11. Privacy & Safety mini FAQ
   - Toggle/accordion: “Cosa vede chi scansiona?”, “Come proteggo il mio numero?”
12. Footer
   - Link legali, contatti, social

## Page 2 — Login / Registrazione (/auth)
### Layout
- Two-column desktop: sinistra visual/benefit, destra card form.

### Components
- Tabs: Login | Registrazione
- Fields essenziali: email, password (+ conferma in registrazione)
- CTA: “Continua” + link recupero password
- Microcopy su privacy contatti

## Page 3 — Attiva protezione (/attiva)
### Meta Information
- Title: "Attiva Pet Protetto — PetLyon"

### Page Structure
- Wizard a step con progress indicator (4 step), card centrale max 720px.

### Steps & Components
1. Dati pet
   - Foto (upload), nome, specie, razza (optional)
2. Contatti e privacy
   - Selettori: mostra telefono (sì/no), mostra email (sì/no)
   - Campo “Nota pubblica” (breve)
3. Associa QR/ID
   - Input publicId + scanner (se da mobile) / spiegazione dove trovare l’ID
   - Stato validazione: disponibile / già associato / non valido
4. Riepilogo e Attiva
   - Summary card + checkbox conferma
   - CTA: “Attiva protezione”

### Success State
- Banner verde “Protetto”
- Pulsanti: “Vai all’Area Proprietario” e “Apri profilo pubblico”
- Box istruzioni: come applicare il QR (collare/medaglietta)

### Stato “Protetto” (in-app)
- Bottone “Attiva protezione PetLyon” visibile nel profilo pet.
- Attivazione abilita badge e rende il pet rilevante per community in emergenza (es. quando marcato smarrito).
- Microchip: integrazione successiva (campo/collegamento), senza bloccare QR.

## Page 4 — Area Proprietario (/owner)
### Layout
- Desktop: sidebar sinistra (Pets, Documenti, Segnalazioni) + main content.

### Key Components
- Selettore pet (dropdown o list)
- Card “Stato protezione”: Protetto / Smarrito (toggle con conferma)
- Documenti cloud:
  - Tabella file (titolo, data, visibilità) + azioni (apri, elimina, genera link)
- Segnalazioni ricevute:
  - Lista card con badge (found/sighted), data, area, contatto (se fornito)

## Page 5 — Profilo Pet pubblico (/p/:publicId)
### Layout
- Header compatto + profilo in card grande.

### Components
- Hero card pet: foto, nome, specie, badge “Pet Protetto”
- Stato: se “Smarrito” mostra banner Danger con istruzioni
- Blocchi informativi: note proprietario + cosa fare
- CTA principali:
  - “Ho trovato” (primary) → modal form
  - “Ho avvistato” (secondary) → modal form
- Modal segnalazione:
  - Campi: contatto (testo), area/posizione (testo), nota
  - CTA: invia; stato success + reminder sicurezza

## Page 6 — Community (/community)
### Layout
- Top tabs: Segnalazioni | Adozioni | Anti-abbandono
- Griglia contenuti 3-col desktop (card), 2-col tablet, 1-col mobile.

### Segnalazioni
- Filtri: tipo, area (testo)
- CTA “Pubblica segnalazione” → modal con form (tipo, area, contenuto)

### Adozioni
- Lista card con: titolo, area, mini descrizione, contatto
- CTA “Pubblica annuncio” → modal (titolo, area, descrizione, contatto)

### Anti-abbandono
- CTA “Segnala abbandono” (Danger) → usa stesso schema segnalazione con tipo=abandonment
- Sezione informativa breve: cosa fare e numeri/enti (testo statico configurabile)

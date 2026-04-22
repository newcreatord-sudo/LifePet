# Design pagine (Desktop-first) — Fluidità, feedback, palette azzurro, immagini

## Global Styles
**Design tokens (proposti)**
- Background: #F7FAFF
- Surface/Card: #FFFFFF
- Primary (Azzurro acceso): #009DFF
- Primary Hover: #008AE0
- Primary Pressed: #0077C2
- Text Primary: #0B1220
- Text Secondary: #4A5872
- Border: #D7E2F2
- Success: #19B36B, Error: #E5484D, Warning: #F5A524

**Tipografia (scala semplice)**
- H1 28/34 semibold, H2 20/28 semibold, Body 14/20 regular, Caption 12/16

**Bottoni (stati obbligatori)**
- Default: background Primary, testo bianco, radius 12px, padding 10–12px
- Hover: Primary Hover
- Pressed: Primary Pressed + leggera riduzione scale (es. 0.99)
- Disabled: opacity 0.45, cursor not-allowed
- Loading: spinner inline + label invariata, bottone disabilitato (anti doppio invio)
- Success/Error: toast/snackbar in alto a destra (desktop), click-to-dismiss; sugli errori offrire sempre “Riprova” quando possibile

**Feedback obbligatorio su CTA**
- Se una CTA non può procedere (es. pet non selezionato), non disabilitare “silenziosamente”: mostrare toast/banner “Crea o seleziona un pet” e link diretto a `Dashboard#create-pet`.

**Immagini (coerenza e ordine)**
- Tutte le card con immagine: aspect ratio fisso (es. 16:9), border-radius 12px
- Loading immagini: skeleton + placeholder sfocato (se disponibile)
- Fallback: icona + sfondo neutro se immagine assente

**Layout & responsive**
- Desktop-first: griglia 12 colonne, max-width 1200px, gutter 24px, padding pagina 24–32px
- Breakpoint suggeriti: 1200 / 992 / 768

---

## Pagina: Onboarding guidato
### Layout
- Layout a 2 colonne su desktop: contenuto (immagine+testo) + lista step.
- Navigazione: “Indietro”, “Avanti”, “Salta”, e “Inizia” all’ultimo step.

### Meta Information
- Title: “Benvenuto in LifePet”
- Description: “Guida rapida per iniziare e scoprire le funzioni principali.”
- OG: titolo + immagine generica (brand azzurro)

### Page Structure
1. Header: label “Onboarding”, step corrente, azione “Salta”
2. Progress: barra progressiva
3. Content: immagine 16:9 + titolo + descrizione + bullet
4. CTA contestuale (opzionale): es. “Crea pet adesso” → `Dashboard#create-pet`
5. Pannello step (dx): elenco step cliccabili
6. Footer azioni: Indietro/Avanti o Inizia

### Interazioni
- Transizioni tra step: fade + slide 120–180ms (evitare animazioni lente)
- Persistenza: completamento onboarding salvato in storage; se non completato, l’area `/app/*` fa redirect a `/onboarding`
- Validazione: non bloccare con errori ambigui; se serve permesso, spiegare perché e offrire “Non ora”

---

## Pagina: Home (schermata principale)
### Layout
- Header fisso leggero (height 64px): logo a sinistra, azioni globali a destra.
- Contenuto: sezioni verticali, ognuna con titolo + azione primaria.
- Griglia card immagini: 2–3 colonne desktop, 1–2 colonne sotto 992px.

### Meta Information
- Title: “LifePet”
- Description: “La tua schermata principale: contenuti e azioni rapide.”
- OG: titolo + immagine brand

### Page Structure
1. Top bar
   - Brand
   - Pulsante primario globale (se presente) + eventuale menu utente
2. Sezione contenuti con immagini (card)
   - Card: immagine 16:9, titolo, sottotitolo, una CTA primaria
   - Stati: skeleton in caricamento, empty state con illustrazione
3. Feedback area
   - Toast/snackbar per success/error
   - Inline error sotto ai componenti, solo quando serve

### Regole “UI più ordinata”
- Ridurre CTA: massimo 1 primaria visibile per card/sezione
- Allineare testi: stessa baseline e spacing (8/12/16/24)
- Usare bordi sottili e ombre minime (shadow sm) per separare, non per decorare

---

## Pagina: Dashboard (post-login)
### Layout
- Header con azioni rapide (max 2).
- Prima sezione: card “hero” con immagini e CTA “Apri" per funzioni principali.
- Seconda sezione: card status del pet attivo + metriche (task/alert/agenda/insight).

### Page Structure
1. Header: titolo + 0–2 azioni
2. Hero grid: 3 card (16:9) con immagine, titolo, descrizione, CTA
3. Pet card: pet attivo, status, link a Records
4. Quick actions: bottoni “card" per log rapidi

### Stati
- Nessun pet: mostrare EmptyState con CTA “Inizia" → `#create-pet` e banner persistente “Crea pet".
- Azione non disponibile: toast informativo con next-step.

---

## Pagina: Dettaglio contenuto
### Layout
- Two-column desktop: contenuto a sinistra (8 col), pannello azioni a destra (4 col).
- Sotto 992px: layout a colonna con pannello azioni sotto l’hero.

### Meta Information
- Title dinamico: “{Titolo contenuto} — LifePet”
- Description: “Dettagli e azioni relative al contenuto selezionato.”
- OG: immagine del contenuto (se disponibile)

### Page Structure
1. Breadcrumb/back
2. Hero immagine (o galleria)
3. Titolo + metadati
4. Sezioni contenuto (card/accordion leggeri)
5. Pannello azioni
   - CTA primaria (azzurro) + secondarie (outline)
   - Stati: loading con spinner; error con retry; success con toast

### Accessibilità e feedback
- Focus ring evidente su elementi interattivi
- Target minimo clic 40px
- Messaggi errore: testo chiaro + azione “Riprova”

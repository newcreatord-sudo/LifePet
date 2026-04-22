# Design Pagine (Desktop-first) — Gestione Documenti

## Global Styles (Design Tokens)
- Layout: griglia 12 colonne, max-width 1200–1280px, gutter 24px; sidebar fissa 280px su desktop.
- Spaziature: 4/8/12/16/24/32/48.
- Colori:
  - Background: #0B1220 (app shell) / #0F172A (surface)
  - Card: #111C33
  - Testo primario: #E5E7EB; secondario: #94A3B8
  - Accento primario: #3B82F6; hover: #2563EB
  - Success: #22C55E; Warning: #F59E0B; Danger: #EF4444
  - Bordi/divisori: rgba(148,163,184,0.18)
- Tipografia:
  - Font: Inter (o system-ui fallback)
  - Scala: H1 28/36, H2 20/28, H3 16/24, Body 14/20, Caption 12/16
- Componenti base:
  - Button: primary/secondary/ghost; focus ring 2px #60A5FA
  - Input/Search: altezza 40px; icona a sinistra; clear action
  - Table/List row: hover background #0F1B33; selected state con bordo #3B82F6
- Motion: transizioni 150–200ms (opacity/transform), niente animazioni pesanti.

---

## Pagina: Accesso
### Meta Information
- Title: “Accesso | Gestione Documenti”
- Description: “Accedi per gestire, cercare e condividere i tuoi documenti in modo sicuro.”
- Open Graph: titolo/descrizione coerenti; immagine generica brand.

### Layout
- Struttura centrata (Flexbox), card 420px; background con pattern leggero.

### Page Structure
1. Header minimal (logo + nome prodotto)
2. Auth Card
3. Footer microcopy (privacy/termini)

### Sections & Components
- Auth Card (tab o toggle)
  - Tab “Accedi” / “Registrati”
  - Campi email + password (password con show/hide)
  - CTA primaria
  - Link “Password dimenticata” → dialog inline
  - Stati: loading, errore credenziali, validazione email
- Dialog “Recupero password”
  - Campo email + CTA “Invia link” + messaggio esito

---

## Pagina: Documenti (Dashboard)
### Meta Information
- Title: “Documenti | Gestione Documenti”
- Description: “Libreria documenti: carica, organizza, cerca, condividi, offline e backup.”
- Open Graph: titolo/descrizione; immagine brand.

### Layout
- App shell a 2 colonne (CSS Grid):
  - Sidebar (280px) + Main content (auto)
- Main: header sticky interno + area contenuti scrollabile.

### Page Structure
1. Sidebar di navigazione
2. Top Bar (ricerca + azioni)
3. Area Libreria (lista/griglia)
4. Pannello laterale contestuale (dettagli rapidi / permessi / offline) come drawer a destra

### Sections & Components
- Sidebar
  - Voci: “Tutti”, “Recenti”, “Preferiti”, “Condivisi con me”
  - Sezione “Cartelle” con tree (crea/rinomina via menu)
  - Sezione “Tag” (chip list + gestione rapida)
- Top Bar
  - Search input (query live)
  - Filtri: cartella, tag, proprietà (miei/condivisi), ordinamento
  - CTA primaria “Carica documento”
  - Menu “Backup/Offline” (azioni principali)
- Upload (modal)
  - Drag&drop area
  - Campi: Titolo (obbligatorio), Descrizione (opzionale), Cartella (opzionale), Tag (opzionale)
  - Progress bar e stato completamento
- Libreria
  - Toggle vista: Lista (default) / Griglia
  - Riga documento: icona tipo file, titolo, cartella, tag, owner/condiviso, data aggiornamento, menu azioni
  - Selezione singola per aprire pannello contestuale
- Drawer contestuale (a destra)
  - Tab: “Info”, “Permessi”, “Offline”
  - Info: metadati sintetici + link “Apri dettaglio”
  - Permessi: campo email + select ruolo (read/edit) + lista accessi + revoca
  - Offline: toggle “Disponibile offline”, stato cache, ultimo sync
- Backup (modal)
  - Selezione ambito: documenti selezionati / cartella corrente / filtro corrente
  - CTA “Esporta backup” (scarica zip) + spiegazione contenuto (manifest + file)

### Responsive behavior (desktop-first)
- ≥1024px: sidebar visibile + drawer a destra.
- <1024px: sidebar come drawer; pannello contestuale come bottom sheet.

---

## Pagina: Dettaglio Documento
### Meta Information
- Title: “Documento: {Titolo} | Gestione Documenti”
- Description: “Anteprima, metadati, versioni, permessi e offline del documento.”
- Open Graph: titolo documento + owner; immagine brand.

### Layout
- Layout 2 colonne (CSS Grid):
  - Colonna sinistra: preview/azione principale
  - Colonna destra: pannello proprietà (sticky)

### Page Structure
1. Header documento (breadcrumb + titolo + azioni)
2. Preview / Viewer
3. Pannello proprietà (tab)

### Sections & Components
- Header documento
  - Breadcrumb: Documenti > Cartella > Documento
  - Azioni: Download, “Carica nuova versione”, “Condividi”, “Disponibile offline”
- Viewer
  - Se preview supportata: area preview (iframe/canvas) con skeleton loading
  - Fallback: card “Anteprima non disponibile” + Download
- Pannello proprietà (tabs)
  - Tab “Dettagli”
    - Edit inline: titolo, descrizione
    - Selettore cartella + gestione tag (chips + autocomplete)
    - Metadati read-only: tipo, dimensione, owner, aggiornato
  - Tab “Versioni”
    - Lista versioni (vN, data, checksum opzionale)
    - Azioni: scarica versione, ripristina versione
  - Tab “Permessi”
    - Invito via email + ruolo (read/edit)
    - Lista accessi + revoca
  - Tab “Offline”
    - Stato cache, dimensione cache, ultimo sync
    - Gestione conflitti: banner avviso se modifiche locali non sincronizzate (con scelta “mantieni locale” / “usa remoto”)

### Interaction states
- Azioni permesse/disabilitate in base al ruolo (owner vs shared read/edit).
- Toast per: upload completato, permesso aggiornato, offline abilitato, backup avviato/finito.

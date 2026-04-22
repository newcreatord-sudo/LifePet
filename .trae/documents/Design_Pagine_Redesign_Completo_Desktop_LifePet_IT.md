# Page Design (Desktop-first) — Redesign completo LifePet

## Global Styles (design tokens + motion)
- Layout: Desktop-first con CSS Grid + Flex (Tailwind). Contenitore max-w-6xl, spacing 8/12/16/24.
- Palette: background chiaro “glass”, primary azzurro, accent soft; alto contrasto testo.
- Tipografia: scala 12/14/16/20/24/32; titoli semi-bold, body regular.
- Componenti: card rounded-2xl/3xl, shadow-sm; input e select uniformi (lp-input/lp-select); pulsanti primary/secondary/icon.
- Animazioni: micro-interazioni (hover lift, fade/slide in, skeleton); rispettare `motion-safe` e riduzione movimento.
- Stati: loading (skeleton), empty (EmptyState), error (Alert), success (toast).

## Struttura globale app (AppShell)
- Layout: sidebar sinistra su desktop (ricerca nel menu + gruppi), contenuto a destra; topbar mobile + bottom nav.
- Componenti fissi: Pet Switcher, Toasts, Tutorial overlay, AI Assist FAB.
- Navigazione: 1 funzione = 1 pagina; evitare tab complessi (AI e altre sezioni spezzate in pagine dedicate).

## Meta Information (pattern)
Per ogni pagina:
- Title: "LifePet — {Nome pagina}"; Description: 1 riga utile; OG: title+description+image (feature image).

## Pagine
### 1) Home (pubblica)
- Struttura: hero + value props + CTA (Accedi / Demo).
- Componenti: sezione feature (card), footer minimale.

### 2) Login / Crea account
- Layout: split (immagine/benefici a sinistra, form a destra). Modalità demo evidenziata.
- Interazioni: validazioni inline + Alert errore + loading state.

### 3) Onboarding
- Layout: wizard a step (progress + CTA). Obiettivo: portarti a creare/selezionare il primo pet.

### 4) Dashboard
- Layout: griglia 12 colonne: area principale (azioni rapide, tile funzioni) + colonna “Prossime azioni”.
- Componenti: Quick actions (log/task), cards stato pet, link rapidi a Planner/Salute/Records/Documenti/GPS.
- Animazioni: card hover, transizioni di lista, skeleton in loading.

### 5) Pagine “Funzione standard” (template)
Usata da: Planner, Agenda, Training, Prenotazioni, Spese, Notifiche, Vaccini, Terapie, Alimentazione, Benessere.
- Struttura: PageHeader → barra filtri/azioni → lista card → empty/error.
- Lista: card con CTA principali (Apri/Modifica/Segna completato/Elimina).

### 6) Profilo Pet
- Struttura: elenco pet + pannello dettagli; CTA “Crea pet”, “Seleziona attivo”.
- UX: evidenziare “pet attivo” sempre.

### 7) Cartella clinica + Records condivisi
- Struttura: timeline (eventi/log/documenti) + azioni share/export dove previsto.
- SharedRecords (/share/:token): pagina pubblica read-only, branding leggero, nessuna azione distruttiva.

### 8) Documenti
- Struttura: sezione upload → libreria con ricerca/filtri/sort → azioni bulk → modal edit metadati → modal backup.
- Animazioni: progress bar export ZIP, stati “busy” per riga.

### 9) AI (pagine dedicate)
- Pagine: AI Chat, AI Sintomi, AI Foto, AI Video, AI Riepilogo, AI Salvataggi.
- Struttura: disclaimer fisso in alto, area conversazione, quick prompts, gestione errori (key mancante/quota).

### 10) Mappe (GPS, Servizi vicini, Esplora)
- Layout: mappa a larghezza piena + pannello laterale (filtri/risultati).
- UX: pulsante “Apri mappa” e ritorno rapido; loading e fallback se permessi posizione negati.

### 11) Community / Adozioni / Marketplace
- Struttura: feed/lista card + filtri; CTA “Pubblica” (se prevista) in alto a destra.

### 12) Impostazioni / Console Pro / Moderazione / Diagnostica
- Impostazioni: sezioni in accordion, toggles e preferenze.
- Pro/Moderazione: tabelle/lista + filtri + azioni esplicite (con confirm).
- Diagnostica: solo DEV, accesso nascosto in produzione.
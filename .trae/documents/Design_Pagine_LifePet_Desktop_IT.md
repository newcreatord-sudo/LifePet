# Design Pagine (Desktop-first) — LifePet

## Stili globali
- **Layout**: griglia a 12 colonne (CSS Grid) con contenitore max-width 1200–1280px; spaziatura 8/16/24px; componenti interni in Flexbox.
- **Breakpoints**: desktop (≥1024) come baseline; tablet (768–1023) riduce sidebar a drawer; mobile (≤767) impila sezioni.
- **Colori**: background #0B1220; surface #111A2E; testo primario #E8EEF9; testo secondario #AAB6D3; accent #7C5CFC; success #2ECC71; warning #F39C12; danger #E74C3C.
- **Tipografia**: scala 14/16/20/24/32; font sans (es. Inter). Titoli semibold, body regular.
- **Bottoni**: Primary (accent) + hover darken 6%; Secondary (outline); Disabled 40% opacity.
- **Link**: accent, underline on hover. Transizioni 150–200ms (color, shadow, transform).

## 1) Pagina Accesso
**Meta**
- Title: “LifePet — Accedi”
- Description: “Accedi per gestire i tuoi animali, salute e promemoria.”
- OG: title/description coerenti + immagine brand.

**Struttura**
- Layout a due colonne: sinistra (branding + benefit), destra (card form 420–480px).

**Sezioni & Componenti**
- Header minimale (logo).
- Card “Accedi”
  - Input email, password, CTA “Accedi”.
  - Link “Crea account”, “Password dimenticata”.
  - Messaggi errore inline e stato loading.

## 2) Dashboard
**Meta**
- Title: “LifePet — Dashboard”
- Description: “Panoramica multi-animale e prossimi promemoria.”

**Struttura**
- App shell con **sidebar sinistra** (navigazione) + contenuto principale.
- Contenuto a sezioni impilate: selettore animali, cards riepilogo, lista promemoria.

**Sezioni & Componenti**
- Sidebar
  - Voci: Dashboard, Animali (apre scheda), AI, Impostazioni.
- Top bar
  - Selettore animale (dropdown con foto + nome) + “Aggiungi animale”.
- Sezione “Prossimi promemoria”
  - Lista ordinata per scadenza; badge tipo; azione “Segna completato”.
- Sezione “Ultimi eventi salute”
  - Timeline compatta per animale attivo (filtri rapidi: 7/30/90 giorni).

## 3) Scheda Animale (/pets/:petId)
**Meta**
- Title: “LifePet — {NomeAnimale}”
- Description: “Anagrafica, salute, promemoria e documenti.”

**Struttura**
- Header scheda con foto, nome, quick stats (età/peso/specie).
- Tab orizzontali: **Anagrafica**, **Salute**, **Promemoria**, **Documenti**.

**Sezioni & Componenti**
- Tab Anagrafica
  - Form campi base; CTA “Salva”; azione per eliminazione (con conferma).
- Tab Salute
  - CTA “Aggiungi evento” (modal con tipo, data, note, allegato opzionale).
  - Timeline/Tabella eventi con filtri per tipo.
- Tab Promemoria
  - CTA “Nuovo promemoria” (data/ora, ricorrenza, note).
  - Lista con checkbox done e azioni edit/delete.
- Tab Documenti
  - Upload drag&drop (PDF/JPG/PNG); lista file con download/preview.

## 4) Assistente AI (informativo)
**Meta**
- Title: “LifePet — Assistente AI”
- Description: “Informazioni generali basate sui dati inseriti.”

**Struttura**
- Layout chat: colonna sinistra (contesto: selezione animale), destra (thread).

**Sezioni & Componenti**
- Banner disclaimer (sempre visibile, sticky)
  - Testo: “Risposte informative, non consulenza veterinaria. In caso di urgenza contatta un veterinario.”
- Thread messaggi + input multilinea.
- Pulsanti rapidi: “Riassumi ultimi 30 giorni”, “Promemoria attivi”, “Eventi recenti”.
- Stato: loading, errore rete, rate-limit (messaggio chiaro).

## 5) Impostazioni
**Meta**
- Title: “LifePet — Impostazioni”
- Description: “Privacy e gestione dati.”

**Struttura**
- Pannelli a card: Profilo, Privacy, Dati.

**Sezioni & Componenti**
- Profilo: email, logout.
- Privacy: consensi (es. uso dati per AI: on/off, solo per riepiloghi).
- Dati: export (download) e cancellazione account (flow a 2 step con conferma).

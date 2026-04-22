# Design Pagine (Desktop-first) — Immagini reali + contenuti completi

## Global Styles
- Layout: container desktop max-width 1200px, grid 12 colonne; gap 16–24px; padding pagina 24–32px.
- Tipografia: base 16px; H1 28–32px, H2 22–24px, body 14–16px.
- Colori: sfondo #F7FAFF; testo #0F172A; card #FFFFFF; bordi #E2E8F0; accent primario coerente con tema app.
- Stati:
  - Skeleton: blocchi grigi (opacity 10–15%) con shimmer leggero.
  - Empty state: illustrazione/icone + titolo + 1–2 righe + CTA primaria.
  - Error state: alert inline + dettaglio breve + pulsante “Riprova”.
- Media: immagini con border-radius 12px; object-fit definito per contesto (griglia=cover, dettaglio=contain).

---

## Pagina: Home/Dashboard
### Meta Information
- Title: "LifePet — Dashboard"
- Description: "Panoramica rapida e accesso alle funzionalità."
- Open Graph: titolo/descrizione come sopra; immagine OG brand.

### Page Structure
- Struttura a sezioni verticali: Header (sticky) + Hero + Quick actions + Sezioni a card.

### Sections & Components
1. Top bar
   - Logo/nome, selettore contesto (se esiste), icona notifiche.
2. Hero
   - Titolo + microcopy (1 riga) + CTA primaria verso azione più frequente.
3. Quick actions (row)
   - 3–5 pulsanti/tiles con icona e label.
4. Card grid “Sezioni principali”
   - Card con: mini-immagine reale (thumbnail), titolo, descrizione breve, stato (badge).
   - Loading: skeleton card; Error: card con retry; Empty: card con “come iniziare”.

---

## Pagina: Galleria Immagini
### Meta Information
- Title: "LifePet — Galleria"
- Description: "Sfoglia le immagini in modo rapido e chiaro."

### Layout
- CSS Grid responsivo: desktop 4 colonne (min 240px), con auto-fill; gap 16px.

### Sections & Components
1. Header pagina
   - Titolo + contatore elementi (se disponibile) + filtro minimo (es. "Tutte").
2. Griglia immagini
   - Card immagine: thumbnail, overlay hover (zoom leggero), titolo breve.
   - Lazy-load + placeholder blur (facoltativo) + gestione errore immagine (fallback).
3. Dettaglio immagine (modal o pagina)
   - Immagine grande (contain), metadati essenziali a lato (o sotto), azioni minime.

---

## Pagina: Template “Contenuto Completo” (per sostituire pagine bianche)
### Meta Information
- Title: "LifePet — {Nome Sezione}"
- Description: "Contenuti guidati e azioni utili per questa sezione."

### Page Structure
- Header pagina + 2 colonne (contenuto principale / sidebar) su desktop.

### Sections & Components
1. Page header
   - Titolo + descrizione (1–2 righe) + CTA primaria.
2. Blocchi contenuto (main column)
   - Card “Cosa puoi fare qui” (3–5 bullet).
   - Card “Passi rapidi” (stepper 1–3).
   - Card “Esempio” con contenuto placeholder utile (testo), visibile quando non ci sono dati.
3. Sidebar
   - Card “Suggerimenti” + Card “Problemi comuni” (FAQ 3 item) + link “Segnala un problema”.
4. Stati obbligatori
   - Loading/Empty/Error sempre progettati; mai render vuoto.

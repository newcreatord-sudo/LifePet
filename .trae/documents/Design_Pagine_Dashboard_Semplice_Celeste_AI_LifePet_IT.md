# Design pagine (Desktop-first) — Dashboard semplice, celeste, animazioni coerenti, IA ovunque

## Global Styles
**Design tokens**
- Background: #F7FAFF; Surface: #FFFFFF; Border: #D7E2F2
- Primary (celeste): #009DFF; Hover: #008AE0; Pressed: #0077C2
- Text: #0B1220 / #4A5872; Success: #19B36B; Warning: #F5A524; Error: #E5484D

**Layout**
- Desktop-first: grid 12 colonne, max-width 1200px, gutter 24px, padding 24–32px.
- Struttura app: Topbar (64px) + Sidebar (240px, collassabile) + Content.

**Motion (coerenza)**
- Durate standard: 160ms (hover/press), 200ms (drawer/modali), easing: ease-out.
- Transizioni consentite: fade + slide leggero; pressed scale 0.99; shadow sm su hover.
- Accessibilità: con `prefers-reduced-motion` disattivare transizioni decorative.

**Componenti globali**
- Toast/snackbar (desktop: alto-destra), con “Riprova” quando sensato.
- Skeleton per liste/card; empty state con illustrazione + CTA.
- **AI Drawer globale**: pannello laterale (dx, 420px) apribile da ogni pagina; mostra sempre disclaimer.

---

## Pagina: Dashboard
### Meta Information
- Title: “Dashboard — LifePet”; Description: “Panoramica semplice e azioni rapide.”

### Page Structure
1. Header pagina: titolo + 0–2 azioni (es. “Aggiungi” in menu).
2. Card “Pet attivo” (hero): foto, badge stato (salute/agenda), prossima scadenza.
3. Sezione “Prossime azioni” (max 5): lista compatta con CTA unica per riga.
4. Griglia “Funzioni principali” (3–6 card): immagine 16:9, titolo, micro-descrizione, CTA “Apri”.
5. Sezioni secondarie (collassabili): trend, ultimi eventi, scorciatoie.

### Interazioni
- Nessun pet: empty state persistente + CTA “Crea pet” (porta al form) + disabilitazioni sempre spiegate.
- Entry IA: pulsante in topbar + suggerimenti contestuali (“Riepiloga”, “Suggerisci”).

---

## Pagina: Scheda Pet (hub)
### Meta Information
- Title dinamico: “{NomePet} — LifePet”; OG con foto pet.

### Page Structure
- Header: foto + tab (Anagrafica, Salute, Agenda, Alimentazione, Training, Documenti).
- Colonna principale (8): contenuti tab.
- Colonna laterale (4): card “Azioni rapide” + mini-riepilogo + entry IA.

### IA contestuale
- Tab Salute: “Riassumi ultimi 30 giorni”, “Spiega un referto (informativo)”.
- Tab Agenda: “Proponi piano promemoria” (senza creare automaticamente, conferma utente).
- Tab Alimentazione: “Stima porzioni” (informativo) + chiarimenti su log.

---

## Pagina: Esplora (Community + Marketplace)
### Page Structure
- Tabs: Community / Marketplace.
- Community: feed a card (testo+media), commenti, gruppi/chat, segnalazioni.
- Marketplace: griglia annunci, filtri laterali, dettaglio annuncio con CTA contatto.
- IA: supporto scrittura post/annuncio (bozza) + suggerimenti titolo/descrizione (sempre modificabili).

---

## Pagina: GPS & Sicurezza
### Page Structure
- Mappa (8) + pannello (4) con: stato GPS, geofence, storico, alert.
- IA: spiegazione alert e suggerimenti di sicurezza (non critici), mai automatismi senza conferma.

---

## Pagina: Spese
### Page Structure
- KPI (mese), lista spese, form rapido, grafico trend.
- IA: categorizzazione suggerita + riepilogo budget (con conferma prima del salvataggio).

---

## Pagina: Impostazioni
### Page Structure
- Sezioni: Account, Privacy/Consensi, Notifiche, Dati (export/cancellazione), Preferenze IA.
- IA: toggle globale + finestra contesto (N giorni) + note sul disclaimer.

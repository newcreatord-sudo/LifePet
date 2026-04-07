# Design Pagine — LifePet (mobile)

## Global Styles
- Layout: mobile-first; Flexbox + safe-area; spacing 8/16/24.
- Colori: background #0B1220; surface #111A2E; primary #5EEAD4; accent #A78BFA; danger #FB7185.
- Tipografia: 12/14/16 body; 20/24/28 headings; numeri KPI monospaced opz.
- Componenti: card con radius 16; button primary pieno, secondary outline; input con label + helper.
- Stati: loading skeleton su liste; empty states con CTA; error toast.

## Meta Information (app)
- Titoli schermata = header; deep link per /pets/:petId, /health/:petId, /gps/:petId.

## 1) Accesso (Login/Registrazione)
- Struttura: logo + form in card; CTA social.
- Componenti: email, password, toggle login/register, “Password dimenticata”.

## 2) Home (Dashboard)
- Page structure: header con selettore animale (pill) + avatar profilo; contenuto a sezioni.
- Sezioni:
  - Riepilogo salute (2–3 KPI + alert prossime scadenze).
  - Prossimi eventi agenda (lista compatta).
  - Spese mese (totale + progress bar budget).
  - Quick actions: “Aggiungi evento salute”, “Nuovo promemoria”, “Apri mappa”, “Chiedi all’AI”.

## 3) Profilo Animale
- Layout: hero foto + nome; tabs (Info, Documenti).
- Info: specie/razza/nascita/peso; tag/ID.
- Documenti: lista file (upload/download) con Storage.

## 4) Salute & Longevità
- Layout: tab “Timeline” + tab “Insight”.
- Timeline: filtri (vaccini, farmaci, visite); FAB “Aggiungi evento”.
- Insight: trend (peso/aderenza); card “Longevità” con disclaimer e suggerimenti generali.

## 5) Agenda
- Layout: calendario (mese/settimana) + lista eventi giorno.
- Componenti: editor evento (titolo, data/ora, ricorrenza, animale, notifica).

## 6) GPS & Sicurezza
- Layout: mappa full-screen + bottom sheet.
- Bottom sheet: toggle tracking; ultimo fix; aree sicure (lista + aggiungi).
- Stati: permessi location, batteria, “tracking off”.

## 7) Community
- Layout: feed a card; composer in alto.
- Componenti: post (foto/testo), like/commenta, menu “segnala”.

## 8) Marketplace
- Layout: search + filtri; griglia card.
- Dettaglio annuncio: gallery, prezzo, descrizione, CTA contatta.
- Pubblica annuncio: form + upload immagini.

## 9) Spese
- Layout: header KPI (mese) + tabs “Movimenti” / “Categorie”.
- Movimenti: lista; aggiunta spesa rapida (importo, categoria, animale, data).

## 10) Assistente AI
- Layout: chat; suggerimenti prompt; pill “Usa contesto ultimo 30gg”.
- Output: risposta + sez. “Da dove ho preso i dati” (fonti interne) + disclaimer non medico.

## 11) Impostazioni
- Sezioni: account, notifiche, privacy/consensi (GPS/community), esporta dati, elimina account.
- Interazioni: conferme distruttive con dialog e re-auth.
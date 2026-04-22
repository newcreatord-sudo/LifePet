# Page Design — LifePet (desktop-first)

## Global Styles (design tokens)
- Layout: container max-width 1200px, grid 12 colonne, gutter 24px; sezioni verticali con spacing 24–40px.
- Typography: base 16px; scale 12/14/16/20/24/32; font sans (es. Inter/system).
- Colori: background #0B1220 (dark) o #FFFFFF (light); text primario #111827 / #F9FAFB; accent #4F46E5; success #10B981; danger #EF4444.
- Componenti: bottoni (primary/secondary/ghost) con hover/active; link underline on hover; card con border radius 12px e shadow soft.
- I18n: tutte le stringhe via dizionario; contenuti dinamici (date/ora) formattati secondo locale selezionato.

## Layout comune (tutte le pagine)
- Header fisso (desktop): logo a sinistra, nav centrale (Home, Community, Agenda, Salvataggi AI, Impostazioni), area utente a destra (avatar + menu logout).
- Main: contenuto a larghezza controllata; breadcrumb opzionale su pagine interne.
- Stati UI: skeleton per liste, empty state con CTA, error state con retry.

---

## 1) Pagina Accesso (/login)
### Meta Information
- Title: “Accedi — LifePet”
- Description: “Accedi per usare community, agenda e funzionalità AI.”

### Page Structure
- Layout a due colonne: sinistra (benefit sintetici), destra (card form).

### Sections & Components
- Card Login/Registrazione: email, password (o magic link se previsto), CTA primaria, link a “hai già un account?” / “crea account”.
- Messaggi: errori validazione inline; toast su successo.

---

## 2) Home (/)
### Meta Information
- Title: “Home — LifePet”
- Description: “Panoramica rapida di community e agenda.”

### Page Structure
- Sezione hero compatta + griglia 2 colonne: “Community” e “Agenda”.

### Sections & Components
- Hero: titolo, sottotitolo breve, CTA “Crea promemoria” e “Crea post”.
- Card “Ultimi post”: lista 5 elementi (titolo, autore, data), link “Vedi tutti”.
- Card “Prossimi promemoria”: lista 5 (titolo, data/ora), link “Apri calendario”.

---

## 3) Community (/community)
### Meta Information
- Title: “Community — LifePet”
- Description: “Leggi e pubblica contenuti nella community.”

### Page Structure
- Colonna principale (feed) + sidebar (creazione post / linee guida) su desktop.

### Sections & Components
- Composer “Crea post”: input titolo + textarea corpo + CTA Pubblica; stato disabled se non autenticato.
- Feed: card post con titolo, estratto, autore, data; click apre dettaglio.
- Filtri minimi: ordinamento (Recenti).

## 3.1) Dettaglio Post (/community/:postId)
- Header post: titolo, autore, timestamp.
- Corpo: testo completo.
- Commenti: lista + form aggiunta commento; empty state se nessun commento.

---

## 4) Agenda (/agenda)
### Meta Information
- Title: “Agenda — LifePet”
- Description: “Calendario e promemoria con assistenza AI.”

### Page Structure
- Layout 2 colonne: sinistra calendario; destra pannello giorno selezionato.

### Sections & Components
- Calendario: vista mese (default) con controlli mese precedente/successivo; indicatori su giorni con promemoria.
- Pannello giorno: lista promemoria del giorno selezionato; CTA “Nuovo promemoria”.
- Drawer/Modal “Promemoria”: titolo, descrizione, data/ora, remind_at; CTA Salva/Elimina.
- Box “Crea con AI”: campo testo (richiesta), CTA “Genera”; anteprima proposta; CTA “Conferma e salva”.
- Stati: durante generazione mostra progress; su errore mostra retry.

---

## 5) Salvataggi AI (/ai-saves)
### Meta Information
- Title: “Salvataggi AI — LifePet”
- Description: “Storico affidabile degli output AI.”

### Page Structure
- Tabella/lista a tutta larghezza + pannello dettaglio (split view) su desktop.

### Sections & Components
- Filtri: stato (Riuscito/Fallito).
- Lista: righe con tipo, data, stato badge, azione “Apri”.
- Dettaglio: prompt, risultato (monospace/blockquote), azioni “Copia”, “Ritenta salvataggio” (solo se fallito), “Usa per creare promemoria” (se pertinente).

---

## 6) Impostazioni (/settings)
### Meta Information
- Title: “Impostazioni — LifePet”
- Description: “Preferenze e lingua.”

### Page Structure
- Card settings a sezione singola (essenziale).

### Sections & Components
- Selettore lingua: dropdown (Italiano default + altre); testo helper “applica subito”; CTA Salva.
- Conferma: toast “Lingua aggiornata”.

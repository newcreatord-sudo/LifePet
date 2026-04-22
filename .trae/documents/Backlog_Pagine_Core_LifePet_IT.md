# LifePet — Backlog pagina-per-pagina (CORE)

> Scope: Dashboard, Salute, Planner, Records, Documenti, Settings. Desktop-first.

## Convenzioni
- Priorità: **P0** (MVP), **P1** (subito dopo).
- Breakpoint: desktop 1280+, tablet 768–1279, mobile <768 (stack verticale).
- Animazioni: 150–220ms, easing `cubic-bezier(.2,.8,.2,1)`, ridotte con `prefers-reduced-motion`.

---

## 1) Dashboard
**Obiettivo:** vista “oggi” con stato pet, azioni rapide, alert.
**Layout:** grid 12 colonne; colonna sinistra 8 (cards principali), destra 4 (alert/quick actions).
**Animazioni:** skeleton on-load; hover-lift card (translateY -2); micro-progress animato.

**Backlog**
- **P0 | Header + switch pet**: selezione pet, avatar, stato (online/ultimo update).
  - AC: cambiando pet, tutte le card aggiornano entro 300ms senza refresh pagina.
- **P0 | Card Salute sintetica**: ultimi valori/nota + CTA “Apri Salute”.
  - AC: se dati assenti, mostra empty-state con CTA “Aggiungi prima misura”.
- **P0 | Card Planner Oggi**: prossimi 3 eventi + CTA “Aggiungi evento”.
  - AC: eventi passati appaiono “muted” e non cliccabili per modifica rapida.
- **P0 | Alert/Notifiche**: lista max 5 con severità (info/warn/crit).
  - AC: click su alert porta alla pagina target con anchor/sezione evidenziata.
- **P1 | Insight settimanale**: mini chart (sparklines) per peso/attività.
  - AC: tooltip su hover con valore e data; keyboard focus equivalente.

---

## 2) Salute
**Obiettivo:** monitorare metriche, note, trend.
**Layout:** split 7/5: sinistra timeline+form, destra grafico+filtri.
**Animazioni:** transizione filtro (fade+slide 10px); grafico “draw-in” (solo first render).

**Backlog**
- **P0 | Selettore metrica**: peso, alimentazione, farmaci, sintomi (configurabile).
  - AC: selezione metrica aggiorna form e grafico senza perdere il pet selezionato.
- **P0 | Inserimento misura**: form con data/ora, valore, note, allegato opzionale.
  - AC: submit valida required; errori inline; success toast e item in cima timeline.
- **P0 | Timeline eventi**: lista cronologica con edit/delete.
  - AC: delete richiede conferma; undo disponibile per 5s.
- **P1 | Trend**: grafico lineare con range 7/30/90 giorni.
  - AC: cambiando range, loading state non blocca tutta la pagina (solo grafico).

---

## 3) Planner
**Obiettivo:** pianificare cure, visite, routine.
**Layout:** vista calendario (settimana) + pannello destro dettaglio evento.
**Animazioni:** drag ghost (se abilitato); apertura pannello dettaglio (slide-in).

**Backlog**
- **P0 | Lista/Calendario**: toggle “Agenda” / “Settimana”.
  - AC: il toggle conserva filtro pet e range date.
- **P0 | Crea/Modifica evento**: tipo (visita, farmaco, attività), ricorrenza semplice.
  - AC: evento ricorrente crea occorrenze future visibili; modifica “questa vs tutte” (se supportato) altrimenti chiarire che modifica è globale.
- **P0 | Reminder**: flag promemoria e lead time (es. 30 min).
  - AC: se reminder attivo, evento mostra icona; disattivando, icona sparisce immediatamente.
- **P1 | Drag & drop**: spostare evento nella settimana.
  - AC: spostamento aggiorna data/ora e persiste; annullamento ESC ripristina.

---

## 4) Records
**Obiettivo:** archivio storico consultabile (visite, vaccini, interventi, note).
**Layout:** tabella/card list con filtri a sinistra (sidebar 280px).
**Animazioni:** espansione riga per dettagli (accordion); highlight dei match ricerca.

**Backlog**
- **P0 | Filtri + ricerca**: tipo record, intervallo date, testo.
  - AC: ricerca con debounce ~300ms; mostra conteggio risultati.
- **P0 | Dettaglio record**: pannello modale/drawer con metadati e allegati.
  - AC: aprendo un record, URL riflette lo stato (deep-link) oppure mantiene stato in-app in modo consistente.
- **P0 | CRUD**: crea, modifica, elimina record.
  - AC: permessi: solo owner del pet può modificare/eliminare; altri solo read.
- **P1 | Export**: download PDF/CSV (se previsto).
  - AC: export rispetta filtri correnti e include timestamp di generazione.

---

## 5) Documenti
**Obiettivo:** gestire documenti (referti, fatture, prescrizioni) per pet.
**Layout:** griglia card 3–4 colonne + toolbar (upload, filtro, sort).
**Animazioni:** upload progress; drag-over state (border pulsing leggero).

**Backlog**
- **P0 | Upload**: file picker + drag&drop, tag (tipo), data documento.
  - AC: accetta solo formati consentiti; blocca > dimensione max; mostra progress e stato “completato”.
- **P0 | Lista + preview**: card con thumbnail (se immagine) o icon; preview in modal.
  - AC: preview supporta zoom base; per PDF mostra almeno prima pagina o fallback download.
- **P0 | Organizzazione**: filtri per tipo/data + ricerca.
  - AC: filtrando, URL conserva query (opzionale) o stato ripristinabile al back.
- **P1 | OCR/estrazione** (solo se previsto): estrai testo e campi.
  - AC: mostra indicatore “analisi in corso”; risultato editabile manualmente.

---

## 6) Settings
**Obiettivo:** preferenze account, pet, privacy, notifiche.
**Layout:** sidebar sezione (Account/Pet/Notifiche/Privacy) + content panel.
**Animazioni:** transizione sezione (cross-fade); switch toggles con micro-feedback.

**Backlog**
- **P0 | Profilo utente**: nome, email (read-only se gestita da auth), lingua.
  - AC: save disabilitato finché non ci sono cambi; errori mostrati campo-per-campo.
- **P0 | Gestione pet**: crea/modifica pet, foto, dati base.
  - AC: creando pet, compare subito nello switch globale e diventa selezionabile.
- **P0 | Notifiche**: toggle categorie (reminder planner, alert salute).
  - AC: disattivando categoria, nessun badge/alert relativo appare in dashboard.
- **P0 | Privacy**: visibilità dati per community (se esiste) + export/cancellazione.
  - AC: cambi privacy applica immediatamente alle sezioni community; conferma richiesta.
- **P1 | Tema**: light/dark.
  - AC: preferenza persiste e rispetta sistema se “auto”.

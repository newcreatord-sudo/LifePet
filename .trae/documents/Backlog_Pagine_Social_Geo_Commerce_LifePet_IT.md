# LifePet — Backlog pagina-per-pagina (GEO / SOCIAL / COMMERCE)

> Scope: GPS/Nearby, Community, Marketplace. Desktop-first.

## Convenzioni
- Priorità: **P0** (MVP), **P1** (subito dopo).
- Breakpoint: desktop 1280+ con 2–3 colonne; mobile stack.
- Animazioni: 150–220ms; evitare animazioni continue su mappe.

---

## 1) GPS / Nearby
**Obiettivo:** vedere luoghi utili vicini (vet, pet shop, aree cani) e navigare.
**Layout:** split view 7/5: mappa a sinistra, lista risultati a destra (sticky filtri in alto).
**Animazioni:** pin drop (soft scale-in); apertura scheda luogo (bottom/right drawer).

**Backlog**
- **P0 | Permission + stato GPS**: richiesta consenso, stati (granted/denied/unavailable).
  - AC: se denied, mostra CTA “Abilita in impostazioni” + modalità ricerca manuale città.
- **P0 | Mappa + risultati**: mostra pin e lista con distanza.
  - AC: selezionando un item in lista, pin corrispondente evidenziato e mappa centra.
- **P0 | Filtri**: categorie e raggio (es. 1–20 km).
  - AC: cambi filtro aggiorna lista e pin; mantiene selezione se ancora presente.
- **P0 | Dettaglio luogo**: nome, indirizzo, orari (se disponibili), azioni “Apri navigazione/Chiama”.
  - AC: click “Apri navigazione” apre provider esterno con coordinate corrette.
- **P1 | Preferiti**: salva/rimuovi luogo.
  - AC: preferiti persistono e sono visibili in una sezione dedicata nella lista.

---

## 2) Community
**Obiettivo:** feed e interazioni base tra utenti (post legati al pet).
**Layout:** feed centrale (max-width 760px) + colonna destra (trend/regole) su desktop.
**Animazioni:** like (scale 1.05), inserimento nuovo post (slide-down), skeleton feed.

**Backlog**
- **P0 | Feed**: lista post con autore, pet (opzionale), testo, media.
  - AC: scrolling mantiene performance (virtualizzazione opzionale); loading incrementale.
- **P0 | Crea post**: composer con testo + upload 1–N media.
  - AC: validazione: testo o media richiesti; al publish appare in cima al feed.
- **P0 | Interazioni**: like + commenti (thread 1 livello).
  - AC: like è ottimistico con rollback su errore; commento appare senza refresh.
- **P0 | Moderazione base**: segnala post/commento.
  - AC: invio segnalazione mostra conferma e disabilita doppio invio.
- **P1 | Profili pubblici**: pagina profilo con post e info pet condivise.
  - AC: rispetta impostazioni privacy; campi non condivisi non compaiono mai.

---

## 3) Marketplace
**Obiettivo:** esplorare e contattare venditori/servizi (MVP: browsing + contatto).
**Layout:** toolbar filtri + griglia card prodotti/servizi (3–4 colonne desktop) + dettaglio in pagina.
**Animazioni:** hover card (shadow+lift), transizione filtri (height+fade), carousel immagini nel dettaglio.

**Backlog**
- **P0 | Catalogo**: lista card con titolo, prezzo (se presente), categoria, località.
  - AC: paginazione o infinite scroll; stato vuoto se nessun risultato.
- **P0 | Filtri/Sort**: categoria, prezzo, distanza (se GPS), “più recenti”.
  - AC: reset filtri ripristina risultati predefiniti e scroll top.
- **P0 | Dettaglio annuncio**: immagini, descrizione, disponibilità, contatto.
  - AC: CTA “Contatta” apre canale definito (form interno o mailto) e precompila oggetto.
- **P0 | Pubblica annuncio (solo se previsto)**: form titolo, categoria, descrizione, media.
  - AC: bozza salvata localmente fino a publish; publish mostra in catalogo entro 5s.
- **P1 | Preferiti + storico viste**.
  - AC: preferiti persistono; vista recente mostra ultimi 20 con timestamp.

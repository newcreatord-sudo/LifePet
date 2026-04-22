export const uxCopy = {
  common: {
    cta: {
      createPet: "Crea pet",
      openPetProfile: "Apri profilo pet",
      uploadShort: "Carica",
      uploadDocument: "Carica documento",
      openAgenda: "Apri agenda",
      openPlanner: "Apri routine",
    },
    empty: {
      selectPetTitle: "Seleziona un pet",
      selectPetDescription: "Scegli un profilo per continuare.",
    },
    loading: {
      loading: "Carico…",
      preparingLink: "Sto preparando il link…",
      syncing: "Sto sincronizzando…",
    },
    error: {
      generic: "Non riesco a completare l’operazione ora. Riprova tra poco.",
      offline: "Sei offline. Alcune funzioni si aggiorneranno quando torni online.",
    },
  },
  dashboard: {
    headerTitle: "Dashboard",
    noPetHeaderDescription: "Crea il tuo primo animale per vedere tutto subito.",
    noPetTitle: "Inizia in 60 secondi",
    noPetDescription: "Nome, specie e foto. Poi aggiungi un documento e un promemoria.",
    emptyEventsTitle: "Nessun evento in programma",
    emptyEventsDescription: "Aggiungi una visita, un richiamo o un promemoria ricorrente.",
    emptyDocsTitle: "Non hai ancora documenti",
    emptyDocsDescription: "Inizia dai documenti essenziali: così hai tutto pronto quando serve davvero.",
  },
  documents: {
    headerTitle: "Documenti",
    headerDescription: "Carica, apri e gestisci referti, ricette e allegati.",
    emptyLibraryTitle: "Nessun documento",
    emptyLibraryDescription: "Inizia dai documenti essenziali: così hai tutto pronto in caso di emergenza o smarrimento.",
    emptyResultsTitle: "Nessun risultato",
    emptyResultsDescription: "Prova a cambiare filtri o cerca con un altro testo.",
    uploadCardTitle: "Caricamento",
    uploadCardDescription: "PDF e immagini fino a 10MB.",
    uploadCardHintTitle: "Carica in archivio",
    uploadCardHintDescription: "Aggiungi titolo, tipo e data per ritrovare subito i documenti.",
    uploadCardTip: "Suggerimento: salva referti/ricette con data documento e un titolo breve.",
    libraryTitle: "Libreria",
    libraryDescription: "Archivio documenti del pet attivo.",
    selectPetUploadDescription: "Scegli un profilo per caricare documenti.",
    selectPetLibraryDescription: "Scegli un profilo per vedere i documenti.",
  },
  protection: {
    headerTitle: "Protezione",
    headerDescription: "Scheda pubblica, QR e modalità smarrito: tutto pronto quando serve davvero.",
    selectPetTitle: "Seleziona un pet",
    selectPetDescription: "Scegli un profilo per gestire protezione smarrimento e QR.",
    trustTitle: "Pronto in emergenza",
    trustBody:
      "Attiva la protezione solo una volta: quando serve, hai link/QR pronti e una pagina pubblica con informazioni essenziali.",
  },
} as const;


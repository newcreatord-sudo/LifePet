export type AiPolicyMode = "general" | "symptoms" | "media";

export const aiPolicy = {
  title: "Informativo",
  byline: "AI utile e credibile: sintesi, organizzazione e prossimi passi pratici.",
  common: {
    disclaimer:
      "Le risposte sono informative e non sostituiscono il veterinario. In caso di urgenza contatta un professionista.",
    emergency:
      "Se pensi sia un’emergenza (respirazione difficile, convulsioni, sanguinamento importante, ingestione sostanze tossiche), contatta subito un veterinario o una clinica.",
  },
  modes: {
    general: {
      label: "Informativo",
      message: "Usa l’AI per organizzare informazioni, preparare una visita e ridurre dimenticanze.",
    },
    symptoms: {
      label: "Checklist",
      message: "Checklist e domande utili per capire urgenza e prossimi passi, senza diagnosi.",
    },
    media: {
      label: "Osservazioni",
      message: "Osservazioni su foto/video e suggerimenti di monitoraggio, senza diagnosi.",
    },
  },
} as const;


## 1.Architecture design

### MVP (senza AI)
```mermaid
graph TD
  A["User Browser"] --> B["React Frontend Application"]
  B --> C["Firebase Web SDK"]
  C --> D["Firebase Auth"]
  C --> E["Cloud Firestore"]
  C --> F["Firebase Storage"]
  C --> G["Cloud Functions (HTTPS/Callable)"]

  subgraph "Frontend Layer"
    B
  end

  subgraph "Service Layer (Firebase)"
    D
    E
    F
    G
  end
```

### Fase 2 (Assistente AI informativo)
Nota: la Function funge da **proxy** (API key server-side) e può includere rate-limit e logging minimo.
```mermaid
graph TD
  A["User Browser"] --> B["React Frontend Application"]
  B --> C["Firebase Web SDK"]
  C --> D["Firebase Auth"]
  C --> E["Cloud Firestore"]
  C --> F["Firebase Storage"]
  B --> G["Cloud Functions (AI Proxy)"]
  G --> H["LLM API Service"]

  subgraph "Frontend Layer"
    B
  end

  subgraph "Service Layer (Firebase)"
    D
    E
    F
    G
  end

  subgraph "External Services"
    H
  end
```

## 2.Technology Description
- Frontend: React@18 + TypeScript + vite + tailwindcss@3
- Backend/Services: Firebase (Auth, Firestore, Storage, Cloud Functions)
- AI (Fase 2): Cloud Functions come proxy verso provider LLM (API key **solo server-side**)

## 3.Route definitions
| Route | Purpose |
|-------|---------|
| /login | Login / registrazione / recupero password |
| /app/dashboard | Selettore multi-animale e panoramica |
| /app/pets | Scheda animale avanzata (anagrafica, salute, documenti, contatti vet) |
| /app/records | Cartella clinica + condivisione |
| /app/agenda | Agenda + export ICS |
| /app/expenses | Spese + ricorrenti |
| /app/community | Feed + gruppi |
| /app/moderation | Moderazione (solo moderatori) |
| /app/settings | Preferenze/AI/privacy |

## 4.API definitions (If it includes backend services)
L’MVP usa Firebase SDK direttamente per Auth/DB/Storage. Le Cloud Functions esistono per:
- Billing (Stripe)
- AI proxy
- Sweep schedulati (promemoria, indici salute, retention, ecc.)
- Link condivisi allegati (URL firmati)

### 4.1 (Fase 2) Cloud Function: AI informativa
```
callable aiChat (Firebase Functions)
```
TypeScript (condivise)
```ts
type AiChatRequest = {
  petId: string;
  message: string;
  contextWindowDays?: number; // default 30
};

type AiChatResponse = {
  answer: string;
  disclaimer: string; // sempre valorizzato
};
```
Note funzionali:
- La funzione **non** fornisce diagnosi o indicazioni terapeutiche; restituisce solo informazioni generali + disclaimer.
- La funzione agisce da **proxy** verso LLM (API key server-side); il contesto può essere passato dal client.
- Opzionale: log minimale (userId, petId, timestamp) per audit/abuso.

## 5.Server architecture diagram (If it includes backend services)
(Fase 2)
```mermaid
graph TD
  A["React Frontend"] --> B["Edge Function Endpoint"]
  B --> C["Service: Prompt Builder"]
  C --> D["LLM Client"]
  D --> E["LLM API"]

  subgraph "Cloud Functions"
    B
    C
    D
  end
```

## 6.Data model(if applicable)

### 6.1 Data model definition
```mermaid
erDiagram
  USERS ||--o{ PETS : owns
  PETS ||--o{ LOGS : has
  PETS ||--o{ TASKS : schedules
  PETS ||--o{ DOCUMENTS : stores
  PETS ||--o{ NOTIFICATIONS : alerts

  PETS {
    uuid id
    uuid owner_id
    text name
    text species
    text breed
    date birth_date
    numeric weight_kg
    timestamptz created_at
  }
  HEALTH_EVENTS {
    uuid id
    uuid owner_id
    uuid pet_id
    text type
    date event_date
    text notes
    timestamptz created_at
  }
  REMINDERS {
    uuid id
    uuid owner_id
    uuid pet_id
    text title
    timestamptz due_at
    text recurrence_rule
    boolean done
    timestamptz created_at
  }
  PET_FILES {
    uuid id
    uuid owner_id
    uuid pet_id
    text file_path
    text file_type
    timestamptz created_at
  }
```

### 6.2 Note modello dati
I dati sono in Cloud Firestore con collezioni principali:
- `pets/{petId}`
- `pets/{petId}/logs` (food/water/activity/weight/symptom/vet)
- `pets/{petId}/tasks` (promemoria/routine)
- `pets/{petId}/documents`
- `pets/{petId}/notifications`
- `recordShares/{shareId}` (condivisione cartella clinica)
- `posts/{postId}` + `posts/{postId}/comments` (community)
- `groups/{groupId}` + `groups/{groupId}/messages` (community chat)

Le regole Firestore isolano i dati per proprietario e gestiscono moderazione via `moderators/{uid}` e `bans/{uid}`.

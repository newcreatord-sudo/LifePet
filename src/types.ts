export type PetId = string;

export type Pet = {
  id: PetId;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  dob?: string;
  photoPath?: string;
  weightKg?: number;
  sex?: "male" | "female" | "unknown";
  neutered?: boolean;
  activityLevel?: "low" | "medium" | "high";
  bodyConditionScore?: number;
  heightCm?: number;
  temperamentTags?: string[];
  walkBadge?: "green" | "yellow" | "red";
  walkVisible?: boolean;
  currentFood?: {
    label?: string;
    kcalPerG?: number;
    notes?: string;
  };
  healthProfile?: {
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
  };
  vetContact?: {
    clinicName?: string;
    phone?: string;
    address?: string;
    emergencyPhone?: string;
  };
  microchipId?: string;
  petProtection?: {
    enabled: boolean;
    publicId: string;
    activatedAt: number;
  };
  identification?: {
    passportId?: string;
    registry?: string;
  };
  dietNotes?: string;
  budgetMonthly?: number;
  budgetCurrency?: string;
  geofence?: {
    enabled: boolean;
    centerLat: number;
    centerLng: number;
    radiusM: number;
  };
  gpsIngestToken?: string;
  deviceIngestToken?: string;
  createdAt: number;
};

export type PetCard = {
  publicId: string;
  petId: PetId;
  ownerId: string;
  petName: string;
  species: string;
  photoPath?: string;
  publicNote?: string;
  isLost?: boolean;
  activatedAt: number;
  updatedAt?: number;
};

export type FinderReportType = "found" | "sighted";

export type FinderReportStatus = "new" | "verified" | "spam" | "resolved";

export type FinderReport = {
  id: string;
  petId: PetId;
  publicId: string;
  reportType: FinderReportType;
  reporterContactOptional?: string;
  locationTextOptional?: string;
  noteOptional?: string;
  status?: FinderReportStatus;
  handledBy?: string;
  handledAt?: number;
  updatedAt?: number;
  createdAt: number;
};

export type SafetyEventType =
  | "lost_enabled"
  | "lost_resolved"
  | "protection_enabled"
  | "finder_report_received"
  | "finder_report_verified"
  | "finder_report_spam"
  | "finder_report_resolved";

export type SafetyEvent = {
  id: string;
  petId: PetId;
  type: SafetyEventType;
  createdAt: number;
  createdBy?: string;
  related?: {
    publicId?: string;
    reportId?: string;
    reportType?: FinderReportType;
  };
  summary?: string;
};

export type WalkBadge = "green" | "yellow" | "red";

export type WalkPresence = {
  petId: PetId;
  ownerId: string;
  petName: string;
  species: string;
  badge: WalkBadge;
  lat: number;
  lng: number;
  accuracyM?: number;
  updatedAt: number;
};

export type AdoptionStatus = "active" | "adopted" | "hidden";

export type AdoptionPost = {
  id: string;
  createdAt: number;
  createdBy: string;
  status: AdoptionStatus;
  species: string;
  name?: string;
  ageLabel?: string;
  sex?: "male" | "female" | "unknown";
  size?: "small" | "medium" | "large";
  temperamentTags?: string[];
  description: string;
  locationLabel?: string;
  shelterLabel?: string;
  photoUrls?: string[];
  reportCount?: number;
  updatedAt?: number;
};

export type TaskStatus = "due" | "done";

export type PetTask = {
  id: string;
  petId: PetId;
  title: string;
  dueAt?: number;
  status: TaskStatus;
  createdAt: number;
  createdBy: string;
  completedAt?: number;
  source?: {
    kind: "medication" | "routine" | "manual";
    refId?: string;
    occurrenceAt?: number;
  };
};

export type LogType = "food" | "water" | "activity" | "med" | "symptom" | "weight" | "vet" | "note";

export type PetLog = {
  id: string;
  petId: PetId;
  type: LogType;
  occurredAt: number;
  note?: string;
  value?: {
    amount?: number;
    unit?: string;
    tags?: string[];
  };
  createdAt: number;
  createdBy: string;
  attachmentPaths?: string[];
};

export type PetDocument = {
  id: string;
  petId: PetId;
  name: string;
  title?: string;
  docType?: "referto" | "ricetta" | "vaccino" | "analisi" | "altro";
  documentAt?: number;
  tags?: string[];
  isFavorite?: boolean;
  storagePath: string;
  contentType?: string;
  size?: number;
  createdAt: number;
  createdBy: string;
  ownerId?: string;
  uploadStatus?: "uploading" | "ready" | "failed";
  uploadError?: string;
  sha256?: string;
  updatedAt?: number;
};

export type PetMedication = {
  id: string;
  petId: PetId;
  name: string;
  dose?: string;
  unit?: string;
  route?: string;
  times: string[];
  startAt: number;
  endAt?: number;
  enabled: boolean;
  notes?: string;
  createdAt: number;
  createdBy: string;
};

export type PetVaccine = {
  id: string;
  petId: PetId;
  name: string;
  lastAt?: number;
  nextDueAt: number;
  intervalDays: number;
  reminderDaysBefore: number;
  notes?: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
};

export type AiCitation = {
  kind: "log" | "task";
  id: string;
  occurredAt?: number;
  type?: string;
};

export type AiChatResponse = {
  answer: string;
  citations: AiCitation[];
};

export type AiSummaryResponse = {
  summary: string;
  citations: AiCitation[];
};

export type HealthEventType = "vaccine" | "med" | "visit" | "allergy" | "symptom" | "note";

export type HealthEvent = {
  id: string;
  petId: PetId;
  type: HealthEventType;
  occurredAt: number;
  title: string;
  note?: string;
  severity?: "low" | "medium" | "high";
  attachments?: Array<{ name: string; storagePath: string; docId?: string }>;
  createdAt: number;
  createdBy: string;
};

export type AgendaEvent = {
  id: string;
  petId: PetId;
  title: string;
  dueAt: number;
  kind: "vet" | "grooming" | "training" | "cleaning" | "other";
  reminderMinutesBefore?: number;
  seriesId?: string;
  createdAt: number;
  createdBy: string;
};

export type AgendaSeries = {
  id: string;
  petId: PetId;
  title: string;
  kind: AgendaEvent["kind"];
  enabled: boolean;
  timezone?: string;
  startAt: number;
  recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] };
  timeOfDay?: string;
  reminderMinutesBefore?: number;
  createdAt: number;
  createdBy: string;
};

export type AiSaveStatus = "succeeded" | "failed";

export type AiSave = {
  id: string;
  petId: PetId;
  conversationId: string;
  section: string;
  userText: string;
  assistantText: string;
  status: AiSaveStatus;
  error?: string;
  createdAt: number;
  createdBy: string;
};

export type GpsPoint = {
  id: string;
  petId: PetId;
  lat: number;
  lng: number;
  accuracyM?: number;
  recordedAt: number;
  createdAt: number;
  createdBy: string;
};

export type GpsDeviceKind = "generic_http";

export type GpsDevice = {
  id: string;
  petId: PetId;
  name: string;
  kind: GpsDeviceKind;
  enabled: boolean;
  tokenHash: string;
  tokenPrefix: string;
  lastSeenAt?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
};

export type ExpenseCategory =
  | "food"
  | "vet"
  | "grooming"
  | "training"
  | "accessories"
  | "medicine"
  | "other";

export type Expense = {
  id: string;
  petId: PetId;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  occurredAt: number;
  note?: string;
  seriesId?: string;
  createdAt: number;
  createdBy: string;
};

export type ExpenseSeries = {
  id: string;
  petId: PetId;
  title: string;
  enabled: boolean;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  note?: string;
  startAt: number;
  endAt?: number;
  recurrence: { type: "monthly"; dayOfMonth: number };
  createdAt: number;
  createdBy: string;
};

export type NotificationSeverity = "info" | "warning" | "danger";

export type PetNotification = {
  id: string;
  petId: PetId;
  createdBy?: string;
  type: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  createdAt: number;
  read: boolean;
};

export type HealthStatus = "green" | "yellow" | "red";

export type HealthScore = {
  id: string;
  petId: PetId;
  score: number;
  status: HealthStatus;
  computedAt: number;
  inputs: {
    symptomCount30d: number;
    weightLogs30d: number;
    completedTasks7d: number;
    dueTasks7d: number;
    activityLogs7d?: number;
    waterLogs7d?: number;
  };
};

export type CommunityPost = {
  id: string;
  authorId: string;
  createdAt: number;
  text: string;
  petTag?: { species?: string };
  likeCount: number;
  status?: "active" | "hidden" | "removed";
  reportCount?: number;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  createdAt: number;
  text: string;
  status?: "active" | "hidden" | "removed";
  reportCount?: number;
};

export type CommunityGroup = {
  id: string;
  createdAt: number;
  name: string;
  topic?: string;
  speciesTag?: string;
};

export type CommunityGroupMessage = {
  id: string;
  groupId: string;
  authorId: string;
  createdAt: number;
  text: string;
  status?: "active" | "hidden" | "removed";
  reportCount?: number;
};

export type CommunityGroupMember = {
  id: string;
  uid: string;
  joinedAt: number;
};

export type ListingCategory = "food" | "accessories" | "medicine" | "services" | "other";

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  createdAt: number;
  title: string;
  description: string;
  category: ListingCategory;
  price: number;
  currency: string;
  status: "active" | "sold" | "hidden";
  contact?: string;
  photoPaths?: string[];
};

export type ProviderKind = "vet" | "nutritionist" | "groomer" | "sitter";

export type Provider = {
  id: string;
  kind: ProviderKind;
  name: string;
  createdBy?: string;
  city?: string;
  phone?: string;
  description?: string;
  meetingUrl?: string;
  createdAt: number;
};

export type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

export type Booking = {
  id: string;
  petId: PetId;
  userId: string;
  providerId: string;
  providerKind: ProviderKind;
  providerName: string;
  scheduledAt: number;
  confirmBy?: number;
  status: BookingStatus;
  cancelReason?: "user_cancel" | "no_confirm" | "provider_cancel";
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type RoutineKind = "food" | "med" | "walk" | "grooming" | "training" | "cleaning" | "other";

export type PetRoutine = {
  id: string;
  petId: PetId;
  title: string;
  kind: RoutineKind;
  enabled: boolean;
  timezone?: string;
  times: string[];
  recurrence: { type: "daily" } | { type: "weekly"; weekdays: number[] };
  endAt?: number;
  createdAt: number;
  createdBy: string;
};

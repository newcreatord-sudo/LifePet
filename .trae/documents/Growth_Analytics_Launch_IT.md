# Growth & Analytics (Launch) — PetLyon (IT)

Documento di tracking e growth per il lancio.

## 1) North Star Metric
**Protected & Ready Pets (PRP) / settimana**

PRP = pet con:
- protezione attiva (o public card pronta)
- 1 doc o 1 evento salute/vaccino
- 1 promemoria

## 2) Activation metrics
- Signup conversion
- Time to Value (TTV) fino a PRP
- Step completion rate (pet/protection/doc/reminder)

## 3) Retention metrics
- D1/D7/D30 retention
- Return to core (Docs/Health/Routine/Protection)
- Task completion weekly

## 4) Referral metrics
- share rate (public profile / records share)
- conversion da share → signup

## 5) Funnel completo
Landing → signup → onboarding → pet → protection → doc/health → reminder → PRP → retention → referral

## 6) Event list (P0)
Formato: `domain_action_object`

### Common props
- `route`, `ts`, `env`, `appVersion`
- `uid?`, `petId?`

### Acquisition/Auth
- `landing_viewed`
- `cta_start_free_clicked`
- `demo_started`
- `signup_started`, `signup_completed`
- `login_started`, `login_completed`, `auth_error`

### Onboarding
- `onboarding_started`
- `onboarding_goal_selected` (goal)
- `onboarding_step_cta` (step)
- `onboarding_skipped`
- `onboarding_completed`

### Pet
- `pet_created`
- `pet_switch`

### Docs
- `doc_upload_started` (docType, sizeBucket)
- `doc_upload_success`
- `doc_upload_failed` (reasonBucket)
- `doc_preview_open`
- `doc_linked_to_event`

### Health/Routine
- `health_event_created` (type)
- `vaccine_added`
- `reminder_created` (template)
- `task_completed`

### Safety
- `pet_protection_enabled`
- `lost_mode_enabled`, `lost_mode_resolved`
- `public_profile_opened`
- `public_profile_shared` (channel)
- `finder_report_sent`
- `finder_report_moderated` (status)

### AI (se attivo)
- `ai_call_started` (feature)
- `ai_call_success` (feature)
- `ai_call_failed` (feature, reason)
- `ai_save_created`

## 7) Dashboard consigliate
- Activation funnel + TTV
- Docs/Health value
- Safety dashboard
- Retention cohorts
- Quality dashboard (errors/denied/upload fail)

## 8) Cohort analysis
- cohort settimanali signup
- segmenti: goal onboarding, PRP sì/no, multi-pet

## 9) A/B tests
- goal default
- ordine step
- doc step UI
- reminder template default

## 10) Lifecycle triggers
- pet creato ma no doc 24h → prompt
- doc creato ma no reminder 48h → prompt
- protection vista ma non attiva 7g → prompt soft


# Healthcare Intake App

Two-sided healthcare intake product:

- **Patient (Expo iOS):** body-region marking, symptoms, photo upload, dual AI summary, specialty-matched doctors, case/vitals history
- **Doctor (Next.js web):** demo login, case review, professional AI assessment, text annotations

Patient signup and telehealth are deferred. OpenAI is used for vision + dual summaries; without `OPENAI_API_KEY` the API falls back to deterministic mock AI responses so the UI still works.

## Monorepo layout

```text
apps/mobile     Expo Router patient app (iOS)
apps/web        Next.js doctor dashboard + REST API + Prisma
packages/shared Shared types, region IDs, specialties, zod schemas
```

## Prerequisites

- Node.js 20+
- npm
- iOS Simulator (or Expo Go on a device)
- Optional: OpenAI API key for real vision/summary

## Setup

```bash
npm install
cd apps/web
cp .env.example .env   # if needed
npx prisma migrate dev
npm run db:seed
```

### Environment

`apps/web/.env`:

```env
DATABASE_URL="file:./dev.db"
DEMO_DOCTOR_EMAIL="doctor@demo.com"
DEMO_DOCTOR_PASSWORD="demo1234"
OPENAI_API_KEY="sk-..."   # optional; mock AI if empty
```

`apps/mobile/.env`:

```env
# iOS Simulator can use localhost. Physical device: use your Mac LAN IP.
EXPO_PUBLIC_API_URL=http://localhost:3000
```

## Run

Terminal A — API + doctor dashboard:

```bash
npm run web
```

- Dashboard: http://localhost:3000  
- Login: `doctor@demo.com` / `demo1234`

Terminal B — patient app:

```bash
npm run mobile
```

Then press `i` for iOS Simulator.

## Patient flow

1. Home → Start new case  
2. Body intake (sex, pose preset, multi-region intensity paint, vitals, symptoms)  
3. AI photo area requests → upload photos  
4. Dual AI summary + urgency (≥8 prompts contact doctor) + specialty  
5. Map + list of seeded US doctors for that specialty → open website  
6. History: case timeline + vitals + doctor annotations  

## Doctor flow

1. Login with demo account  
2. Case list with urgency badges  
3. Case detail: regions, photos, professional assessment, patient summary (collapsible), text annotations  

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cases` | Create draft case |
| POST | `/api/cases/[id]/phase1` | Photo-region AI |
| POST | `/api/cases/[id]/photos` | Upload photo |
| POST | `/api/cases/[id]/phase2` | Dual summary AI |
| GET | `/api/cases` | List demo-patient cases |
| GET | `/api/cases/[id]` | Case detail |
| GET | `/api/doctors?specialty=` | Seeded doctors |
| GET | `/api/vitals` | Height/weight history |
| POST | `/api/auth/login` | Demo doctor login |
| POST | `/api/cases/[id]/annotations` | Doctor text note |

## Notes

- Body model ships as a procedural anatomical stand-in (`expo-gl` + `three`) with selectable region overlays and pose presets. Drop glTF assets into `apps/mobile/assets/models/` later without changing region IDs.
- CORS is open for local Expo development.
- Intensity on the body is **patient-reported**; urgency on the summary is **AI-estimated** and separate.
- A root `postinstall` removes nested `apps/web/node_modules/react*` copies so Expo + Next share one React version (avoids invalid hook call / 404 prerender failures).
- Without `OPENAI_API_KEY`, phase1/phase2 return deterministic mock triage so the full flow is demoable offline.

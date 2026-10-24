# Healthcare Intake

**A clearer picture before the first hello.**

[Watch our demo on YouTube](https://youtube.com/shorts/nWvepYRQecU)


Patient intake in Expo, with a Next.js clinician workspace and REST API. The product scope is in [PRODUCT.md](PRODUCT.md).

## Run locally

Requires **Node.js 24+** (the server uses Node's built-in SQLite) and npm.

```sh
npm install
npm run web
```

In a second terminal:

```sh
npm run mobile
```

- Clinician dashboard/API: http://localhost:3000
- Login: `doctor@demo.com` / `demo1234`
- Patient preview: press `w` in Expo, or run `npm run web --workspace hackathon-openai-mobile`.
- iPhone: use Expo Go and the Expo QR code. For a physical device, both devices must be on the same network. The API host is inferred from Expo's development host, or set `EXPO_PUBLIC_API_URL` explicitly to the computer's LAN URL.
- iOS Simulator is available on macOS; this Windows checkout can serve a physical device or web preview.

## Configuration

The API reads `OPENAI_API_KEY` **or the existing `OPENAI_AI_KEY`** from its server environment. It never exposes either variable to the patient app or browser. Set `OPENAI_MODEL` to select a vision/structured-output capable model; default is `gpt-4.1-mini`.

See `apps/web/.env.example` and `apps/mobile/.env.example` for non-secret configuration. Optional server settings:

- `AI_MODE=openai` (default): real two-phase AI; failures are visible and retryable. There is no silent mock fallback.
- `AI_MODE=demo`: explicit deterministic demonstration output. Images are not analyzed and the fixed urgency value is prominently labeled.
- `SESSION_SECRET`: optional explicit server-only signing value. Without it, a random local signing value is persisted in SQLite. An ignored `.env.local` can hold an override.
- `APP_ORIGIN=http://localhost:3000`: exact trusted origin for doctor writes. Set it to the dashboard's actual URL when using another hostname.
- `DEMO_DOCTOR_EMAIL`, `DEMO_DOCTOR_PASSWORD`: override the demo login.
- `DEMO_PATIENT_TOKEN`: defaults to `demo-patient`. Match it with the app's `EXPO_PUBLIC_DEMO_PATIENT_TOKEN`.
- `DATA_DIR`: optional SQLite storage directory; default `apps/web/data` when starting from the workspace script.

## Working flow

1. Home → new case → male/female model, fixed view/pose presets, multiple marked areas with independent patient intensity, height, weight and symptoms.
2. AI requests relevant photo areas. Attach up to six JPEG/PNG/WebP images, remove mistakes, or continue without photos.
3. AI returns patient and professional summaries, a separate urgency estimate, reasoning, specialty, next steps and limitations.
4. Specialty/city-filtered doctor map and list open external health-system websites.
5. Patient history includes case packets, height/weight observations and clinician notes.
6. The doctor signs in, reviews the same packet and photos, then adds a text note visible in patient history.

Cases and image bytes persist in SQLite. Photos require the patient demo token or doctor session. Notes require the doctor session. Input and model output are validated with shared Zod schemas; images are size-limited and checked for JPEG/PNG/WebP signatures. The Responses API receives labeled photos and is called with `store: false`.

## Repository

```text
apps/mobile       Expo Router patient app; original GLB assets retained
apps/web          Next.js clinician dashboard, API and SQLite storage
packages/shared   Region vocabulary, specialty set, schemas and case types
tests             Service flow, auth, validation and AI adapter integration tests
```

The original `mobile` directory contains the old installed dependencies only; active source is in `apps/mobile`. Install/run commands belong at the repository root.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The tests use an isolated temporary database and explicit demo mode. They also replace the OpenAI transport to verify vision payloads, schema validation, and failure behavior without spending API credits. Synthetic browser smoke checks can exercise the real API separately.

## Demo boundaries

Use sample data only. This is a hackathon demo with one shared patient identity and one doctor login; the public demo token is not a substitute for patient authentication. Do not expose it as a service for real patient records.

Doctor names and pin locations are fictional and labeled in the UI. External links go to health-system homepages, not verified provider profiles. A verified directory can replace the shared seed data later.

The original GLBs have no skeletons. Raised arms use a fixed blended mesh adjustment, raycasting saves precise surface paint samples, and region labels summarize those samples. Accessible area steps provide alternate input. Real-device visual checks remain necessary. Native maps use the platform provider; Android Google Maps requires the usual platform key configuration for a standalone build.

This storage setup targets a long-running local Node server with a persistent disk, not ephemeral serverless hosting. Production patient auth, data protection and clinical validation are outside this demo.

The installed Expo CLI dependency tree currently reports npm advisories in its transitive `node-forge`/Zod packages. The audit suggestion downgrades Expo across major versions, so no forced downgrade was applied.

## October 24 interaction update

- Native photo upload uses an Expo File with expo/fetch; failed uploads remain available to retry.
- Symptom intake supports continuous surface painting. Holding increases intensity; precise surface samples are saved and displayed in the patient history and clinician packet. Paint and Rotate modes, Undo, Clear, and accessible step controls are available.
- Clinician case deletion removes a case from active history and protected photo access. The confirmation is followed by an Undo action; data is retained for recovery.
- The interface uses white and neutral gray surfaces, black primary actions, and restrained blue selection/navigation accents. Red is reserved for symptom heat and urgent/error states.

Photo follow-up: after attaching photos, patients review them and answer or skip up to four image-informed questions, one at a time. Answers are saved with the case, shown to clinicians, and included in the assessment. Editing photos invalidates the prior review. No-photo intake bypasses this step; demo mode labels its generic questions.

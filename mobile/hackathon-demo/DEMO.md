# Two-minute hackathon submission

`IntakeHackathonDemo` · 1920 × 1080 · 30 fps · exactly 120 seconds.

Every scene uses real screen capture of the working local app. No pitch slides, recreated screens or invented AI results. Remotion supplies cuts, framing and captions. No narration or music.

## Source

The user authorized case `34af5cd9-3fdc-4d2b-8402-130382636091`, its photo and intake details. New replay case `ffdaf776-322e-4602-a849-5a504ac6e11e` used the same photo, original symptoms, sex, height, weight and regional intensity. Real OpenAI photo-request and vision/summary calls ran during capture. The original case was preserved. The recorded clinician note is labeled as a demo handoff.

## Timeline

| Time | Working feature |
|---|---|
| 0–8s | Start case; explain context lost in a plain symptom text box |
| 8–26s | Rotate body and paint knee |
| 26–42s | Adjust intensity; enter symptoms and vitals |
| 42–56s | Relevant photo request and upload |
| 56–60s | Real AI request |
| 60–78s | Actual urgency, specialty, summaries and limitations |
| 78–88s | Specialty-filtered map and demo directory |
| 88–100s | Same case in clinician workspace |
| 100–110s | Photo review and save a demo note |
| 110–120s | Saved note visible to patient |

The 5/10 intensity and 3/10 urgency are separate values in this replay, not a general medical claim. Directory entries are explicitly demo data. No diagnosis, real provider verification or in-app booking is claimed.

## Preview / export

```sh
npm run dev -- --no-open --port 3100
npx remotion render IntakeHackathonDemo out/intake-hackathon-demo.mp4 --codec=h264 --crf=18
```

Footage is in `public/footage/`. Original wall-clock capture frames are in the local `capture-source/` archive; `scripts/encode-captures.mjs` encodes them without inventing UI states. Waiting and setup between clips were cut. Clip groups and captions are independently editable in Studio.

Watch the export before submission and check the hackathon upload size/format limits. Native-device testing and clinical validation remain separate tasks.

# Healthcare Intake — Product Definition

## Purpose

A two-sided healthcare application that turns a patient’s symptoms into a structured clinical intake packet before they speak to a doctor — so consultation time is spent on care, not retelling history.

Patients describe and show what is wrong. AI helps triage and route them. Doctors receive the full picture immediately, with history over time.

---

## Core value

1. **Better intake for doctors** — body regions, intensity, narrative, photos, and AI briefs arrive before the visit.
2. **Faster path to the right doctor** — specialty recommendation and discovery filtered by the problem.
3. **AI symptom triage** — dual summaries (patient-friendly and clinician-facing), urgency estimate, and next-step guidance — always framed as decision support, not a diagnosis.

---

## Market & platforms

| Dimension | Target |
|-----------|--------|
| Geography | United States |
| Patient app | iOS (Expo) |
| Doctor surface | Web dashboard |
| Booking | External — open the doctor’s website (no in-app scheduling) |
| Telehealth video | Out of scope |
| Patient signup / consents UI | Deferred for later |

---

## Product principles

- Patient-painted intensity on the body and AI urgency score are **separate** signals.
- Image analysis prioritizes **visible / skin** findings; any internal inference from photos must be **heavily hedged**.
- Both audiences see AI output: a **friendly patient summary** and a **professional assessment** for the doctor.
- High estimated urgency → prompt the patient to **contact a doctor**.
- Binary **male / female** anatomical bodies for the intake model.
- Annotations from doctors are **text only** and become part of historical tracking.

---

## Patient experience — layout & flow

### 1. Home

- Start a new case (demo identity; no signup required in early product).
- Open history (cases + vitals over time).

### 2. Body intake (primary composition)

One screen, one job: capture where it hurts and what it feels like.

**Layout intent**

- Dominant center: rotatable / pose-adjustable anatomical body (male or female mesh).
- Limited **pose presets** (e.g. neutral, arms raised, turned) so regions like armpits are reachable — not free IK.
- Multi-region selection: patient taps areas and paints intensity on a green → yellow → red scale (patient-reported only).
- Intensity control beside/near the model (slider or stepped control).
- Bottom: free-text symptoms (what they feel, the problem, concrete description for AI and doctor).
- Editable vitals on this screen: height, weight, sex (drives which body model).

**Continue** → AI phase that requests photos of relevant **body areas** (areas only — not camera technique).

### 3. Photo requests & upload

- List of AI-requested regions to photograph.
- Patient attaches images per area.
- Submit → AI vision + text analysis.

### 4. AI summary

- Patient-friendly summary (may include cautious notes about possible non-visible issues).
- Professional assessment also available to the patient (dual visibility).
- AI **urgency score** (1–10), distinct from body paint intensity.
- Recommended **specialty**.
- Clear disclaimer: not a diagnosis; not 100% reliable.
- If urgency is high: prominent **Contact a doctor** call to action.
- CTA into doctor discovery.

### 5. Find doctors

- Map + list filtered by **problem / AI specialty** (no insurance network filter in this product definition).
- Selecting a doctor opens their **website** in the system browser.

### 6. History

- Timeline of past cases (regions, summaries, urgency, specialty, doctor text annotations).
- Vitals series (height + weight) over time.

---

## Doctor experience — layout & flow

### 1. Fixed demo login

Single demo doctor account for accessing the dashboard.

### 2. Case list

- Patient intake cases, newest first.
- Urgency and specialty signals at a glance.

### 3. Case detail

One packet view so the clinician does not need the patient to restate everything:

- Vitals snapshot and symptom narrative.
- Body regions with **patient intensity** (schematic or equivalent; same region vocabulary as the patient app).
- Photo gallery by region.
- **Professional AI assessment** as the primary clinical brief; patient summary available but secondary.
- Urgency + specialty.
- **Text annotations** — doctor notes saved onto the case for longitudinal history (visible later on the patient history timeline).

---

## AI behavior (product contract)

### Phase 1 — after body + text

- Propose which **body areas** need photos.
- Optional early specialty hint.

### Phase 2 — after photos

- Patient summary + doctor assessment.
- Urgency score.
- Specialty recommendation (from a fixed US specialty set aligned with discovery).
- Disclaimers.

AI must not present certainty as diagnosis. Visible findings lead; speculative internal claims are hedged.

---

## Data model (conceptual)

Each **case** is the unit of care intake:

- Sex, height, weight, pose preset  
- Marked regions + patient intensity  
- Symptom text  
- Photos linked to regions  
- AI outputs (photo requests, dual summaries, urgency, specialty, disclaimers)  
- Doctor text annotations over time  

**Doctors** (seeded US directory): name, specialty, location, address, website.

**History** = case timeline + vitals drawn from successive cases.

---

## What this product is not (by design)

- A diagnostic authority or replacement for a clinician  
- In-app appointment booking or telehealth video  
- Insurance eligibility / public–private plan filtering for discovery  
- Free-form limb posing or non-binary body models in the first product shape  
- Drawing annotations on photos or the 3D body (text annotations only)

---

## Success picture

A patient marks the body, describes symptoms, uploads the photos AI asks for, leaves with a clear (non-diagnostic) summary and a specialty-matched doctor to contact online. The doctor opens the same case on the web, sees regions, photos, professional AI brief, and history — then adds a short note that becomes part of the patient’s longitudinal record.

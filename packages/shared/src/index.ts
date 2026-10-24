import { z } from 'zod';
export { addSurfaceMark, summarizeSurfaceMarks, createHeatSampler, heatColor, BRUSH_RADIUS, MAX_SURFACE_MARKS } from './heatmap';

export const REGIONS = [
  { id: 'head', label: 'Head & face' }, { id: 'neck', label: 'Neck' },
  { id: 'chest', label: 'Chest' }, { id: 'abdomen', label: 'Abdomen' },
  { id: 'upper-back', label: 'Upper back' }, { id: 'lower-back', label: 'Lower back' },
  { id: 'pelvis', label: 'Pelvis & hips' },
  { id: 'left-shoulder', label: 'Left shoulder & armpit' }, { id: 'right-shoulder', label: 'Right shoulder & armpit' },
  { id: 'left-arm', label: 'Left arm' }, { id: 'right-arm', label: 'Right arm' },
  { id: 'left-hand', label: 'Left hand' }, { id: 'right-hand', label: 'Right hand' },
  { id: 'left-thigh', label: 'Left thigh' }, { id: 'right-thigh', label: 'Right thigh' },
  { id: 'left-knee', label: 'Left knee' }, { id: 'right-knee', label: 'Right knee' },
  { id: 'left-leg', label: 'Left lower leg' }, { id: 'right-leg', label: 'Right lower leg' },
  { id: 'left-foot', label: 'Left foot' }, { id: 'right-foot', label: 'Right foot' },
] as const;
export type RegionId = typeof REGIONS[number]['id'];
export const regionIds = REGIONS.map(r => r.id) as [RegionId, ...RegionId[]];
export const regionSchema = z.enum(regionIds);
export const regionLabel = (id: string) => REGIONS.find(r => r.id === id)?.label ?? id;
export const SPECIALTIES = ['Primary Care', 'Dermatology', 'Orthopedics', 'Neurology', 'Cardiology', 'Gastroenterology', 'Urgent Care'] as const;
export const specialtySchema = z.enum(SPECIALTIES);
export type Specialty = z.infer<typeof specialtySchema>;
export const markSchema = z.object({ regionId: regionSchema, intensity: z.number().int().min(1).max(10) });
export const surfaceMarkSchema = z.object({
  x: z.number().min(-1.5).max(1.5), y: z.number().min(-1.2).max(1.2), z: z.number().min(-1).max(1),
  nx: z.number().min(-1).max(1), ny: z.number().min(-1).max(1), nz: z.number().min(-1).max(1),
  radius: z.number().min(.02).max(.12), intensity: z.number().min(1).max(10), regionId: regionSchema,
});
export type SurfaceMark = z.infer<typeof surfaceMarkSchema>;
export const intakeSchema = z.object({
  sex: z.enum(['male', 'female']), heightCm: z.number().min(40).max(260), weightKg: z.number().min(2).max(500),
  pose: z.enum(['neutral', 'turned', 'arms-raised']),
  surfaceMarks: z.array(surfaceMarkSchema).max(600).default([]),
  regions: z.array(markSchema).min(1).max(REGIONS.length).refine(rs => new Set(rs.map(r => r.regionId)).size === rs.length, 'Each region can only be marked once.'),
  symptoms: z.string().trim().min(10, 'Describe your symptoms in at least 10 characters.').max(5000),
});
export type Intake = z.infer<typeof intakeSchema>;
export type Mark = z.infer<typeof markSchema>;
export const phase1Schema = z.object({
  requests: z.array(z.object({ regionId: regionSchema, reason: z.string().min(1).max(300) })).max(6),
  specialtyHint: specialtySchema,
});
export const assessmentSchema = z.object({
  patientSummary: z.string().min(1).max(4000), professionalAssessment: z.string().min(1).max(6000),
  urgency: z.number().int().min(1).max(10), urgencyReason: z.string().min(1).max(1000),
  specialty: specialtySchema, nextSteps: z.array(z.string().min(1).max(600)).min(1).max(5),
  limitations: z.array(z.string().min(1).max(600)).min(1).max(5),
});
export type PhotoRequests = z.infer<typeof phase1Schema> & { source: 'openai' | 'demo' };
export type Assessment = z.infer<typeof assessmentSchema> & { source: 'openai' | 'demo' };
export const DISCLAIMER = 'AI decision support, not a diagnosis. Results can be incomplete or wrong. A licensed clinician should review this intake.';
export const EMERGENCY_MESSAGE = 'If you think this is an emergency, call 911. Do not wait for an AI summary or a doctor website.';
export type CasePhoto = { id: string; regionId: RegionId; mime: string; createdAt: string };
export type Annotation = { id: string; text: string; doctor: string; createdAt: string };
export const photoFollowupSchema = z.object({
  questions: z.array(z.string().trim().min(1).max(300)).max(4),
  urgentAdvice: z.string().max(600),
});
export const photoAnswersSchema = z.object({
  reviewId: z.string().uuid(),
  answers: z.array(z.object({ questionId: z.string().uuid(), answer: z.string().trim().max(1500) })).max(4),
});
export type PhotoReview = {
  id: string; photoIds: string[]; source: 'openai' | 'demo'; urgentAdvice: string;
  questions: { id: string; prompt: string; answer: string | null }[];
  answeredAt: string | null;
};
export type CasePacket = Intake & {
  id: string; patientId: string; createdAt: string; updatedAt: string;
  status: 'draft' | 'photos' | 'complete'; photoRequests: PhotoRequests | null;
  photos: CasePhoto[]; photoReview?: PhotoReview | null; assessment: Assessment | null; annotations: Annotation[];
};
export type Doctor = { id: string; name: string; specialty: Specialty; city: string; address: string; latitude: number; longitude: number; website: string };
// Fictional clinicians for demonstrating filters and geography. Websites are organization homepages, not provider affiliations.
export const DOCTORS: Doctor[] = SPECIALTIES.flatMap((specialty, i) => [
  { id: `ny-${i}`, name: `Dr. ${['Avery Morgan', 'Jordan Lee', 'Sam Rivera', 'Casey Chen', 'Taylor Brooks', 'Alex Patel', 'Riley Davis'][i]} (demo)`, specialty, city: 'New York, NY', address: 'Demo location · Manhattan, New York', latitude: 40.76 + i * .009, longitude: -73.98 + i * .003, website: 'https://www.mountsinai.org/' },
  { id: `sf-${i}`, name: `Dr. ${['Morgan Ellis', 'Jamie Park', 'Drew Wilson', 'Cameron Reed', 'Quinn Bell', 'Robin Shah', 'Skyler Lane'][i]} (demo)`, specialty, city: 'San Francisco, CA', address: 'Demo location · San Francisco, California', latitude: 37.76 + i * .006, longitude: -122.45 + i * .003, website: 'https://www.ucsfhealth.org/' },
]);

/** Approximate anatomical region of a tap on the normalized body. Left/right are the patient's. */
export function regionAtPoint(x: number, y: number, z: number): RegionId {
  const side = x >= 0 ? 'left' : 'right';
  if (y > .64) return 'head';
  if (y > .53 && Math.abs(x) < .14) return 'neck';
  if (Math.abs(x) > .23 && y > .34) return `${side}-shoulder`;
  if (Math.abs(x) > .24 && y > -.04) return `${side}-arm`;
  if (Math.abs(x) > .24 && y > -.35) return `${side}-hand`;
  if (y > .25) return z >= 0 ? 'chest' : 'upper-back';
  if (y > -.08) return z >= 0 ? 'abdomen' : 'lower-back';
  if (y > -.25) return 'pelvis';
  if (y > -.48) return `${side}-thigh`;
  if (y > -.61) return `${side}-knee`;
  if (y > -.81) return `${side}-leg`;
  return `${side}-foot`;
}

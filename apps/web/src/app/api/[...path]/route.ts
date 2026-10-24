import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DOCTORS, intakeSchema, photoAnswersSchema, regionSchema, specialtySchema } from '@intake/shared';
import { acquireCaseLock, addAnnotation, addPhoto, allowLoginAttempt, createCase, deleteCase, deletePhoto, getCase, getPhoto, isCaseBusy, listCases, releaseCaseLock, restoreCase, updateCase } from '../../../lib/db';
import { cookieName, doctorAuthorized, equal, newSession, patientAuthorized } from '../../../lib/auth';
import { assess, requestPhotos, reviewPhotos } from '../../../lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Patient', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200, extra = {}) => Response.json(body, { status, headers: { ...cors, ...extra } });


async function limitedJson(request: Request) {
  const text = await request.text();
  if (text.length > 180000) throw new Error('Request is too large.');
  return JSON.parse(text);
}
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/'); const post = request.method === 'POST';
  try {
    if (route === 'health') return json({ ok: true, aiMode: process.env.AI_MODE === 'demo' ? 'demo' : 'openai' });
    if (route === 'auth/login' && post) {
      const address = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
      if (!allowLoginAttempt(address)) return json({ error: 'Too many attempts. Try again in a minute.' }, 429);
      const input = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(await limitedJson(request));
      if (!equal(input.email, process.env.DEMO_DOCTOR_EMAIL || 'doctor@demo.com') || !equal(input.password, process.env.DEMO_DOCTOR_PASSWORD || 'demo1234')) return json({ error: 'Email or password is incorrect.' }, 401);
      return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=${newSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
    }
    const doctor = doctorAuthorized(request); const patient = patientAuthorized(request);
    if (!doctor && !patient) return json({ error: 'Please sign in to access this intake.' }, 401);
    if (post && doctor && !patient) {
      const origin = request.headers.get('origin');
      const trustedOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
      if (origin && origin !== trustedOrigin) return json({ error: 'Invalid request origin.' }, 403);
    }
    if (route === 'auth/logout' && post) return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
    if (route === 'doctors' && !post) {
      const specialty = new URL(request.url).searchParams.get('specialty');
      if (specialty) specialtySchema.parse(specialty);
      return json(DOCTORS.filter(d => !specialty || d.specialty === specialty));
    }
    if (route === 'vitals' && !post) return json(listCases().filter(p => p.status === 'complete').map(p => ({ caseId: p.id, createdAt: p.createdAt, heightCm: p.heightCm, weightKg: p.weightKg })));
    if (route === 'cases') {
      if (!post) return json(listCases());
      if (!patient) return json({ error: 'Only the patient demo can create intake cases.' }, 403);
      return json(createCase(intakeSchema.parse(await limitedJson(request))), 201);
    }
    if (path[0] === 'photos' && path.length === 2 && request.method === 'DELETE') {
      if (!patient) return json({ error: 'Only the patient demo can remove photos.' }, 403);
      const photo = getPhoto(path[1]);
      if (!photo) return json({ error: 'Image not found.' }, 404);
      if (isCaseBusy(photo.case_id) || getCase(photo.case_id)?.status !== 'photos') return json({ error: 'Photos cannot be edited while or after the summary is generated.' }, 409);
      return json(deletePhoto(photo.case_id, path[1]));
    }
    if (path[0] === 'photos' && path.length === 2 && !post) {
      const photo = getPhoto(path[1]);
      if (!photo || !getCase(photo.case_id)) return json({ error: 'Image not found.' }, 404);
      return new Response(new Uint8Array(photo.bytes), { headers: { ...cors, 'Content-Type': photo.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
    }
    if (path[0] !== 'cases' || path.length < 2 || path.length > 3) return json({ error: 'Endpoint not found.' }, 404);
    if (path[2] === 'restore' && post) {
      if (!doctor) return json({ error: 'A doctor session is required to restore a case.' }, 403);
      const restored = restoreCase(path[1]);
      return restored ? json(restored) : json({ error: 'Case not found.' }, 404);
    }
    const packet = getCase(path[1]);
    if (!packet) return json({ error: 'Case not found.' }, 404);
    if (path.length === 2 && request.method === 'DELETE') {
      if (!doctor) return json({ error: 'A doctor session is required to delete a case.' }, 403);
      if (isCaseBusy(packet.id)) return json({ error: 'Wait for processing to finish before deleting this case.' }, 409);
      deleteCase(packet.id); return json({ ok: true });
    }
    if (path.length === 2 && !post) return json(packet);
    if (!post) return json({ error: 'Method not allowed.' }, 405);
    if (path[2] === 'annotations') {
      if (!doctor) return json({ error: 'A doctor session is required to add a note.' }, 403);
      const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(await limitedJson(request));
      return json(addAnnotation(packet.id, text), 201);
    }
    if (!patient) return json({ error: 'Only the patient demo can submit intake.' }, 403);
    if (path[2] === 'photos') {
      if (packet.status !== 'photos' || isCaseBusy(packet.id)) return json({ error: 'This case is not accepting photos right now.' }, 409);
      if (Number(request.headers.get('content-length') || 0) > 8500000) return json({ error: 'Choose an image smaller than 8 MB.' }, 413);
      const form = await request.formData(); const file = form.get('file'); const regionId = regionSchema.parse(form.get('regionId'));
      if (!packet.regions.some(r => r.regionId === regionId)) return json({ error: 'Choose an area marked on this case.' }, 400);
      if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024) return json({ error: 'Choose a non-empty image smaller than 8 MB.' }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Validate signatures, not only the untrusted client MIME or filename.
      const mime = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'image/png' : Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP' ? 'image/webp' : null;
      if (!mime) return json({ error: 'Use a JPEG, PNG or WebP image.' }, 400);
      // Multipart parsing and reading bytes yield. Recheck immediately before the
      // synchronous commit so a phase2 snapshot cannot miss an accepted photo.
      if (isCaseBusy(packet.id) || getCase(packet.id)?.status !== 'photos') return json({ error: 'Summary processing has started. This photo was not added.' }, 409);
      return json(addPhoto(packet.id, { id: randomUUID(), regionId, mime, createdAt: new Date().toISOString() }, bytes), 201);
    }
    if (path[2] === 'photo-review') {
      if (packet.status !== 'photos' || !packet.photos.length) return json({ error: 'Add photos before reviewing them.' }, 409);
      if (!acquireCaseLock(packet.id)) return json({ error: 'This case is already being processed. Please wait.' }, 409);
      try {
        const current = getCase(packet.id)!;
        if (current.photoReview) return json(current);
        const result = await reviewPhotos(current);
        return json(updateCase(packet.id, p => { p.photoReview = {
          id: randomUUID(), photoIds: current.photos.map(photo => photo.id), source: result.source,
          urgentAdvice: result.urgentAdvice, answeredAt: result.questions.length ? null : new Date().toISOString(),
          questions: result.questions.map(prompt => ({ id: randomUUID(), prompt, answer: null })),
        }; }));
      } finally { releaseCaseLock(packet.id); }
    }
    if (path[2] === 'photo-answers') {
      const input = photoAnswersSchema.parse(await limitedJson(request));
      // Read again after parsing the request, since photo edits can invalidate a review.
      const current = getCase(packet.id)!;
      const review = current.photoReview;
      if (isCaseBusy(packet.id) || current.status !== 'photos' || !review || review.id !== input.reviewId) return json({ error: 'The photos changed or processing started. Review the current photos before answering.' }, 409);
      if (input.answers.length !== review.questions.length || new Set(input.answers.map(a => a.questionId)).size !== input.answers.length || input.answers.some(a => !review.questions.some(q => q.id === a.questionId))) return json({ error: 'Submit one answer or skip for each question.' }, 400);
      return json(updateCase(packet.id, p => {
        for (const question of p.photoReview!.questions) question.answer = input.answers.find(a => a.questionId === question.id)!.answer || null;
        p.photoReview!.answeredAt = new Date().toISOString();
      }));
    }
    if (path[2] === 'phase1' || path[2] === 'phase2') {
      if (isCaseBusy(packet.id)) return json({ error: 'This case is already being processed. Please wait.' }, 409);
      if (packet.status === 'complete') return json(packet);
      if (path[2] === 'phase1' && packet.photoRequests) return json(packet);
      if (path[2] === 'phase2' && !packet.photoRequests) return json({ error: 'Complete the photo request step first.' }, 409);
      if (!acquireCaseLock(packet.id)) return json({ error: 'This case is already being processed. Please wait.' }, 409);
      try {
        const current = getCase(packet.id)!;
        if (current.status === 'complete' || (path[2] === 'phase1' && current.photoRequests)) return json(current);
        if (path[2] === 'phase1') {
          const result = await requestPhotos(current);
          return json(updateCase(packet.id, p => { p.photoRequests = result; p.status = 'photos'; }));
        }
        if (current.photos.length && !current.photoReview?.answeredAt) return json({ error: 'Review your photos and answer or skip the follow-up questions first.' }, 409);
        const result = await assess(current);
        return json(updateCase(packet.id, p => { p.assessment = result; p.status = 'complete'; }));
      } finally { releaseCaseLock(packet.id); }
    }
    return json({ error: 'Endpoint not found.' }, 404);
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues.map(i => i.message).join(' ') }, 400);
    if (e instanceof SyntaxError) return json({ error: 'Request contains invalid JSON.' }, 400);
    return json({ error: e instanceof Error ? e.message : 'Unable to complete the request. Please retry.' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = () => new Response(null, { status: 204, headers: cors });

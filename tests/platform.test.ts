import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { intakeSchema, regionAtPoint, assessmentSchema } from '@intake/shared';

const directory = mkdtempSync(join(tmpdir(), 'intake-test-'));
process.env.DATA_DIR = directory;
process.env.AI_MODE = 'demo';
process.env.SESSION_SECRET = 'test-session-secret-not-for-real-use';
const route = await import('../apps/web/src/app/api/[...path]/route');
const { listCases } = await import('../apps/web/src/lib/db');
const { validSession, newSession } = await import('../apps/web/src/lib/auth');
const { requestPhotos, assess, reviewPhotos } = await import('../apps/web/src/lib/ai');
const input = { sex: 'female', heightCm: 168, weightKg: 64, pose: 'neutral', regions: [{ regionId: 'left-arm', intensity: 9 }, { regionId: 'abdomen', intensity: 2 }], symptoms: 'An itchy red patch on my left arm for two days.' };
async function call(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = { 'x-demo-patient': 'demo-patient' }) {
  const request = new Request(`http://localhost:3000/api/${path}`, { method, headers: { ...headers, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return route[method === 'GET' ? 'GET' : method === 'DELETE' ? 'DELETE' : 'POST'](request, { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
}
test('intake validation rejects duplicates, missing narrative and invalid vitals', () => {
  assert.ok(intakeSchema.safeParse(input).success);
  assert.ok(!intakeSchema.safeParse({ ...input, regions: [...input.regions, input.regions[0]] }).success);
  assert.ok(!intakeSchema.safeParse({ ...input, symptoms: '', weightKg: -2 }).success);
  assert.equal(regionAtPoint(.4, .1, .1), 'left-arm');
  assert.equal(regionAtPoint(0, .35, -.1), 'upper-back');
});
test('doctor session signatures cannot be forged', () => {
  assert.ok(validSession(newSession())); assert.ok(!validSession(`${Date.now() + 100000}.fake`)); assert.ok(!validSession(undefined));
});
test('complete intake, photo validation, auth and longitudinal note flow', async () => {
  assert.equal((await call('cases', 'GET', undefined, {})).status, 401);
  assert.equal((await call('cases', 'POST', { ...input, heightCm: 0 })).status, 400);
  const created = await call('cases', 'POST', input); assert.equal(created.status, 201);
  let packet = await created.json(); const id = packet.id;
  assert.equal((await call(`cases/${id}/phase2`, 'POST', {})).status, 409);
  const photos = await call(`cases/${id}/phase1`, 'POST', {}); assert.equal(photos.status, 200); packet = await photos.json();
  assert.equal(packet.photoRequests.source, 'demo'); assert.equal(packet.photoRequests.requests[0].regionId, 'left-arm');
  const invalid = new FormData(); invalid.append('regionId', 'left-arm'); invalid.append('file', new Blob(['not an image'], { type: 'image/jpeg' }), 'fake.jpg');
  assert.equal((await call(`cases/${id}/photos`, 'POST', invalid)).status, 400);
  const form = new FormData(); form.append('regionId', 'left-arm'); form.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1u8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
  const upload = await call(`cases/${id}/photos`, 'POST', form); assert.equal(upload.status, 201); packet = await upload.json();
  const photoId = packet.photos[0].id;
  const extra = await (await call(`cases/${id}/photos`, 'POST', form)).json();
  const removedId = extra.photos[1].id;
  assert.equal((await call(`photos/${removedId}`, 'DELETE')).status, 200);
  assert.equal((await call(`photos/${removedId}`)).status, 404);
  assert.equal((await call(`photos/${photoId}`, 'GET', undefined, {})).status, 401);
  const image = await call(`photos/${photoId}`); assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal((await call(`cases/${id}/annotations`, 'POST', { text: 'unauthorized' })).status, 403);
  const review = await (await call(`cases/${id}/photo-review`, 'POST', {})).json();
  await call(`cases/${id}/photo-answers`, 'POST', {reviewId:review.photoReview.id,answers:review.photoReview.questions.map((q:{id:string})=>({questionId:q.id,answer:'Started two days ago and is spreading.'}))});
  packet = await (await call(`cases/${id}/phase2`, 'POST', {})).json();
  assert.equal(packet.status, 'complete'); assert.equal(packet.assessment.urgency, 5); assert.notEqual(packet.assessment.urgency, input.regions[0].intensity);
  assert.equal((await call(`cases/${id}/photos`, 'POST', form)).status, 409);
  assert.equal((await call(`photos/${photoId}`, 'DELETE')).status, 409);
  const login = await call('auth/login', 'POST', { email: 'doctor@demo.com', password: 'demo1234' }, {}); assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await call('cases', 'GET', undefined, { cookie })).status, 200);
  assert.equal((await call(`cases/${id}/annotations`, 'POST', { text: '' }, { cookie })).status, 400);
  assert.equal((await call(`cases/${id}/annotations`, 'POST', { text: 'Cross-site' }, { cookie, origin: 'https://elsewhere.example' })).status, 403);
  const noted = await call(`cases/${id}/annotations`, 'POST', { text: 'Follow up with the patient about the duration of symptoms.' }, { cookie }); assert.equal(noted.status, 201);
  const history = await (await call('cases')).json(); assert.equal(history[0].annotations.length, 1); assert.equal(history[0].photos.length, 1);
  const vitals = await (await call('vitals')).json(); assert.equal(vitals[0].weightKg, 64);
  const doctors = await (await call('doctors?specialty=Dermatology')).json();
  assert.equal(doctors.length, 2); assert.ok(doctors.every((d: { specialty: string }) => d.specialty === 'Dermatology'));
  assert.equal((await call('doctors?specialty=Unknown')).status, 400);
  assert.equal(listCases()[0].id, id);
});
test('a delayed photo upload cannot commit after phase2 takes its snapshot', async () => {
  const packet = await (await call('cases', 'POST', input)).json();
  await call(`cases/${packet.id}/phase1`, 'POST', {});
  const form = new FormData(); form.append('regionId', 'left-arm'); form.append('file', new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' }), 'sample.jpg');
  let releaseBody!: () => void; let bodyStarted!: () => void; let releaseAI!: () => void; let aiStarted!: () => void;
  const bodyGate = new Promise<void>(resolve => { releaseBody = resolve; });
  const bodyReady = new Promise<void>(resolve => { bodyStarted = resolve; });
  const aiGate = new Promise<void>(resolve => { releaseAI = resolve; });
  const aiReady = new Promise<void>(resolve => { aiStarted = resolve; });
  const uploadRequest = new Request(`http://localhost:3000/api/cases/${packet.id}/photos`, { method: 'POST', headers: { 'x-demo-patient': 'demo-patient' }, body: form });
  Object.defineProperty(uploadRequest, 'formData', { value: async () => { bodyStarted(); await bodyGate; return form; } });
  const originalFetch = globalThis.fetch; const previousKey = process.env.OPENAI_API_KEY;
  try {
    const pendingUpload = route.POST(uploadRequest, { params: Promise.resolve({ path: ['cases', packet.id, 'photos'] }) });
    await bodyReady;
    process.env.AI_MODE = 'openai'; process.env.OPENAI_API_KEY = 'test-only';
    globalThis.fetch = async () => { aiStarted(); await aiGate; return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ patientSummary: 'Test summary.', professionalAssessment: 'No images supplied.', urgency: 3, urgencyReason: 'Test estimate.', specialty: 'Primary Care', nextSteps: ['Contact a clinician.'], limitations: ['Test only.'] }) }] }] }); };
    const pendingAssessment = call(`cases/${packet.id}/phase2`, 'POST', {});
    await aiReady; releaseBody();
    assert.equal((await pendingUpload).status, 409);
    releaseAI();
    const complete = await (await pendingAssessment).json();
    assert.equal(complete.photos.length, 0); assert.equal(complete.status, 'complete');
  } finally { releaseBody(); releaseAI(); globalThis.fetch = originalFetch; process.env.AI_MODE = 'demo'; if (previousKey) process.env.OPENAI_API_KEY = previousKey; else delete process.env.OPENAI_API_KEY; }
});
test('photo removal is limited to the patient during photo intake', async () => {
  const packet = await (await call('cases', 'POST', input)).json();
  await call(`cases/${packet.id}/phase1`, 'POST', {});
  const form = new FormData(); form.append('regionId', 'left-arm'); form.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1u8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
  const uploaded = await (await call(`cases/${packet.id}/photos`, 'POST', form)).json(); const photoId = uploaded.photos[0].id;
  assert.equal((await call(`photos/${photoId}`, 'DELETE', undefined, {})).status, 401);
  const removed = await call(`photos/${photoId}`, 'DELETE'); assert.equal(removed.status, 200); assert.equal((await removed.json()).photos.length, 0);
  assert.equal((await call(`photos/${photoId}`)).status, 404);
  await call(`cases/${packet.id}/phase2`, 'POST', {});
});
test('Responses adapter sends labeled vision inputs, validates output, and never silently falls back', async () => {
  process.env.AI_MODE = 'openai';
  const previousKey = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  const originalFetch = globalThis.fetch;
  const packet = listCases().find(p => p.photos.length)!;
  let sent: Record<string, unknown> = {};
  try {
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(init!.body as string);
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ patientSummary: 'Review with your clinician.', professionalAssessment: 'Patient reports an itchy patch; visible findings are uncertain.', urgency: 3, urgencyReason: 'Estimate only, based on supplied information.', specialty: 'Dermatology', nextSteps: ['Contact a licensed clinician.'], limitations: ['Images cannot assess internal conditions.'] }) }] }] });
    };
    const result = await assess(packet); assert.ok(assessmentSchema.safeParse(result).success); assert.equal(result.source, 'openai'); assert.equal(sent.store, false);
    assert.ok(JSON.stringify(sent.input).includes('data:image/png;base64,'));
    globalThis.fetch = async () => Response.json({ error: 'Unavailable' }, { status: 503 });
    await assert.rejects(() => requestPhotos(packet), /503/);
    globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"urgency":999}' }] }] });
    await assert.rejects(() => assess(packet));
  } finally { globalThis.fetch = originalFetch; process.env.AI_MODE = 'demo'; if (previousKey) process.env.OPENAI_API_KEY = previousKey; else delete process.env.OPENAI_API_KEY; }
});
test('only clinicians can delete and restore a case, including protected photos and notes',async()=>{
  const packet=await(await call('cases','POST',input)).json();
  await call(`cases/${packet.id}/phase1`,'POST',{});
  const form=new FormData();form.append('regionId','left-arm');form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1u8AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');
  const uploaded=await(await call(`cases/${packet.id}/photos`,'POST',form)).json();
  assert.equal((await call(`cases/${packet.id}`,'DELETE')).status,403);
  const login=await call('auth/login','POST',{email:'doctor@demo.com',password:'demo1234'},{});
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  await call(`cases/${packet.id}/annotations`,'POST',{text:'Sample note retained through undo.'},{cookie});
  assert.equal((await call(`cases/${packet.id}`,'DELETE',undefined,{cookie})).status,200);
  assert.equal((await call(`cases/${packet.id}`)).status,404);
  assert.equal((await call(`photos/${uploaded.photos[0].id}`)).status,404);
  assert.equal((await(await call('cases')).json()).some((c:{id:string})=>c.id===packet.id),false);
  assert.equal((await call(`cases/${packet.id}/restore`,'POST',{})).status,403);
  const restored=await(await call(`cases/${packet.id}/restore`,'POST',{}, {cookie})).json();
  assert.equal(restored.photos.length,1);assert.equal(restored.annotations.length,1);
  assert.equal((await call(`photos/${uploaded.photos[0].id}`)).status,200);
});

test('photo questions are capped, cached, answered and included in assessment, and photo edits invalidate them', async () => {
  const created = await (await call('cases','POST',input)).json(); const id=created.id;
  await call(`cases/${id}/phase1`,'POST',{});
  assert.equal((await call(`cases/${id}/photo-review`,'POST',{})).status,409);
  const upload = async () => { const form=new FormData();form.append('regionId','left-arm');form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1u8AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'sample.png');return call(`cases/${id}/photos`,'POST',form); };
  await upload();
  assert.equal((await call(`cases/${id}/phase2`,'POST',{})).status,409);
  const login=await call('auth/login','POST',{email:'doctor@demo.com',password:'demo1234'},{});
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await call(`cases/${id}/photo-review`,'POST',{}, {cookie})).status,403);
  const originalFetch=globalThis.fetch, previousKey=process.env.OPENAI_API_KEY;
  process.env.AI_MODE='openai';process.env.OPENAI_API_KEY='test-only';
  let sent: Record<string,unknown>={}, requests=0;
  const reply=(data:unknown)=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]});
  try {
    globalThis.fetch=async(_url,init)=>{requests++;sent=JSON.parse(init!.body as string);return reply({questions:['When did it begin?','Has it spread?','What other symptoms have you noticed?','Does the area feel different?'],urgentAdvice:''});};
    let packet=await(await call(`cases/${id}/photo-review`,'POST',{})).json();
    const review=packet.photoReview;
    assert.equal(review.questions.length,4);assert.equal(review.source,'openai');assert.equal(review.answeredAt,null);
    assert.ok(JSON.stringify(sent.input).includes('data:image/png;base64,'));assert.equal(sent.store,false);
    await call(`cases/${id}/photo-review`,'POST',{});assert.equal(requests,1);
    const answers=review.questions.map((q:{id:string},i:number)=>({questionId:q.id,answer:i===0?'Started yesterday; much worse today.':''}));
    assert.equal((await call(`cases/${id}/photo-answers`,'POST',{reviewId:review.id,answers:[]})).status,400);
    assert.equal((await call(`cases/${id}/photo-answers`,'POST',{reviewId:review.id,answers:[answers[0],answers[0],answers[2],answers[3]]})).status,400);
    packet=await(await call(`cases/${id}/photo-answers`,'POST',{reviewId:review.id,answers})).json();
    assert.equal(packet.photoReview.questions[0].answer,answers[0].answer);assert.equal(packet.photoReview.questions[1].answer,null);assert.ok(packet.photoReview.answeredAt);
    // A service failure preserves the answers and can be retried.
    globalThis.fetch=async()=>reply({urgency:999});
    assert.equal((await call(`cases/${id}/phase2`,'POST',{})).status,400);
    assert.equal((await(await call(`cases/${id}`)).json()).photoReview.questions[0].answer,answers[0].answer);
    // Removing even one photo invalidates the old question set and answers.
    await upload();packet=await(await call(`cases/${id}`)).json();assert.equal(packet.photoReview,null);
    assert.equal((await call(`cases/${id}/photo-answers`,'POST',{reviewId:review.id,answers})).status,409);
    globalThis.fetch=async()=>reply({questions:['One','Two','Three','Four','Five'],urgentAdvice:''});
    assert.equal((await call(`cases/${id}/photo-review`,'POST',{})).status,400);
    assert.equal((await(await call(`cases/${id}`)).json()).photoReview,null);
    globalThis.fetch=async()=>reply({questions:['How has it changed?'],urgentAdvice:'Seek prompt clinician review; do not wait for this form.'});
    packet=await(await call(`cases/${id}/photo-review`,'POST',{})).json();
    assert.ok(packet.photoReview.urgentAdvice);assert.notEqual(packet.photoReview.id,review.id);
    await call(`cases/${id}/photo-answers`,'POST',{reviewId:packet.photoReview.id,answers:[{questionId:packet.photoReview.questions[0].id,answer:answers[0].answer}]});
    globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init!.body as string);return reply({patientSummary:'Patient reports worsening since yesterday.',professionalAssessment:'Reported rapid progression requires clinician review.',urgency:7,urgencyReason:'Reported worsening.',specialty:'Primary Care',nextSteps:['Contact a clinician.'],limitations:['Photos cannot exclude internal conditions.']});};
    packet=await(await call(`cases/${id}/phase2`,'POST',{})).json();assert.equal(packet.status,'complete');
    assert.ok(JSON.stringify(sent.input).includes(answers[0].answer));assert.ok(JSON.stringify(sent.input).includes('How has it changed?'));
    assert.equal((await call(`cases/${id}/photo-answers`,'POST',{reviewId:review.id,answers})).status,409);
    // Zero follow-ups are valid and do not force filler questions.
    globalThis.fetch=async()=>reply({questions:[],urgentAdvice:''});assert.equal((await reviewPhotos(packet)).questions.length,0);
  } finally { globalThis.fetch=originalFetch;process.env.AI_MODE='demo';if(previousKey)process.env.OPENAI_API_KEY=previousKey;else delete process.env.OPENAI_API_KEY; }
});

after(() => { try { rmSync(directory, { recursive: true, force: true }); } catch { /* Windows may keep SQLite's handle until the process exits. */ } });

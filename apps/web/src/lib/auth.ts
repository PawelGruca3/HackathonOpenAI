import { createHmac, timingSafeEqual } from 'node:crypto';
import { localSessionSecret } from './db';
// Persist the random demo signing key so hot reloads and restarts do not log users out.
const secret = process.env.SESSION_SECRET || localSessionSecret;
export const cookieName = 'intake-doctor';
function sign(value: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function newSession() { const expires = String(Date.now() + 8 * 60 * 60 * 1000); return `${expires}.${sign(expires)}`; }
export function validSession(token: string | undefined) {
  if (!token) return false;
  const [expires, signature] = token.split('.');
  return Number(expires) > Date.now() && equal(signature || '', sign(expires));
}
export function doctorAuthorized(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(p => p.trim()).find(p => p.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return validSession(token);
}
export function patientAuthorized(request: Request) {
  return equal(request.headers.get('x-demo-patient') || '', process.env.DEMO_PATIENT_TOKEN || 'demo-patient');
}

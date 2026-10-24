import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Annotation, CasePacket, CasePhoto, Intake } from '@intake/shared';

const dir = resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || './data');
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(resolve(dir, 'intake.sqlite'));
db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, created_at TEXT NOT NULL, packet TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), mime TEXT NOT NULL, bytes BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS processing_locks(case_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS login_attempts(address TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS deleted_cases(case_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL);
`);
function transaction<T>(work: () => T): T {
  const owns = !db.isTransaction;
  if (owns) db.exec('BEGIN IMMEDIATE');
  try { const result = work(); if (owns) db.exec('COMMIT'); return result; }
  catch (e) { if (owns) db.exec('ROLLBACK'); throw e; }
}
export function isCaseBusy(id: string) {
  return !!db.prepare('SELECT case_id FROM processing_locks WHERE case_id=? AND expires_at>?').get(id, Date.now());
}
export function acquireCaseLock(id: string) {
  return transaction(() => {
    db.prepare('DELETE FROM processing_locks WHERE expires_at<=?').run(Date.now());
    return db.prepare('INSERT OR IGNORE INTO processing_locks VALUES(?,?)').run(id, Date.now() + 120000).changes === 1;
  });
}
export function releaseCaseLock(id: string) { db.prepare('DELETE FROM processing_locks WHERE case_id=?').run(id); }
export function allowLoginAttempt(address: string) {
  return transaction(() => {
    db.prepare('DELETE FROM login_attempts WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(address) DO UPDATE SET count=count+1').run(address, Date.now() + 60000);
    return (db.prepare('SELECT count FROM login_attempts WHERE address=?').get(address) as { count: number }).count <= 10;
  });
}
db.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run('session-secret', randomBytes(32).toString('hex'));
export const localSessionSecret = (db.prepare('SELECT value FROM settings WHERE key=?').get('session-secret') as { value: string }).value;
export const DEMO_PATIENT = 'demo-patient';
export function listCases(): CasePacket[] {
  return (db.prepare('SELECT packet FROM cases WHERE patient_id=? AND NOT EXISTS (SELECT 1 FROM deleted_cases WHERE case_id=cases.id) ORDER BY created_at DESC, rowid DESC').all(DEMO_PATIENT) as { packet: string }[]).map(r => JSON.parse(r.packet));
}
export function getCase(id: string): CasePacket | null {
  const row = db.prepare('SELECT packet FROM cases WHERE id=? AND patient_id=? AND NOT EXISTS (SELECT 1 FROM deleted_cases WHERE case_id=cases.id)').get(id, DEMO_PATIENT) as { packet: string } | undefined;
  return row ? JSON.parse(row.packet) : null;
}
export function createCase(input: Intake): CasePacket {
  const now = new Date().toISOString();
  const packet: CasePacket = { ...input, id: randomUUID(), patientId: DEMO_PATIENT, createdAt: now, updatedAt: now, status: 'draft', photos: [], photoRequests: null, assessment: null, annotations: [] };
  db.prepare('INSERT INTO cases VALUES(?,?,?,?)').run(packet.id, DEMO_PATIENT, now, JSON.stringify(packet));
  return packet;
}
export function deleteCase(id: string) {
  return transaction(() => {
    if (isCaseBusy(id)) throw new Error('This case is being processed. Please wait before deleting it.');
    if (!getCase(id)) throw new Error('Case not found.');
    db.prepare('INSERT OR REPLACE INTO deleted_cases VALUES(?,?)').run(id, new Date().toISOString());
  });
}
export function restoreCase(id: string) {
  return transaction(() => {
    db.prepare('DELETE FROM deleted_cases WHERE case_id=?').run(id);
    return getCase(id);
  });
}
// Each update re-reads the packet synchronously, avoiding stale async AI work overwriting photos/notes.
export function updateCase(id: string, change: (packet: CasePacket) => void): CasePacket {
  return transaction(() => {
    const packet = getCase(id);
    if (!packet) throw new Error('Case not found');
    change(packet); packet.updatedAt = new Date().toISOString();
    db.prepare('UPDATE cases SET packet=? WHERE id=?').run(JSON.stringify(packet), id);
    return packet;
  });
}
export function addPhoto(id: string, photo: CasePhoto, bytes: Uint8Array): CasePacket {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (isCaseBusy(id)) throw new Error('Summary processing has started. This photo was not added.');
    const packet = updateCase(id, p => {
      if (p.status !== 'photos') throw new Error('Photos can only be added during photo intake.');
      if (p.photos.length >= 6) throw new Error('A case can contain at most six photos.');
      p.photos.push(photo); p.photoReview = null;
    });
    db.prepare('INSERT INTO photos VALUES(?,?,?,?)').run(photo.id, id, photo.mime, bytes);
    db.exec('COMMIT'); return packet;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
export function getPhoto(id: string) {
  return db.prepare('SELECT case_id, mime, bytes FROM photos WHERE id=?').get(id) as { case_id: string; mime: string; bytes: Uint8Array } | undefined;
}
export function addAnnotation(id: string, text: string): CasePacket {
  const note: Annotation = { id: randomUUID(), text, doctor: 'Demo clinician', createdAt: new Date().toISOString() };
  return updateCase(id, p => p.annotations.push(note));
}
export function deletePhoto(caseId: string, photoId: string): CasePacket {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (isCaseBusy(caseId)) throw new Error('Summary processing has started. This photo was not removed.');
    const packet = updateCase(caseId, p => {
      if (p.status !== 'photos') throw new Error('This case is no longer accepting photo edits.');
      if (!p.photos.some(photo => photo.id === photoId)) throw new Error('Photo not found on this case.');
      p.photos = p.photos.filter(photo => photo.id !== photoId); p.photoReview = null;
    });
    db.prepare('DELETE FROM photos WHERE id=? AND case_id=?').run(photoId, caseId);
    db.exec('COMMIT'); return packet;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

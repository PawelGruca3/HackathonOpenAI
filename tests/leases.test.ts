import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'intake-leases-'));
process.env.DATA_DIR = directory;
const { acquireCaseLock, isCaseBusy, releaseCaseLock, allowLoginAttempt } = await import('../apps/web/src/lib/db');

test('processing leases are shared in SQLite and recover after expiration', () => {
  const peer = new DatabaseSync(join(directory, 'intake.sqlite'));
  try {
    assert.equal(acquireCaseLock('case-a'), true);
    assert.equal(isCaseBusy('case-a'), true);
    assert.equal(acquireCaseLock('case-a'), false);
    assert.ok(peer.prepare('SELECT case_id FROM processing_locks WHERE case_id=?').get('case-a'));
    peer.prepare('UPDATE processing_locks SET expires_at=? WHERE case_id=?').run(Date.now() - 1, 'case-a');
    assert.equal(isCaseBusy('case-a'), false);
    assert.equal(acquireCaseLock('case-a'), true);
    releaseCaseLock('case-a');
    assert.equal(isCaseBusy('case-a'), false);
  } finally { peer.close(); }
});
test('login throttling shares a time window across database connections', () => {
  const peer = new DatabaseSync(join(directory, 'intake.sqlite'));
  try {
    for (let i = 0; i < 10; i++) assert.equal(allowLoginAttempt('test-client'), true);
    assert.equal(allowLoginAttempt('test-client'), false);
    const stored = peer.prepare('SELECT count FROM login_attempts WHERE address=?').get('test-client') as { count: number };
    assert.equal(stored.count, 11);
    peer.prepare('UPDATE login_attempts SET expires_at=? WHERE address=?').run(Date.now() - 1, 'test-client');
    assert.equal(allowLoginAttempt('test-client'), true);
  } finally { peer.close(); }
});

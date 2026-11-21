import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkIngressAccess,
  readIngressAccess,
  validateIngressAccess,
} from '../src/ingress-access.js';

const request = (headers = {}, ip = '172.30.32.2') => ({ headers, socket: { remoteAddress: ip } });
test('all users remain allowed through ingress by default, but identity cannot bypass proxy restriction', () => {
  assert.equal(validateIngressAccess(), 'all');
  assert.doesNotThrow(() => checkIngressAccess(request(), true, 'all'));
  assert.doesNotThrow(() =>
    checkIngressAccess(
      request({ 'x-remote-user-id': 'regular', 'x-remote-user-groups': 'system-users' }),
      true,
      'all',
    ),
  );
  const spoofed = request(
    { 'x-remote-user-id': 'admin', 'x-remote-user-groups': 'system-admin' },
    '127.0.0.1',
  );
  assert.throws(() => checkIngressAccess(spoofed, true, 'admins'), { status: 403 });
});

test('administrator policy denies missing or misleading identity and accepts exact trusted group', () => {
  for (const headers of [
    {},
    { 'x-remote-user-groups': 'system-admin' },
    { 'x-remote-user-id': 'user' },
    { 'x-remote-user-id': 'user', 'x-remote-user-groups': 'system-users' },
    { 'x-remote-user-id': 'user', 'x-remote-user-groups': 'not-system-admin' },
  ])
    assert.throws(() => checkIngressAccess(request(headers), true, 'admins'), { status: 403 });
  assert.doesNotThrow(() =>
    checkIngressAccess(
      request(
        { 'x-remote-user-id': 'admin', 'x-remote-user-groups': 'system-users, system-admin' },
        '::ffff:172.30.32.2',
      ),
      true,
      'admins',
    ),
  );
  assert.doesNotThrow(() => checkIngressAccess(request({}, '127.0.0.1'), false, 'all'));
});

test('legacy options default to all, invalid access options fail instead of disabling restrictions', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'budget-access-'));
  const file = path.join(directory, 'options.json');
  try {
    assert.equal(readIngressAccess(file), 'all');
    for (const [json, expected] of [
      ['{}', 'all'],
      ['{"ingress_access":"all"}', 'all'],
      ['{"ingress_access":"admins"}', 'admins'],
    ]) {
      writeFileSync(file, json);
      assert.equal(readIngressAccess(file), expected);
    }
    for (const json of ['{', 'null', '[]', '{"ingress_access":"typo"}']) {
      writeFileSync(file, json);
      assert.throws(() => readIngressAccess(file));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

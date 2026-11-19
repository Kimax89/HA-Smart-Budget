import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

let found = false;
for (const pid of readdirSync('/proc').filter((name) => /^\d+$/.test(name))) {
  try {
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    if (!/(^|\/)node$/.test(args[0]) || args[1] !== 'src/server.js') continue;
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const uid = Number(/^Uid:\s+(\d+)/m.exec(status)?.[1]);
    assert.ok(Number.isInteger(uid) && uid > 0, 'Budget server must run without root');
    console.log(`Budget server PID ${pid} runs as UID ${uid}`);
    found = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
assert.ok(found, 'Budget server process must be running');

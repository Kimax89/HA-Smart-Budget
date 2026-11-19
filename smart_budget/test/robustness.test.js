import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBudget, BudgetError } from '../src/budget.js';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

test('malformed collection entries produce validation errors instead of server failures', () => {
  for (const collection of ['people', 'accounts', 'items', 'categories']) {
    for (const invalid of [null, [], 42, 'invalid']) {
      const state = fixture();
      state[collection] = [invalid];
      assert.throws(() => validateBudget(state), BudgetError);
    }
  }
});

test('an older application refuses newer databases without changing schema version or data', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'budget-version-'));
  const filename = path.join(directory, 'budget.sqlite');
  try {
    let db = new DatabaseSync(filename);
    db.exec(
      "PRAGMA user_version=99; CREATE TABLE future(value TEXT); INSERT INTO future VALUES ('preserved');",
    );
    db.close();
    assert.throws(() => new BudgetStore(filename), /nyere version/);
    db = new DatabaseSync(filename);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 99);
    assert.equal(db.prepare('SELECT value FROM future').get().value, 'preserved');
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

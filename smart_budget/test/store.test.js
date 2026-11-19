import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

test('monthly history, locking, reopening, ledger and persistence', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'smart-budget-'));
  let store = new BudgetStore(path.join(dir, 'test.sqlite'));
  try {
    let jan = store.get('2030-01');
    assert.deepEqual(jan.state.people, []);
    jan = store.save('2030-01', fixture(), jan.revision);
    const janIncome = jan.result.income;
    let feb = store.get('2030-02');
    assert.equal(feb.sourceMonth, '2030-01');
    feb.state.people[0].income += 100_000;
    feb = store.save('2030-02', feb.state, feb.revision);
    assert.equal(store.get('2030-01').result.income, janIncome);
    jan = store.setClosed('2030-01', true, jan.revision);
    assert.throws(() => store.save('2030-01', fixture(), jan.revision), /afsluttet/);
    assert.equal(store.ledger('2030').months.length, 1);
    assert.equal(store.ledger('2030').totals.income, janIncome);
    store.close();
    store = new BudgetStore(path.join(dir, 'test.sqlite'));
    assert.equal(store.get('2030-01').closed, true);
    assert.equal(store.get('2030-01').result.income, janIncome);
    jan = store.setClosed('2030-01', false, store.get('2030-01').revision);
    assert.equal(store.ledger('2030').months.length, 0);
    jan.state.items[0].amount += 1234;
    jan = store.save('2030-01', jan.state, jan.revision);
    assert.equal(store.get('2030-02').result.income, feb.result.income);
    assert.equal(store.get('2030-02').state.items[0].amount, fixture().items[0].amount);
    store.setClosed('2030-01', true, jan.revision);
    assert.equal(store.ledger('2030').months.length, 1);
    assert.equal(store.ledger('2031').months.length, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
test('concurrent saves and inherited-state changes are rejected', () => {
  const store = new BudgetStore(':memory:');
  try {
    const jan = store.get('2030-01');
    const feb = store.get('2030-02');
    store.save('2030-01', fixture(), jan.revision);
    assert.throws(() => store.save('2030-01', fixture(), jan.revision), /anden fane/);
    assert.throws(() => store.save('2030-02', fixture(), feb.revision), /anden fane/);
    assert.equal(store.get('2030-01').state.people.length, 2);
  } finally {
    store.close();
  }
});
test('invalid allocations can be drafted but cannot be closed', () => {
  const store = new BudgetStore(':memory:');
  try {
    assert.throws(() => store.setClosed('2030-01', true, store.get('2030-01').revision), /person/);
    const b = fixture();
    b.people.forEach((p) => {
      p.allocation = 'percent';
      p.value = 1000;
    });
    const jan = store.save('2030-01', b, store.get('2030-01').revision);
    assert.throws(() => store.setClosed('2030-01', true, jan.revision), /hele puljen/);
    assert.equal(store.get('2030-01').closed, false);
  } finally {
    store.close();
  }
});
test('removing a person and linked records only affects the saved target month', () => {
  const store = new BudgetStore(':memory:');
  try {
    store.save('2030-01', fixture(), store.get('2030-01').revision);
    const feb = store.get('2030-02');
    feb.state.people = feb.state.people.filter((p) => p.id !== 'b');
    feb.state.items = feb.state.items.filter((i) => i.accountId !== 'b-account');
    feb.state.accounts = feb.state.accounts.filter((a) => a.id !== 'b-account');
    store.save('2030-02', feb.state, feb.revision);
    assert.equal(store.get('2030-01').state.people.length, 2);
    assert.equal(store.get('2030-02').state.people.length, 1);
  } finally {
    store.close();
  }
});

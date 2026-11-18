import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, itemAmount, validateBudget } from '../src/budget.js';
import { fixture } from './fixtures.js';

test('equal disposable income credits shared bills paid from personal accounts', () => {
  const r = calculate(fixture(), '2030-01');
  assert.equal(r.pool, 3_000_000);
  assert.deepEqual(r.people.map(p => p.before), [1_500_000, 1_500_000]);
  assert.deepEqual(r.people.map(p => p.after), [1_450_000, 1_500_000]);
  assert.deepEqual(r.people.map(p => p.transfer), [1_200_000, 400_000]);
  assert.equal(r.people.reduce((n, p) => n + p.transfer, 0), r.sharedAccountNeed);
  assert.deepEqual(r.errors, []);
});
test('10 and 90 percent are shares of the entire pool', () => {
  const b = fixture(); b.people[0].allocation = 'percent'; b.people[0].value = 1000;
  b.people[1].allocation = 'percent'; b.people[1].value = 9000;
  const r = calculate(b, '2030-01');
  assert.deepEqual(r.people.map(p => p.before), [300_000, 2_700_000]);
  assert.equal(r.people[1].transfer, -800_000);
  assert.deepEqual(r.errors, []);
});
test('fixed amounts and percentages combine with an automatic remainder', () => {
  const b = fixture(); b.people.push({ id: 'c', name: 'Person C', income: 0, allocation: 'auto', value: 0 });
  b.people[0].allocation = 'percent'; b.people[0].value = 2000;
  b.people[1].allocation = 'fixed'; b.people[1].value = 500_000;
  const r = calculate(b, '2030-01');
  assert.deepEqual(r.people.map(p => p.before), [600_000, 500_000, 1_900_000]);
  assert.deepEqual(r.errors, []);
});
test('invalid allocations report errors instead of silently normalizing percentages', () => {
  const b = fixture(); b.people.forEach(p => { p.allocation = 'percent'; p.value = 1000; });
  assert.ok(calculate(b, '2030-01').errors.length);
  b.people.forEach(p => { p.value = 6000; });
  assert.ok(calculate(b, '2030-01').errors.some(e => e.includes('100 %')));
});
test('personal bills on a shared account are funded only by their owner', () => {
  const b = fixture(); b.items[3].accountId = 'shared';
  const r = calculate(b, '2030-01');
  assert.equal(r.people[0].transfer, 1_250_000);
  assert.equal(r.people[0].after, 1_450_000);
  assert.equal(r.people.reduce((n, p) => n + p.transfer, 0), r.sharedAccountNeed);
});
test('all supported cycles preserve bill totals across years in either mode', () => {
  for (const interval of [1, 2, 6, 12]) for (const amount of [0, 1, 10001, 1_200_000]) for (const mode of ['monthly', 'due']) {
    const item = { amount, interval, mode, startMonth: '2030-11' };
    assert.equal(itemAmount(item, '2030-10'), 0);
    let total = 0;
    for (let n = 0; n < interval * 2; n++) total += itemAmount(item, new Date(Date.UTC(2030, 10 + n, 1)).toISOString().slice(0, 7));
    assert.equal(total, amount * 2);
  }
});
test('rounding preserves every cent for percentages, equal splits and deficits', () => {
  for (const income of [1, 2, 101, 102, 1_000_001]) {
    const b = fixture(); b.items = []; b.people[0].income = income; b.people[1].income = 0;
    let r = calculate(b, '2030-01');
    assert.equal(r.people.reduce((n, p) => n + p.before, 0), income);
    b.people[0].allocation = 'percent'; b.people[0].value = 3333;
    b.people[1].allocation = 'percent'; b.people[1].value = 6667;
    r = calculate(b, '2030-01');
    assert.equal(r.people.reduce((n, p) => n + p.before, 0), income);
    assert.deepEqual(r.errors, []);
  }
  const b = fixture(); b.people.forEach(p => p.income = 0);
  const r = calculate(b, '2030-01');
  assert.equal(r.people.reduce((n, p) => n + p.before, 0), r.pool);
  assert.ok(r.warnings.length);
});
test('validation rejects dangling references, malformed months and invalid amounts', () => {
  const b = fixture(); b.people.pop(); assert.throws(() => validateBudget(b), /ejer/);
  const c = fixture(); c.items[0].amount = 0.5; assert.throws(() => validateBudget(c), /øre/);
  c.items[0].amount = 1; c.items[0].startMonth = '2030-13'; assert.throws(() => validateBudget(c), /måned/);
  const d = fixture(); d.items[3].personId = 'b'; assert.throws(() => validateBudget(d), /kontoens ejer/);
});
test('many synthetic family budgets balance to the cent', () => {
  for (let n = 1; n <= 60; n++) {
    const b = fixture(); b.people[0].income += n * 117; b.items[0].amount += n * 43;
    b.people.push({ id: 'c', name: 'Person C', income: n * 1151, allocation: 'auto', value: 0 });
    const r = calculate(b, '2030-01');
    assert.equal(r.people.reduce((t, p) => t + p.before, 0), r.pool);
    assert.equal(r.people.reduce((t, p) => t + p.transfer, 0), r.sharedAccountNeed);
  }
});

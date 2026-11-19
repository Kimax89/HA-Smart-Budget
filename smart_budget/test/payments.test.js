import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, danishDate, paymentInfo, validateBudget } from '../src/budget.js';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

test('old budgets default to day 1, no category and no recorded payments', () => {
  const b = validateBudget(fixture());
  assert.deepEqual(b.categories, []);
  assert.deepEqual(b.payments, []);
  assert.ok(b.items.every((i) => i.paymentDay === 1 && i.categoryId === null));
});
test('upcoming, overdue and paid use the actual payment date, including today', () => {
  const item = validateBudget(fixture()).items[0];
  item.paymentDay = 15;
  assert.deepEqual(paymentInfo(item, '2030-01', [], '2030-01-14'), {
    dueDate: '2030-01-15',
    paymentStatus: 'upcoming',
  });
  assert.equal(paymentInfo(item, '2030-01', [], '2030-01-15').paymentStatus, 'upcoming');
  assert.equal(paymentInfo(item, '2030-01', [], '2030-01-16').paymentStatus, 'overdue');
  assert.equal(paymentInfo(item, '2030-01', [item.id], '2030-01-16').paymentStatus, 'paid');
});
test('day 31 clamps to the last day, including leap years and 30-day months', () => {
  const item = validateBudget(fixture()).items[0];
  item.startMonth = '2020-01';
  item.paymentDay = 31;
  for (const [month, expected] of [
    ['2030-02', '2030-02-28'],
    ['2032-02', '2032-02-29'],
    ['2030-04', '2030-04-30'],
    ['2030-12', '2030-12-31'],
  ])
    assert.equal(paymentInfo(item, month).dueDate, expected);
});
test('payment status follows the billing cycle, not monthly budget provisions', () => {
  const item = validateBudget(fixture()).items[0];
  item.interval = 12;
  item.mode = 'monthly';
  assert.equal(paymentInfo(item, '2029-12').dueDate, null);
  assert.equal(paymentInfo(item, '2030-01').dueDate, '2030-01-01');
  assert.deepEqual(paymentInfo(item, '2030-02'), { dueDate: null, paymentStatus: null });
  assert.equal(paymentInfo(item, '2031-01').dueDate, '2031-01-01');
  const b = fixture();
  b.items[0] = item;
  assert.equal(calculate(b, '2030-02').lines[0].monthlyAmount, 25000);
  assert.equal(calculate(b, '2030-02').lines[0].paymentStatus, null);
});
test('Danish payment status dates are independent of the server timezone', () => {
  assert.equal(danishDate(new Date('2026-11-18T23:30:00Z')), '2026-11-19');
  assert.equal(danishDate(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});
test('invalid payment days, categories and payment references are rejected', () => {
  for (const day of [0, 32, 1.5, '1']) {
    const b = fixture();
    b.items[0].paymentDay = day;
    assert.throws(() => validateBudget(b), /Betalingsdag/);
  }
  const b = fixture();
  b.items[0].categoryId = 'missing';
  assert.throws(() => validateBudget(b), /kategori/);
  const c = fixture();
  c.categories = [
    { id: 'a', name: 'Bolig' },
    { id: 'b', name: 'bolig' },
  ];
  assert.throws(() => validateBudget(c), /findes allerede/);
  const d = fixture();
  d.payments = ['missing'];
  assert.throws(() => validateBudget(d), /Betalingsregistreringen/);
});
test('payment marks do not change amounts and do not carry into any other month', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    b.categories = [{ id: 'housing', name: 'Bolig' }];
    b.items[0].categoryId = 'housing';
    b.payments = ['one'];
    const jan = store.save('2030-01', b, store.get('2030-01').revision);
    assert.equal(jan.result.lines[0].paymentStatus, 'paid');
    assert.equal(jan.result.sharedExpenses, calculate(fixture(), '2030-01').sharedExpenses);
    const feb = store.get('2030-02');
    assert.deepEqual(feb.state.payments, []);
    assert.equal(feb.state.items[0].categoryId, 'housing');
    assert.equal(feb.state.categories[0].name, 'Bolig');
    feb.state.payments = ['two'];
    store.save('2030-02', feb.state, feb.revision);
    assert.deepEqual(store.get('2030-01').state.payments, ['one']);
    assert.deepEqual(store.get('2030-02').state.payments, ['two']);
    assert.deepEqual(store.get('2030-03').state.payments, []);
  } finally {
    store.close();
  }
});
test('payment status and categories are protected by month locking', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    b.categories = [{ id: 'housing', name: 'Bolig' }];
    b.items[0].categoryId = 'housing';
    b.payments = ['one'];
    let jan = store.save('2030-01', b, store.get('2030-01').revision);
    jan = store.setClosed('2030-01', true, jan.revision);
    const snapshot = structuredClone(jan.result);
    jan.state.payments = [];
    jan.state.categories[0].name = 'Andet';
    assert.throws(() => store.save('2030-01', jan.state, jan.revision), /afsluttet/);
    assert.deepEqual(store.get('2030-01').result, snapshot);
    assert.equal(store.get('2030-01').state.categories[0].name, 'Bolig');
    jan = store.setClosed('2030-01', false, jan.revision);
    jan.state.payments = [];
    jan = store.save('2030-01', jan.state, jan.revision);
    assert.notEqual(jan.result.lines[0].paymentStatus, 'paid');
  } finally {
    store.close();
  }
});
test('a payment cannot be registered in a provision-only month', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    b.items[0].interval = 12;
    b.payments = ['one'];
    assert.throws(() => store.save('2030-02', b, store.get('2030-02').revision), /ingen betaling/);
  } finally {
    store.close();
  }
});
test('category edits are month-specific and deletion requires moving linked items', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    b.categories = [{ id: 'housing', name: 'Bolig' }];
    b.items[0].categoryId = 'housing';
    store.save('2030-01', b, store.get('2030-01').revision);
    let feb = store.get('2030-02');
    feb.state.categories[0].name = 'Bolig og hus';
    feb = store.save('2030-02', feb.state, feb.revision);
    assert.equal(store.get('2030-01').state.categories[0].name, 'Bolig');
    feb.state.categories = [];
    assert.throws(() => store.save('2030-02', feb.state, feb.revision), /kategori/);
    feb.state.items[0].categoryId = null;
    store.save('2030-02', feb.state, feb.revision);
    assert.equal(store.get('2030-01').state.items[0].categoryId, 'housing');
  } finally {
    store.close();
  }
});
test('legacy locked records load with defaults without rewriting their stored state or snapshot', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    const result = calculate(b, '2030-01');
    result.lines.forEach((i) => {
      delete i.paymentDay;
      delete i.categoryId;
      delete i.paymentStatus;
      delete i.dueDate;
    });
    const stateJson = JSON.stringify(b),
      snapshotJson = JSON.stringify(result);
    store.db
      .prepare('INSERT INTO months(month,state,closed,snapshot,updated_at) VALUES (?,?,?,?,?)')
      .run('2030-01', stateJson, 1, snapshotJson, '2030-01-31');
    const loaded = store.get('2030-01');
    assert.equal(loaded.state.items[0].paymentDay, 1);
    assert.equal(loaded.result.pool, result.pool);
    const row = store.db.prepare('SELECT state,snapshot FROM months').get();
    assert.equal(row.state, stateJson);
    assert.equal(row.snapshot, snapshotJson);
  } finally {
    store.close();
  }
});

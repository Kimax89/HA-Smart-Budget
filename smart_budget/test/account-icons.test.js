import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBudget, accountIcons } from '../src/budget.js';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

test('old accounts use automatic icons and only shipped icon choices are accepted', () => {
  const b = validateBudget(fixture());
  assert.ok(b.accounts.every((a) => a.icon === 'auto'));
  for (const icon of accountIcons) {
    b.accounts[0].icon = icon;
    assert.equal(validateBudget(b).accounts[0].icon, icon);
  }
  b.accounts[0].icon = '../../untrusted';
  assert.throws(() => validateBudget(b), /kontoikon/);
});
test('account icons are inherited but changes never rewrite earlier or closed months', () => {
  const store = new BudgetStore(':memory:');
  try {
    const b = fixture();
    b.accounts[0].icon = 'car';
    let jan = store.save('2030-01', b, store.get('2030-01').revision);
    jan = store.setClosed('2030-01', true, jan.revision);
    let feb = store.get('2030-02');
    assert.equal(feb.state.accounts[0].icon, 'car');
    feb.state.accounts[0].icon = 'wallet';
    store.save('2030-02', feb.state, feb.revision);
    assert.equal(store.get('2030-01').state.accounts[0].icon, 'car');
    assert.equal(store.get('2030-01').result.accounts[0].icon, 'car');
    assert.equal(store.get('2030-02').state.accounts[0].icon, 'wallet');
  } finally {
    store.close();
  }
});

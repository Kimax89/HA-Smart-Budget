import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function theme(saved, storageBlocked = false) {
  const dataset = {};
  const attributes = {};
  const events = {};
  const storage = new Map(saved ? [['smart-budget-theme', saved]] : []);
  const button = {
    setAttribute: (key, value) => {
      attributes[key] = value;
    },
    addEventListener: (key, handler) => {
      events[key] = handler;
    },
  };
  const document = {
    documentElement: { dataset },
    querySelector: () => button,
    addEventListener: (key, handler) => {
      events[key] = handler;
    },
  };
  const localStorage = {
    getItem(key) {
      if (storageBlocked) throw new Error('Blocked');
      return storage.get(key);
    },
    setItem(key, value) {
      if (storageBlocked) throw new Error('Blocked');
      storage.set(key, value);
    },
  };
  vm.runInNewContext(readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8'), {
    document,
    localStorage,
  });
  events.DOMContentLoaded();
  return { dataset, attributes, storage, click: () => events.click() };
}

test('theme defaults to light, toggles accessibly and persists the choice across reloads', () => {
  const ui = theme();
  assert.equal(ui.dataset.theme, 'light');
  assert.equal(ui.attributes['aria-checked'], 'false');
  ui.click();
  assert.equal(ui.dataset.theme, 'dark');
  assert.equal(ui.attributes['aria-checked'], 'true');
  assert.equal(theme(ui.storage.get('smart-budget-theme')).dataset.theme, 'dark');
  ui.click();
  assert.equal(ui.storage.get('smart-budget-theme'), 'light');
  assert.equal(ui.attributes['aria-checked'], 'false');
});

test('unavailable browser storage does not prevent theme switching', () => {
  const ui = theme(null, true);
  ui.click();
  assert.equal(ui.dataset.theme, 'dark');
  ui.click();
  assert.equal(ui.dataset.theme, 'light');
});

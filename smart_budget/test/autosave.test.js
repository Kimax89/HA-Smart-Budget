import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { calculate, validateBudget } from '../src/budget.js';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

// Exercise the actual UI event handlers with a small DOM adapter and the real store.
// This verifies persistence behavior, not visual layout or browser rendering.
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function harness(store) {
  const nodes = new Map();
  class Element {
    constructor() { this.listeners = {}; this.value = ''; this.innerHTML = ''; this.dataset = {}; this.elements = {}; this.classList = { toggle() {} }; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    emit(name) { return this.listeners[name]?.({ target: this, preventDefault() {} }); }
    close() { this.open = false; }
    showModal() { this.open = true; }
  }
  const node = name => { if (!nodes.has(name)) nodes.set(name, new Element()); return nodes.get(name); };
  const document = {
    querySelector(selector) {
      if (selector === '#save' && !node('#status').innerHTML.includes('id="save"')) return null;
      return node(selector);
    },
    querySelectorAll(selector) {
      const key = /^\[data-(.+)\]$/.exec(selector)?.[1];
      if (!key) return [];
      const html = key === 'tab' ? ['overview', 'people', 'accounts', 'items', 'categories', 'ledger'].map(t => `<button data-tab="${t}">`).join('') : node('#content').innerHTML;
      return [...html.matchAll(new RegExp(`<button[^>]*data-${key}="([^"]+)"[^>]*>`, 'g'))].map(match => {
        const id = /data-id="([^"]+)"/.exec(match[0])?.[1];
        const element = node(`action:${key}:${match[1]}:${id ?? ''}`);
        element.dataset[key] = match[1]; if (id) element.dataset.id = id;
        return element;
      });
    }
  };
  for (const name of ['name', 'income', 'allocation', 'value', 'amount', 'accountId', 'kind', 'personId', 'interval', 'mode', 'startMonth', 'paymentDay', 'categoryId']) node('#edit-form').elements[name] = new Element();
  const window = new Element();
  const control = { fail: false, gate: null, puts: 0, month: null };
  const fetch = async (url, options) => {
    const match = /months\/(\d{4}-\d{2})(?:\/(close|reopen))?/.exec(url);
    try {
      if (match) {
        control.month ??= match[1];
        const data = options.body ? JSON.parse(options.body) : null;
        let result;
        if (options.method === 'PUT') {
          control.puts++;
          if (control.gate) await control.gate;
          if (control.fail) throw new Error('Test: forbindelse afbrudt');
          result = store.save(match[1], data.state, data.revision);
        } else if (options.method === 'POST') result = store.setClosed(match[1], match[2] === 'close', data.revision);
        else result = store.get(match[1]);
        return { ok: true, json: async () => structuredClone(result) };
      }
      return { ok: true, json: async () => store.ledger(new URL(url, 'http://test').searchParams.get('year')) };
    } catch (error) { return { ok: false, json: async () => ({ error: error.message }) }; }
  };
  const context = vm.createContext({ document, window, calculate, validateBudget, fetch, structuredClone,
    crypto: webcrypto, console, confirm: () => true, setTimeout: () => 0, clearTimeout() {} });
  let source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*?;\r?\n/, '');
  vm.runInContext(source, context);
  return { node, control, window,
    action: (kind, value, id = '') => node(`action:${kind}:${value}:${id}`).emit('click'),
    async addPerson() {
      await this.action('add', 'people');
      Object.assign(node('#edit-form').elements.name, { value: 'Testperson' });
      Object.assign(node('#edit-form').elements.income, { value: '12345,67' });
      Object.assign(node('#edit-form').elements.allocation, { value: 'auto' });
      node('#edit-form').emit('submit');
    }
  };
}
test('app automatically persists applied edits and removals, with saving and saved status', async () => {
  const store = new BudgetStore(':memory:');
  try {
    const ui = harness(store); await settle();
    let release; ui.control.gate = new Promise(resolve => { release = resolve; });
    await ui.addPerson();
    assert.match(ui.node('#status').innerHTML, /Gemmer…/);
    assert.equal(store.get(ui.control.month).state.people.length, 0);
    release(); await settle();
    const saved = store.get(ui.control.month);
    assert.equal(saved.state.people[0].income, 1234567);
    assert.match(ui.node('#status').innerHTML, />Gemt</);
    assert.doesNotMatch(ui.node('#status').innerHTML, /Gem måned/);
    await ui.action('tab', 'people');
    await ui.action('remove', 'people', saved.state.people[0].id); await settle();
    assert.equal(store.get(ui.control.month).state.people.length, 0);
    assert.equal(ui.control.puts, 2);
  } finally { store.close(); }
});
test('failed autosave retains edits, warns before unload and retries before changing month', async () => {
  const store = new BudgetStore(':memory:');
  try {
    const ui = harness(store); await settle(); ui.control.fail = true;
    await ui.addPerson(); await settle();
    assert.match(ui.node('#status').innerHTML, /Kunne ikke gemme/);
    assert.match(ui.node('#status').innerHTML, /Prøv at gemme igen/);
    let warned = false;
    ui.window.listeners.beforeunload({ preventDefault() { warned = true; } });
    assert.equal(warned, true);
    const oldMonth = ui.control.month;
    ui.node('#month').value = '2099-12'; await ui.node('#month').emit('change'); await settle();
    assert.equal(ui.node('#month').value, oldMonth);
    assert.equal(store.get(oldMonth).state.people.length, 0);
    ui.control.fail = false;
    await ui.node('#save').emit('click'); await settle();
    assert.equal(store.get(oldMonth).state.people[0].name, 'Testperson');
    assert.match(ui.node('#status').innerHTML, />Gemt</);
  } finally { store.close(); }
});
test('autosave does not close a month; explicit close and reopen preserve the saved data', async () => {
  const store = new BudgetStore(':memory:');
  try {
    const ui = harness(store); await settle(); await ui.addPerson(); await settle();
    assert.equal(store.get(ui.control.month).closed, false);
    await ui.node('#close-month').emit('click'); await settle();
    assert.equal(store.get(ui.control.month).closed, true);
    assert.match(ui.node('#status').innerHTML, /Afsluttet og låst/);
    await ui.node('#close-month').emit('click'); await settle();
    assert.equal(store.get(ui.control.month).closed, false);
    assert.equal(store.get(ui.control.month).state.people.length, 1);
  } finally { store.close(); }
});

test('payment action automatically saves and can undo a month-specific payment mark', async () => {
  const store = new BudgetStore(':memory:');
  try {
    const now=new Date();const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const b=fixture();b.items.forEach(i=>i.startMonth='2000-01');store.save(month,b,store.get(month).revision);
    const ui=harness(store);await settle();await ui.action('tab','items');
    assert.match(ui.node('#content').innerHTML,/Markér betalt/);
    await ui.action('payment','one');await settle();
    assert.deepEqual(store.get(month).state.payments,['one']);
    assert.match(ui.node('#content').innerHTML,/payment-badge paid/);
    await ui.action('payment','one');await settle();assert.deepEqual(store.get(month).state.payments,[]);
    await ui.action('payment','one');await settle();
    await ui.action('remove','items','one');await settle();
    assert.equal(store.get(month).state.items.some(i=>i.id==='one'),false);
    assert.deepEqual(store.get(month).state.payments,[]);
  } finally {store.close();}
});

test('users can create a category and assign it with a payment day in the item editor', async () => {
  const store=new BudgetStore(':memory:');
  try {
    const now=new Date();const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const b=fixture();b.items.forEach(i=>i.startMonth='2000-01');store.save(month,b,store.get(month).revision);
    const ui=harness(store);await settle();await ui.action('tab','categories');await ui.action('add','categories');
    ui.node('#edit-form').elements.name.value='Min kategori';ui.node('#edit-form').emit('submit');await settle();
    const category=store.get(month).state.categories[0];assert.equal(category.name,'Min kategori');
    await ui.action('tab','items');await ui.action('edit','items','one');
    assert.match(ui.node('#fields').innerHTML,/name="paymentDay" value="1"/);
    const f=ui.node('#edit-form').elements;
    for(const [key,value] of Object.entries({name:'Fælles regning A',amount:'3000',kind:'shared',accountId:'a-account',personId:'',interval:'1',mode:'monthly',startMonth:'2000-01',paymentDay:'15',categoryId:category.id})) f[key].value=value;
    ui.node('#edit-form').emit('submit');await settle();
    const item=store.get(month).state.items.find(i=>i.id==='one');assert.equal(item.paymentDay,15);assert.equal(item.categoryId,category.id);
    assert.match(ui.node('#content').innerHTML,/Min kategori/);
  } finally {store.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { BudgetStore } from '../src/store.js';
import { fixture } from './fixtures.js';

test('HTTP workflow, validation, conflict protection and served browser modules', async () => {
  const store = new BudgetStore(':memory:');
  const server = createServer(store);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, method = 'GET', data, headers = {}) =>
    fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Budget-Request': '1', ...headers },
      body: data ? JSON.stringify(data) : undefined,
    });
  try {
    for (const route of [
      '/',
      '/app.js',
      '/theme.js',
      '/style.css',
      '/budget.js',
      '/model.js',
      '/validation.js',
      '/payments.js',
      '/api/health',
      '/icons/house.svg',
      '/icons/user.svg',
      '/icons/users.svg',
      '/icons/wallet.svg',
      '/icons/piggy-bank.svg',
      '/icons/landmark.svg',
      '/icons/credit-card.svg',
      '/icons/car.svg',
      '/icons/shopping-cart.svg',
      '/icons/briefcase.svg',
    ])
      assert.equal((await request(route)).status, 200);
    const icon = await request('/icons/house.svg');
    assert.equal(icon.headers.get('content-type'), 'image/svg+xml');
    assert.match(await icon.text(), /<svg/);
    const logo = await request('/logo.svg');
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get('content-type'), 'image/svg+xml');
    const logoText = await logo.text();
    assert.match(logoText, /<svg/);
    assert.doesNotMatch(logoText, /<(?:image|text)\b/);
    const page = await (await request('/')).text();
    assert.match(page, /class="brand-logo" src="\.\/logo.svg"/);
    assert.match(page, /rel="icon" href="\.\/logo.svg"/);
    assert.equal((await request('/icons/unknown.svg')).status, 404);
    let row = await (await request('/api/months/2030-01')).json();
    const initialRevision = row.revision;
    const malformed = fixture();
    malformed.items = [null];
    assert.equal(
      (
        await request('/api/months/2030-01', 'PUT', {
          state: malformed,
          revision: initialRevision,
        })
      ).status,
      400,
    );
    assert.equal((await (await request('/api/months/2030-01')).json()).revision, initialRevision);
    let response = await request('/api/months/2030-01', 'PUT', {
      state: fixture(),
      revision: initialRevision,
    });
    assert.equal(response.status, 200);
    row = await response.json();
    assert.equal(
      (await request('/api/months/2030-01', 'PUT', { state: fixture(), revision: initialRevision }))
        .status,
      409,
    );
    assert.equal(
      (
        await request(
          '/api/months/2030-01',
          'PUT',
          { state: fixture(), revision: row.revision },
          { 'X-Budget-Request': '' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          '/api/months/2030-01',
          'PUT',
          { state: fixture(), revision: row.revision },
          { Origin: 'https://untrusted.example' },
        )
      ).status,
      403,
    );
    response = await request('/api/months/2030-01/close', 'POST', { revision: row.revision });
    assert.equal(response.status, 200);
    row = await response.json();
    assert.equal(row.closed, true);
    assert.equal(
      (await request('/api/months/2030-01', 'PUT', { state: fixture(), revision: row.revision }))
        .status,
      423,
    );
    const ledger = await (await request('/api/ledger?year=2030')).json();
    assert.equal(ledger.months.length, 1);
    response = await request('/api/months/2030-01/reopen', 'POST', { revision: row.revision });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).closed, false);
    assert.equal((await request('/api/months/2030-13')).status, 400);
    assert.equal((await request('/api/ledger?year=oops')).status, 400);
    assert.equal((await request('/missing')).status, 404);
    const badJson = await fetch(`${base}/api/months/2030-02`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Budget-Request': '1' },
      body: '{',
    });
    assert.equal(badJson.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});
test('Home Assistant mode rejects clients outside the Ingress proxy', async () => {
  const store = new BudgetStore(':memory:');
  const server = createServer(store, { ingressOnly: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/`)).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

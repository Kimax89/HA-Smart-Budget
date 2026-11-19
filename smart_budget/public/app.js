import { calculate, validateBudget } from './budget.js';
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const currency = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' });
const kr = (value) => currency.format(value / 100);
const inputMoney = (value) => (value / 100).toFixed(2).replace('.', ',');
const today = new Date();
let month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
let loaded,
  state,
  dirty = false,
  tab = 'overview',
  ledger,
  busy = false,
  errorMessage = '',
  filter = '';
let editing,
  toastTimer,
  saving = false;
const collapsedAccounts = new Set();
const iconChoices = [
  ['auto', 'Automatisk (hus/person)'],
  ['house', 'Hus'],
  ['user', 'Person'],
  ['users', 'Personer'],
  ['wallet', 'Pung'],
  ['piggy-bank', 'Sparegris'],
  ['landmark', 'Bank'],
  ['credit-card', 'Betalingskort'],
  ['car', 'Bil'],
  ['shopping-cart', 'Indkøb'],
  ['briefcase', 'Arbejde'],
];
const resolvedIcon = (account) =>
  !account.icon || account.icon === 'auto'
    ? account.ownerId === null
      ? 'house'
      : 'user'
    : account.icon;
const accountIcon = (account) =>
  '<img class="account-icon" src="./icons/' +
  resolvedIcon(account) +
  '.svg" alt="" width="22" height="22">';
const labels = {
  1: 'Hver måned',
  2: 'Hver anden måned',
  6: 'Hvert halve år',
  12: 'Én gang om året',
};
const monthName = (m) =>
  new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${m}-01T12:00:00Z`),
  );
function amount(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text))
    throw new Error('Skriv et positivt beløb med højst to decimaler, uden tusindtalsseparator.');
  const [whole, decimals = ''] = text.split('.');
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('#toast').hidden = true;
  }, 4000);
}
async function api(route, method = 'GET', data) {
  const response = await fetch(`./api/${route}`, {
    method,
    headers:
      method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Budget-Request': '1' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Kunne ikke kontakte serveren.');
  return result;
}
function currentResult() {
  return loaded.closed ? loaded.result : calculate(state, month);
}
async function load(target) {
  if (busy) {
    $('#month').value = month;
    return;
  }
  if (dirty && !(await save())) {
    $('#month').value = month;
    return;
  }
  busy = true;
  errorMessage = '';
  renderStatus();
  try {
    const result = await api(`months/${target}`);
    month = target;
    loaded = result;
    state = structuredClone(result.state);
    dirty = false;
    ledger = undefined;
    $('#month').value = month;
    if (tab === 'ledger') ledger = await api(`ledger?year=${month.slice(0, 4)}`);
  } catch (error) {
    errorMessage = error.message;
    $('#month').value = month;
  } finally {
    busy = false;
    render();
  }
}
async function save() {
  if (busy || loaded?.closed) return false;
  if (!dirty) return true;
  busy = true;
  saving = true;
  errorMessage = '';
  renderStatus();
  try {
    loaded = await api(`months/${month}`, 'PUT', { state, revision: loaded.revision });
    state = structuredClone(loaded.state);
    dirty = false;
    return true;
  } catch (error) {
    errorMessage = error.message;
    return false;
  } finally {
    busy = false;
    saving = false;
    render();
  }
}
async function toggleClosed() {
  if (busy) return;
  const action = loaded.closed ? 'reopen' : 'close';
  if (
    action === 'reopen' &&
    !confirm('Genåbn måneden? Den fjernes fra regnskabet, indtil du afslutter den igen.')
  )
    return;
  busy = true;
  errorMessage = '';
  renderStatus();
  try {
    if (dirty) {
      loaded = await api(`months/${month}`, 'PUT', { state, revision: loaded.revision });
      state = structuredClone(loaded.state);
      dirty = false;
    }
    loaded = await api(`months/${month}/${action}`, 'POST', { revision: loaded.revision });
    state = structuredClone(loaded.state);
    ledger = tab === 'ledger' ? await api(`ledger?year=${month.slice(0, 4)}`) : undefined;
    toast(
      action === 'close' ? 'Måneden er afsluttet og med i regnskabet.' : 'Måneden er genåbnet.',
    );
  } catch (error) {
    errorMessage = error.message;
  } finally {
    busy = false;
    render();
  }
}
function renderStatus() {
  $('#month-actions').innerHTML = loaded
    ? `<button id="close-month" class="secondary" ${busy ? 'disabled' : ''}>${loaded.closed ? 'Genåbn måned' : 'Afslut måned'}</button>`
    : '';
  $('#status').innerHTML = loaded
    ? `<div class="status-text"><span class="badge ${loaded.closed ? 'closed' : ''}">${loaded.closed ? '● Afsluttet og låst' : '○ Åben måned'}</span><span role="status">${saving ? 'Gemmer…' : busy ? 'Arbejder…' : dirty ? (errorMessage ? 'Kunne ikke gemme' : 'Afventer lagring') : loaded.saved ? 'Gemt' : loaded.sourceMonth ? `Automatisk lagring · udgangspunkt fra ${esc(monthName(loaded.sourceMonth))}` : 'Ændringer gemmes automatisk'}</span></div><div class="actions">${!loaded.closed && dirty && errorMessage ? `<button id="save" class="primary" ${!dirty || busy ? 'disabled' : ''}>Prøv at gemme igen</button>` : ''}</div>`
    : '<span class="muted">Henter budget…</span>';
  $('#save')?.addEventListener('click', save);
  $('#close-month')?.addEventListener('click', toggleClosed);
  $('#prev').disabled = busy || month === '2000-01';
  $('#next').disabled = busy || month === '2199-12';
  $('#month').disabled = busy;
}
function card(label, value, note, highlight = false) {
  return `<div class="card ${highlight ? 'highlight' : ''}"><div class="card-label">${label}</div><div class="card-value">${kr(value)}</div><div class="card-note">${note}</div></div>`;
}
function editName(kind, row) {
  const label = esc(row.name);
  return loaded.closed
    ? label
    : '<button type="button" class="edit-name" data-edit="' +
        kind +
        '" data-id="' +
        esc(row.id) +
        '" aria-label="Ret ' +
        (kind === 'people'
          ? 'person '
          : kind === 'categories'
            ? 'kategori '
            : kind === 'accounts'
              ? 'konto '
              : 'budgetpost ') +
        label +
        '">' +
        label +
        '</button>';
}
function personLabel(p, n = 0) {
  return `<span class="person"><span class="avatar ${n % 2 ? 'alt' : ''}">${esc(p.name.slice(0, 1).toUpperCase())}</span>${editName('people', p)}</span>`;
}
function panel(title, subtitle, body, action = '') {
  return `<div class="panel"><div class="panel-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>${body}</div>`;
}
function table(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map((h, i) => `<th${i > 0 ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function empty(title, text, action = '') {
  return `<div class="empty"><h2>${title}</h2>${text}${action}</div>`;
}
function addButton(kind, label) {
  return loaded.closed ? '' : `<button class="primary" data-add="${kind}">${label}</button>`;
}
function rowActions(kind, id) {
  return loaded.closed
    ? ''
    : `<button class="table-action" data-edit="${kind}" data-id="${id}">Ret</button><button class="table-action danger" data-remove="${kind}" data-id="${id}">Fjern</button>`;
}
function overview(r) {
  let html = '';
  if (!state.people.length)
    return (
      html +
      panel(
        'Velkommen til dit budget',
        '',
        empty(
          'Begynd med personerne',
          'Tilføj personer og indtægter. Opret derefter konti og budgetposter.<br>Budgettet starter uden eksempeldata.',
          addButton('people', '+ Tilføj person'),
        ),
      ) +
      accountOverview(r)
    );
  html +=
    '<div class="panel" aria-label="Personfordeling">' +
    table(
      [
        'Person',
        'Indkomst',
        'Fælles fra egen konto',
        'Til fællespuljen',
        'Før personlige',
        'Efter personlige',
      ],
      r.people
        .map(
          (p, n) =>
            `<tr><td>${personLabel(p, n)}</td><td class="num">${kr(p.income)}</td><td class="num">${kr(p.ownShared)}</td><td class="num strong ${p.transfer < 0 ? 'negative' : ''}">${kr(p.transfer)}</td><td class="num">${kr(p.before)}</td><td class="num">${kr(p.after)}</td></tr>`,
        )
        .join(''),
    ) +
    '</div>';
  html += accountOverview(r);
  return html;
}
function accountOverview(r) {
  if (!r.accounts.length)
    return panel(
      'Konti og budgetposter',
      '',
      empty(
        'Ingen konti endnu',
        'Opret konti, og knyt personlige konti til deres ejer.',
        addButton('accounts', '+ Tilføj konto'),
      ),
    );
  const cards = r.accounts
    .map((account) => {
      const lines = r.lines.filter((line) => line.accountId === account.id);
      const owner = state.people.find((person) => person.id === account.ownerId);
      const groups = [
        ['shared', 'Fælles udgifter'],
        ['personal', 'Personlige udgifter'],
      ]
        .map(([kind, label]) => {
          const entries = lines.filter((line) => line.kind === kind);
          if (!entries.length) return '';
          const rows = entries
            .map((line) => {
              const person =
                kind === 'personal' ? state.people.find((p) => p.id === line.personId) : null;
              const detail =
                line.interval === 1
                  ? labels[1]
                  : labels[line.interval] +
                    ' · ' +
                    kr(line.amount) +
                    ' pr. regning · ' +
                    (line.mode === 'monthly' ? 'fordelt pr. måned' : 'kun betalingsmåned');
              return (
                '<tr><td><strong>' +
                editName('items', line) +
                '</strong>' +
                (person
                  ? '<br><span class="muted small">' + editName('people', person) + '</span>'
                  : '') +
                '<br><span class="muted small">' +
                esc(detail) +
                '</span></td><td class="num">' +
                kr(line.monthlyAmount) +
                '</td></tr>'
              );
            })
            .join('');
          const subtotal = entries.reduce((sum, line) => sum + line.monthlyAmount, 0);
          return (
            '<h3 class="account-group-title">' +
            label +
            '</h3>' +
            table(
              ['Post', 'Denne måned'],
              rows +
                '<tr class="account-subtotal"><td>I alt ' +
                label.toLowerCase() +
                '</td><td class="num strong">' +
                kr(subtotal) +
                '</td></tr>',
            )
          );
        })
        .join('');
      const key = month + ':' + account.id;
      return (
        '<details class="panel account-panel" data-account-panel="' +
        account.id +
        '" ' +
        (collapsedAccounts.has(key) ? '' : 'open') +
        '><summary class="account-panel-heading"><span class="account-identity">' +
        accountIcon(account) +
        '<span><span class="account-title">' +
        esc(account.name) +
        '</span><span class="account-owner">' +
        (owner ? 'Personlig konto · ' + esc(owner.name) : 'Fælleskonto') +
        '</span></span></span><span class="account-heading-total"><span class="sr-only">Samlet udgift </span>' +
        kr(account.shared + account.personal) +
        '<span class="account-chevron" aria-hidden="true"></span></span></summary><div class="account-panel-body">' +
        (groups || empty('Ingen poster på kontoen', 'Tilføj budgetposter under Budgetposter.')) +
        '</div></details>'
      );
    })
    .join('');
  return (
    '<section aria-label="Konti og budgetposter"><div class="panel-heading account-section-heading"><div><h2>Konti og budgetposter</h2></div></div><div class="account-grid">' +
    cards +
    '</div></section>'
  );
}
function peopleView(r) {
  return panel(
    'Personer og indtægter',
    'Ændringer gemmes automatisk i den valgte måned.',
    state.people.length
      ? table(
          ['Person', 'Indkomst', 'Fordeling', 'Før personlige', 'Handling'],
          state.people
            .map(
              (p, n) =>
                `<tr><td>${personLabel(p, n)}</td><td class="num">${kr(p.income)}</td><td class="num">${p.allocation === 'auto' ? 'Automatisk rest' : p.allocation === 'percent' ? `${inputMoney(p.value)} % af puljen` : `${kr(p.value)} fast`}</td><td class="num strong">${kr(r.people[n].before)}</td><td class="num">${rowActions('people', p.id)}</td></tr>`,
            )
            .join(''),
        ) +
          '<div class="hint">Procent er en andel af hele puljen: 10 % og 90 % giver den fordeling direkte. Faste beløb trækkes også fra puljen. En eventuel rest deles ligeligt mellem personer med »Automatisk rest«. Uden automatiske personer skal hele puljen være fordelt.</div>'
      : empty('Hvem er med i budgettet?', 'Opret hver person og deres månedlige indkomst.'),
    addButton('people', '+ Tilføj person'),
  );
}
function accountsView(r) {
  return panel(
    'Konti',
    'En konto uden personlig ejer er en fælleskonto.',
    state.accounts.length
      ? table(
          ['Konto', 'Tilknyttet person', 'Fælles udgifter', 'Personlige udgifter', 'Handling'],
          r.accounts
            .map(
              (a) =>
                `<tr><td><span class="account-list-name">${accountIcon(a)}<strong>${editName('accounts', a)}</strong></span></td><td class="num">${esc(state.people.find((p) => p.id === a.ownerId)?.name ?? 'Fælleskonto')}</td><td class="num">${kr(a.shared)}</td><td class="num">${kr(a.personal)}</td><td class="num">${rowActions('accounts', a.id)}</td></tr>`,
            )
            .join(''),
        ) +
          '<div class="hint">Fælles udgifter på en personlig konto modregnes i ejerens overførsel. Hvis I har flere fælleskonti, viser overblikket behovet på hver konto; personernes bidrag vises samlet.</div>'
      : empty('Hvor betales regningerne?', 'Opret både fælleskonti og personlige konti.'),
    addButton('accounts', '+ Tilføj konto'),
  );
}
const paymentLabels = { upcoming: 'Kommende', paid: 'Betalt', overdue: 'Overskredet' };
function paymentBadge(line) {
  return line.paymentStatus
    ? '<span class="payment-badge ' +
        line.paymentStatus +
        '">' +
        paymentLabels[line.paymentStatus] +
        '</span>'
    : '<span class="muted small">Ingen betaling denne måned</span>';
}
function paymentAction(line) {
  if (loaded.closed || !line.dueDate) return '';
  return (
    '<button class="table-action" data-payment="' +
    line.id +
    '">' +
    (line.paymentStatus === 'paid' ? 'Markér ubetalt' : 'Markér betalt') +
    '</button> '
  );
}
function itemsView(r) {
  const rows = r.lines.filter((i) =>
    (
      i.name +
      ' ' +
      (state.accounts.find((a) => a.id === i.accountId)?.name ?? '') +
      ' ' +
      (state.categories.find((c) => c.id === i.categoryId)?.name ?? '')
    )
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const tools =
    '<div class="section-tools"><label class="sr-only" for="filter">Søg i budgetposter</label><input id="filter" type="search" placeholder="Søg i poster, konti eller kategorier…" value="' +
    esc(filter) +
    '"><button class="secondary" id="manage-categories">Administrer kategorier</button></div>';
  const body = rows.length
    ? table(
        [
          'Post',
          'Kategori',
          'Type / person',
          'Betales fra',
          'Pr. regning',
          'Denne måned',
          'Betalingsdato',
          'Status',
          'Handling',
        ],
        rows
          .map(
            (i) =>
              '<tr><td><strong>' +
              editName('items', i) +
              '</strong><br><span class="muted small">' +
              labels[i.interval] +
              ' · ' +
              (i.mode === 'monthly' ? 'Fordelt pr. måned' : 'Kun betalingsmåned') +
              '</span></td><td class="num">' +
              esc(state.categories.find((c) => c.id === i.categoryId)?.name ?? 'Uden kategori') +
              '</td><td class="num">' +
              (i.kind === 'shared'
                ? 'Fælles'
                : esc(state.people.find((p) => p.id === i.personId)?.name)) +
              '</td><td class="num">' +
              esc(state.accounts.find((a) => a.id === i.accountId)?.name) +
              '</td><td class="num">' +
              kr(i.amount) +
              '</td><td class="num strong">' +
              kr(i.monthlyAmount) +
              '</td><td class="num">' +
              (i.dueDate ? i.dueDate.split('-').reverse().join('.') : '—') +
              '</td><td class="num">' +
              paymentBadge(i) +
              '</td><td class="num">' +
              paymentAction(i) +
              rowActions('items', i.id) +
              '</td></tr>',
          )
          .join(''),
      )
    : empty(
        'Ingen budgetposter fundet',
        state.accounts.length
          ? 'Tilføj den første udgift for at beregne fordelingen.'
          : 'Opret en konto, før du tilføjer udgifter.',
      );
  return (
    tools +
    panel(
      'Budgetposter',
      'Beløbet er pr. regning. Månedens budget afhænger af interval og fordelingsvalg.',
      body,
      addButton('items', '+ Tilføj post'),
    )
  );
}
function categoriesView(r) {
  const rows = state.categories
    .map((category) => {
      const entries = r.lines.filter((line) => line.categoryId === category.id);
      return (
        '<tr><td><strong>' +
        editName('categories', category) +
        '</strong></td><td class="num">' +
        entries.length +
        '</td><td class="num">' +
        kr(entries.reduce((sum, line) => sum + line.monthlyAmount, 0)) +
        '</td><td class="num">' +
        rowActions('categories', category.id) +
        '</td></tr>'
      );
    })
    .join('');
  return panel(
    'Budgetkategorier',
    '',
    rows
      ? table(['Kategori', 'Antal poster', 'Denne måned', 'Handling'], rows)
      : empty(
          'Ingen kategorier endnu',
          'Opret dine egne kategorier, og vælg dem på budgetposterne.',
        ),
    addButton('categories', '+ Tilføj kategori'),
  );
}
function togglePayment(itemId) {
  if (busy || loaded.closed) return;
  const line = currentResult().lines.find((i) => i.id === itemId);
  if (!line?.dueDate) return;
  const copy = structuredClone(state);
  copy.payments = copy.payments.includes(itemId)
    ? copy.payments.filter((id) => id !== itemId)
    : [...copy.payments, itemId];
  state = validateBudget(copy);
  dirty = true;
  errorMessage = '';
  render();
  void save();
}
function ledgerView() {
  if (!ledger) return '<p class="muted">Henter regnskab…</p>';
  const { totals, months } = ledger;
  return (
    `<div class="cards">${card('Indkomst i afsluttede måneder', totals.income, ledger.year)}${card('Fælles udgifter i regnskabet', totals.sharedExpenses, `${months.length} afsluttede måneder`)}${card('Samlet rådighedspulje', totals.pool, 'Før personlige udgifter', true)}</div>` +
    panel(
      `Regnskab · ${esc(ledger.year)}`,
      'Kun afsluttede måneder indgår. Genåbnede måneder fjernes, indtil de afsluttes igen.',
      months.length
        ? table(
            ['Måned', 'Indkomst', 'Fælles udgifter', 'Rådighedspulje'],
            months
              .map(
                (m) =>
                  `<tr><td><button class="table-action" data-month="${m.month}">${esc(monthName(m.month))}</button></td><td class="num">${kr(m.income)}</td><td class="num">${kr(m.sharedExpenses)}</td><td class="num strong">${kr(m.pool)}</td></tr>`,
              )
              .join(''),
          )
        : empty('Ingen afsluttede måneder endnu', 'Afslut en måned for at lægge den i regnskabet.'),
    )
  );
}
function render() {
  renderStatus();
  if (!loaded) {
    $('#messages').innerHTML = errorMessage
      ? `<div class="notice error">${esc(errorMessage)} <button id="retry">Prøv igen</button></div>`
      : '';
    $('#retry')?.addEventListener('click', () => load(month));
    return;
  }
  const r = currentResult();
  $('#summary').hidden = tab !== 'overview';
  $('#summary').innerHTML =
    `<div class="cards">${card('Samlet indkomst', r.income, '')}${card('Fælles udgifter', r.sharedExpenses, '')}${card('Rådighedspulje', r.pool, '', true)}</div>`;
  $('#messages').innerHTML =
    (errorMessage ? `<div class="notice error">${esc(errorMessage)}</div>` : '') +
    r.errors.map((e) => `<div class="notice error">${esc(e)}</div>`).join('') +
    r.warnings.map((e) => `<div class="notice">${esc(e)}</div>`).join('') +
    (dirty
      ? '<div class="notice info">Ændringerne er endnu ikke gemt. De beholdes her, indtil lagringen lykkes. Andre gemte måneder ændres ikke.</div>'
      : '');
  $('#content').innerHTML = {
    overview,
    people: peopleView,
    accounts: accountsView,
    items: itemsView,
    categories: categoriesView,
    ledger: ledgerView,
  }[tab](r);
  document
    .querySelectorAll('[data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document
    .querySelectorAll('[data-add]')
    .forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.add)));
  document
    .querySelectorAll('[data-edit]')
    .forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.edit, b.dataset.id)));
  document
    .querySelectorAll('[data-remove]')
    .forEach((b) => b.addEventListener('click', () => removeRow(b.dataset.remove, b.dataset.id)));
  document.querySelectorAll('[data-month]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = 'overview';
      load(b.dataset.month);
    }),
  );
  document
    .querySelectorAll('[data-payment]')
    .forEach((b) => b.addEventListener('click', () => togglePayment(b.dataset.payment)));
  document.querySelectorAll('[data-account-panel]').forEach((details) => {
    const key = month + ':' + details.dataset.accountPanel;
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      if (details.open) collapsedAccounts.delete(key);
      else collapsedAccounts.add(key);
    });
  });
  $('#manage-categories')?.addEventListener('click', () => {
    tab = 'categories';
    render();
  });
  $('#filter')?.addEventListener('input', (event) => {
    const start = event.target.selectionStart;
    filter = event.target.value;
    render();
    $('#filter').focus();
    $('#filter').setSelectionRange(start, start);
  });
}
function removeRow(kind, id) {
  if (loaded.closed || busy) return;
  const copy = structuredClone(state);
  copy[kind] = copy[kind].filter((r) => r.id !== id);
  if (kind === 'items') copy.payments = copy.payments.filter((itemId) => itemId !== id);
  try {
    state = validateBudget(copy);
    dirty = true;
    errorMessage = '';
    render();
    void save();
  } catch (error) {
    toast(error.message);
  }
}
const field = (label, control, help = '') =>
  `<label class="field">${label}${control}${help ? `<small>${help}</small>` : ''}</label>`;
const input = (name, value, attrs = '') => `<input name="${name}" value="${esc(value)}" ${attrs}>`;
const select = (name, options, selected) =>
  `<select name="${name}">${options.map(([value, label]) => `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
function openEditor(kind, id) {
  if (loaded.closed || busy) return;
  if (kind === 'items' && !state.accounts.length) return toast('Opret en konto først.');
  editing = { kind, id: id ?? crypto.randomUUID() };
  const row = state[kind].find((r) => r.id === id);
  $('#dialog-title').textContent =
    `${row ? 'Ret' : 'Tilføj'} ${{ people: 'person', accounts: 'konto', items: 'budgetpost', categories: 'kategori' }[kind]}`;
  let html = field(
    'Navn',
    input('name', row?.name ?? '', 'required maxlength="120" autocomplete="off"'),
  );
  if (kind === 'people') {
    html += field(
      'Månedlig indkomst efter skat',
      input('income', inputMoney(row?.income ?? 0), 'inputmode="decimal" required'),
    );
    html += field(
      'Fordeling af rådighedspuljen',
      select(
        'allocation',
        [
          ['auto', 'Automatisk rest / ligelig fordeling'],
          ['percent', 'Procent af hele puljen'],
          ['fixed', 'Fast rådighedsbeløb i kroner'],
        ],
        row?.allocation ?? 'auto',
      ),
    );
    html += field(
      'Procent eller fast beløb',
      input('value', inputMoney(row?.value ?? 0), 'inputmode="decimal" required'),
      'Ved procent: skriv fx 10 for 10 %. Ved fast beløb: skriv kroner. Feltet bruges ikke ved automatisk fordeling.',
    );
  } else if (kind === 'accounts') {
    html += field(
      'Kontoens ejer',
      select(
        'ownerId',
        [['', 'Fælleskonto · ingen personlig ejer'], ...state.people.map((p) => [p.id, p.name])],
        row?.ownerId ?? '',
      ),
      'Fælles udgifter på en personlig konto tæller med i ejerens bidrag.',
    );
    html += field(
      'Kontoikon',
      select('icon', iconChoices, row?.icon ?? 'auto') +
        '<span class="account-icon-preview"><img id="account-icon-preview" class="account-icon" alt="Valgt kontoikon" width="24" height="24"></span>',
      'Automatisk bruger et hus til fælleskonti og en person til personlige konti.',
    );
  } else if (kind === 'categories') {
    // Categories need only a name.
  } else {
    html +=
      '<div class="form-row">' +
      field(
        'Type',
        select(
          'kind',
          [
            ['shared', 'Fælles udgift'],
            ['personal', 'Personlig udgift'],
          ],
          row?.kind ?? 'shared',
        ),
      ) +
      field(
        'Betales fra konto',
        select(
          'accountId',
          state.accounts.map((a) => [a.id, a.name]),
          row?.accountId ?? state.accounts[0].id,
        ),
      ) +
      '</div>';
    html += field(
      'Person ved personlig udgift',
      select(
        'personId',
        [['', 'Vælg person'], ...state.people.map((p) => [p.id, p.name])],
        row?.personId ?? '',
      ),
      'Personlige konti bruger automatisk kontoens ejer. På en fælleskonto vælger du personen.',
    );
    html +=
      '<div class="form-row">' +
      field(
        'Beløb pr. regning',
        input('amount', inputMoney(row?.amount ?? 0), 'inputmode="decimal" required'),
      ) +
      field('Betalingsinterval', select('interval', Object.entries(labels), row?.interval ?? 1)) +
      '</div>';
    html +=
      '<div class="form-row">' +
      field(
        'Betalingsdag i måneden',
        input(
          'paymentDay',
          row?.paymentDay ?? 1,
          'type="number" min="1" max="31" step="1" required',
        ),
        'Ved korte måneder bruges månedens sidste dag.',
      ) +
      field(
        'Budgetkategori',
        input(
          'categoryName',
          state.categories.find((c) => c.id === row?.categoryId)?.name ?? '',
          'type="text" list="budget-categories" maxlength="120" placeholder="Vælg eller skriv en ny kategori" autocomplete="off"',
        ) +
          '<datalist id="budget-categories">' +
          state.categories.map((c) => '<option value="' + esc(c.name) + '"></option>').join('') +
          '</datalist>',
        'Vælg en eksisterende kategori, eller skriv et nyt navn. En ny kategori oprettes sammen med budgetposten. Lad feltet være tomt for ingen kategori.',
      ) +
      '</div>';
    html += field(
      'Hvordan indgår udgiften i budgettet?',
      select(
        'mode',
        [
          ['monthly', 'Fordelt pr. måned'],
          ['due', 'Kun i betalingsmåneden'],
        ],
        row?.mode ?? 'monthly',
      ),
      'En årlig regning på 12.000 kr. bliver enten 1.000 kr. pr. måned eller 12.000 kr. i betalingsmåneden.',
    );
    html += field(
      'Første måned / første betalingsmåned',
      input(
        'startMonth',
        row?.startMonth ?? month,
        'type="month" min="2000-01" max="2199-12" required',
      ),
      'Intervallet regnes fra denne måned. Beløbsændringer gemmes i den valgte månedsversion og ændrer ikke tidligere måneder.',
    );
  }
  $('#fields').innerHTML = html;
  $('#form-error').textContent = '';
  if (kind === 'items') {
    const updateOwner = () => {
      const form = $('#edit-form');
      const account = state.accounts.find((a) => a.id === form.elements.accountId.value);
      const person = form.elements.personId;
      const personal = form.elements.kind.value === 'personal';
      if (personal && account?.ownerId) person.value = account.ownerId;
      person.disabled = !personal || Boolean(account?.ownerId);
      person.required = personal;
    };
    $('#edit-form').elements.accountId.addEventListener('change', updateOwner);
    $('#edit-form').elements.kind.addEventListener('change', updateOwner);
    updateOwner();
  }
  if (kind === 'accounts') {
    const updateIcon = () => {
      const f = $('#edit-form').elements;
      $('#account-icon-preview').src =
        './icons/' +
        resolvedIcon({ icon: f.icon.value || 'auto', ownerId: f.ownerId.value || null }) +
        '.svg';
    };
    $('#edit-form').elements.icon.addEventListener('change', updateIcon);
    $('#edit-form').elements.ownerId.addEventListener('change', updateIcon);
    updateIcon();
  }
  if (kind === 'people') {
    const updateAllocation = () => {
      $('#edit-form').elements.value.disabled =
        $('#edit-form').elements.allocation.value === 'auto';
    };
    $('#edit-form').elements.allocation.addEventListener('change', updateAllocation);
    updateAllocation();
  }
  $('#editor').showModal();
}
$('#edit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const f = $('#edit-form').elements;
    const { kind, id } = editing;
    let row = { id, name: f.name.value.trim() };
    if (kind === 'people')
      row = {
        ...row,
        income: amount(f.income.value),
        allocation: f.allocation.value,
        value: f.allocation.value === 'auto' ? 0 : amount(f.value.value),
      };
    if (kind === 'accounts') {
      row.ownerId = f.ownerId.value || null;
      row.icon = f.icon.value || 'auto';
    }
    if (kind === 'items')
      row = {
        ...row,
        amount: amount(f.amount.value),
        kind: f.kind.value,
        accountId: f.accountId.value,
        personId: f.kind.value === 'personal' ? f.personId.value : null,
        interval: Number(f.interval.value),
        mode: f.mode.value,
        startMonth: f.startMonth.value,
        paymentDay: Number(f.paymentDay.value),
        categoryId: null,
      };
    const copy = structuredClone(state);
    const index = copy[kind].findIndex((r) => r.id === id);
    if (kind === 'items') {
      const categoryName = f.categoryName.value.trim();
      if (categoryName) {
        let category = copy.categories.find(
          (c) => c.name.toLocaleLowerCase('da-DK') === categoryName.toLocaleLowerCase('da-DK'),
        );
        if (!category) {
          category = { id: crypto.randomUUID(), name: categoryName };
          copy.categories.push(category);
        }
        row.categoryId = category.id;
      }
    }
    if (kind === 'items' && index >= 0) {
      const previous = copy.items[index];
      if (
        previous.paymentDay !== row.paymentDay ||
        previous.startMonth !== row.startMonth ||
        previous.interval !== row.interval
      )
        copy.payments = copy.payments.filter((itemId) => itemId !== id);
    }
    if (index < 0) copy[kind].push(row);
    else copy[kind][index] = row;
    if (busy || loaded.closed) throw new Error('Vent, til den igangværende handling er færdig.');
    state = validateBudget(copy);
    dirty = true;
    errorMessage = '';
    $('#editor').close();
    render();
    void save();
  } catch (error) {
    $('#form-error').textContent = error.message;
  }
});
$('#cancel').addEventListener('click', () => $('#editor').close());
$('#cancel-x').addEventListener('click', () => $('#editor').close());
$('#month').addEventListener('change', (event) => load(event.target.value));
function stepMonth(delta) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  load(d.toISOString().slice(0, 7));
}
$('#prev').addEventListener('click', () => stepMonth(-1));
$('#next').addEventListener('click', () => stepMonth(1));
document.querySelectorAll('[data-tab]').forEach((button) =>
  button.addEventListener('click', async () => {
    if (busy || !loaded) return;
    tab = button.dataset.tab;
    $('#navigation-menu').open = false;
    render();
    if (tab === 'ledger') {
      try {
        ledger = await api(`ledger?year=${month.slice(0, 4)}`);
        render();
      } catch (error) {
        errorMessage = error.message;
        render();
      }
    }
  }),
);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#navigation-menu').open) {
    $('#navigation-menu').open = false;
    $('#navigation-toggle').focus();
  }
});
window.addEventListener('click', (event) => {
  const menu = $('#navigation-menu');
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
window.addEventListener('beforeunload', (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});
$('#month').value = month;
load(month);

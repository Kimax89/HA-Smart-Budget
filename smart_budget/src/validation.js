import { BudgetError, accountIcons } from './model.js';

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BudgetError('Hver person, konto, kategori og post skal være et objekt.');
}

export function validMonth(value) {
  if (typeof value !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value))
    throw new BudgetError('Vælg en måned mellem år 2000 og 2199.');
  return value;
}
const fail = (message) => {
  throw new BudgetError(message);
};
const money = (n, label) => {
  if (!Number.isSafeInteger(n) || n > 100_000_000_000 || n < 0)
    fail(`${label} skal være et gyldigt beløb i hele øre.`);
  return n;
};
const name = (n) => {
  if (typeof n !== 'string' || !n.trim() || n.length > 120)
    fail('Navne skal være mellem 1 og 120 tegn.');
  return n.trim();
};
const id = (n) => {
  if (typeof n !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(n)) fail('Ugyldigt id.');
  return n;
};
function unique(rows) {
  if (new Set(rows.map((r) => r.id)).size !== rows.length) fail('To poster har samme id.');
}
export function validateBudget(raw) {
  if (
    !raw ||
    !Array.isArray(raw.people) ||
    !Array.isArray(raw.accounts) ||
    !Array.isArray(raw.items)
  )
    fail('Budgettet skal indeholde personer, konti og poster.');
  if (raw.people.length > 100 || raw.accounts.length > 200 || raw.items.length > 2000)
    fail('Budgettet er for stort.');
  const people = raw.people.map((p) => {
    record(p);
    if (!['auto', 'percent', 'fixed'].includes(p.allocation)) fail('Vælg en gyldig fordeling.');
    const result = {
      id: id(p.id),
      name: name(p.name),
      income: money(p.income, 'Indkomst'),
      allocation: p.allocation,
      value: 0,
    };
    if (p.allocation === 'percent') {
      if (!Number.isInteger(p.value) || p.value < 0 || p.value > 10000)
        fail('Andelen skal være mellem 0 og 100 procent.');
      result.value = p.value; // Basis points: 10 percent = 1000.
    }
    if (p.allocation === 'fixed') result.value = money(p.value, 'Fast rådighedsbeløb');
    return result;
  });
  unique(people);
  const personIds = new Set(people.map((p) => p.id));
  const accounts = raw.accounts.map((a) => {
    record(a);
    if (a.ownerId !== null && !personIds.has(a.ownerId))
      fail('Kontoens ejer findes ikke. Fjern eller flyt kontoen først.');
    const icon = a.icon ?? 'auto';
    if (!accountIcons.includes(icon)) fail('Vælg et gyldigt kontoikon.');
    return { id: id(a.id), name: name(a.name), ownerId: a.ownerId, icon };
  });
  unique(accounts);
  if (raw.categories !== undefined && !Array.isArray(raw.categories))
    fail('Kategorier skal være en liste.');
  if ((raw.categories?.length ?? 0) > 500) fail('Der må højst være 500 kategorier.');
  const categories = (raw.categories ?? []).map((c) => {
    record(c);
    return { id: id(c.id), name: name(c.name) };
  });
  unique(categories);
  if (new Set(categories.map((c) => c.name.toLocaleLowerCase('da-DK'))).size !== categories.length)
    fail('En kategori med det navn findes allerede.');
  const categoryIds = new Set(categories.map((c) => c.id));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const items = raw.items.map((i) => {
    record(i);
    const account = accountMap.get(i.accountId);
    if (!account) fail('En post bruger en konto, der ikke findes. Fjern eller flyt posten først.');
    if (!['shared', 'personal'].includes(i.kind)) fail('Vælg fælles eller personlig.');
    if (![1, 2, 6, 12].includes(i.interval)) fail('Vælg et gyldigt betalingsinterval.');
    if (!['monthly', 'due'].includes(i.mode)) fail('Vælg månedlig fordeling eller betalingsmåned.');
    if (i.kind === 'personal' && !personIds.has(i.personId))
      fail('Vælg den person, som den personlige udgift tilhører.');
    if (i.kind === 'personal' && account.ownerId !== null && account.ownerId !== i.personId)
      fail('En personlig udgift på en personlig konto skal tilhøre kontoens ejer.');
    const paymentDay = i.paymentDay ?? 1;
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)
      fail('Betalingsdag skal være et helt tal fra 1 til 31.');
    const categoryId = i.categoryId ?? null;
    if (categoryId !== null && !categoryIds.has(categoryId))
      fail('En post bruger en kategori, der ikke findes. Flyt posten til en anden kategori først.');
    return {
      id: id(i.id),
      name: name(i.name),
      amount: money(i.amount, 'Udgift'),
      accountId: account.id,
      kind: i.kind,
      personId: i.kind === 'personal' ? i.personId : null,
      interval: i.interval,
      mode: i.mode,
      startMonth: validMonth(i.startMonth),
      paymentDay,
      categoryId,
    };
  });
  unique(items);
  if (raw.payments !== undefined && !Array.isArray(raw.payments))
    fail('Betalingsregistreringer skal være en liste.');
  const itemIds = new Set(items.map((i) => i.id));
  const payments = (raw.payments ?? []).map((value) => {
    if (!itemIds.has(value)) fail('Betalingsregistreringen bruger en post, der ikke findes.');
    return id(value);
  });
  if (new Set(payments).size !== payments.length) fail('En betaling er registreret flere gange.');
  return { people, accounts, items, categories, payments };
}

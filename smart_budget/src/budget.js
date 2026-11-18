export class BudgetError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const emptyBudget = () => ({ people: [], accounts: [], items: [], categories: [], payments: [] });
export function validMonth(value) {
  if (typeof value !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value))
    throw new BudgetError('Vælg en måned mellem år 2000 og 2199.');
  return value;
}
const fail = message => { throw new BudgetError(message); };
const floorDiv = (n, d) => n >= 0n ? n / d : -((-n + d - 1n) / d);
const money = (n, label, negative = false) => {
  if (!Number.isSafeInteger(n) || n > 100_000_000_000 || n < (negative ? -100_000_000_000 : 0))
    fail(`${label} skal være et gyldigt beløb i hele øre.`);
  return n;
};
const name = n => {
  if (typeof n !== 'string' || !n.trim() || n.length > 120) fail('Navne skal være mellem 1 og 120 tegn.');
  return n.trim();
};
const id = n => {
  if (typeof n !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(n)) fail('Ugyldigt id.');
  return n;
};
function unique(rows) {
  if (new Set(rows.map(r => r.id)).size !== rows.length) fail('To poster har samme id.');
}
export function validateBudget(raw) {
  if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.accounts) || !Array.isArray(raw.items))
    fail('Budgettet skal indeholde personer, konti og poster.');
  if (raw.people.length > 100 || raw.accounts.length > 200 || raw.items.length > 2000) fail('Budgettet er for stort.');
  const people = raw.people.map(p => {
    if (!['auto', 'percent', 'fixed'].includes(p.allocation)) fail('Vælg en gyldig fordeling.');
    const result = { id: id(p.id), name: name(p.name), income: money(p.income, 'Indkomst'), allocation: p.allocation, value: 0 };
    if (p.allocation === 'percent') {
      if (!Number.isInteger(p.value) || p.value < 0 || p.value > 10000) fail('Andelen skal være mellem 0 og 100 procent.');
      result.value = p.value; // Basis points: 10 percent = 1000.
    }
    if (p.allocation === 'fixed') result.value = money(p.value, 'Fast rådighedsbeløb');
    return result;
  });
  unique(people);
  const personIds = new Set(people.map(p => p.id));
  const accounts = raw.accounts.map(a => {
    if (a.ownerId !== null && !personIds.has(a.ownerId)) fail('Kontoens ejer findes ikke. Fjern eller flyt kontoen først.');
    return { id: id(a.id), name: name(a.name), ownerId: a.ownerId };
  });
  unique(accounts);
  if (raw.categories !== undefined && !Array.isArray(raw.categories)) fail('Kategorier skal være en liste.');
  if ((raw.categories?.length ?? 0) > 500) fail('Der må højst være 500 kategorier.');
  const categories = (raw.categories ?? []).map(c => ({ id: id(c.id), name: name(c.name) }));
  unique(categories);
  if (new Set(categories.map(c => c.name.toLocaleLowerCase('da-DK'))).size !== categories.length)
    fail('En kategori med det navn findes allerede.');
  const categoryIds = new Set(categories.map(c => c.id));
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const items = raw.items.map(i => {
    const account = accountMap.get(i.accountId);
    if (!account) fail('En post bruger en konto, der ikke findes. Fjern eller flyt posten først.');
    if (!['shared', 'personal'].includes(i.kind)) fail('Vælg fælles eller personlig.');
    if (![1, 2, 6, 12].includes(i.interval)) fail('Vælg et gyldigt betalingsinterval.');
    if (!['monthly', 'due'].includes(i.mode)) fail('Vælg månedlig fordeling eller betalingsmåned.');
    if (i.kind === 'personal' && !personIds.has(i.personId)) fail('Vælg den person, som den personlige udgift tilhører.');
    if (i.kind === 'personal' && account.ownerId !== null && account.ownerId !== i.personId)
      fail('En personlig udgift på en personlig konto skal tilhøre kontoens ejer.');
    const paymentDay = i.paymentDay ?? 1;
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) fail('Betalingsdag skal være et helt tal fra 1 til 31.');
    const categoryId = i.categoryId ?? null;
    if (categoryId !== null && !categoryIds.has(categoryId)) fail('En post bruger en kategori, der ikke findes. Flyt posten til en anden kategori først.');
    return { id: id(i.id), name: name(i.name), amount: money(i.amount, 'Udgift'), accountId: account.id,
      kind: i.kind, personId: i.kind === 'personal' ? i.personId : null,
      interval: i.interval, mode: i.mode, startMonth: validMonth(i.startMonth), paymentDay, categoryId };
  });
  unique(items);
  if (raw.payments !== undefined && !Array.isArray(raw.payments)) fail('Betalingsregistreringer skal være en liste.');
  const itemIds = new Set(items.map(i => i.id));
  const payments = (raw.payments ?? []).map(value => {
    if (!itemIds.has(value)) fail('Betalingsregistreringen bruger en post, der ikke findes.');
    return id(value);
  });
  if (new Set(payments).size !== payments.length) fail('En betaling er registreret flere gange.');
  return { people, accounts, items, categories, payments };
}
const monthIndex = m => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1;
export function danishDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function paymentInfo(item, month, payments = [], today = danishDate()) {
  validMonth(month);
  const elapsed = monthIndex(month) - monthIndex(item.startMonth);
  if (elapsed < 0 || elapsed % item.interval !== 0) return { dueDate: null, paymentStatus: null };
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const dueDate = `${month}-${String(Math.min(item.paymentDay ?? 1, lastDay)).padStart(2, '0')}`;
  return { dueDate, paymentStatus: payments.includes(item.id) ? 'paid' : dueDate < today ? 'overdue' : 'upcoming' };
}
export function itemAmount(item, month) {
  const elapsed = monthIndex(month) - monthIndex(item.startMonth);
  if (elapsed < 0) return 0;
  if (item.mode === 'due') return elapsed % item.interval === 0 ? item.amount : 0;
  // Distribute the leftover cents across the cycle; every cycle totals exactly the bill.
  return Math.floor(item.amount / item.interval) + (elapsed % item.interval < item.amount % item.interval ? 1 : 0);
}
function divide(total, count) {
  if (!count) return [];
  const base = Math.floor(total / count), extra = total - base * count;
  return Array.from({ length: count }, (_, n) => base + (n < extra ? 1 : 0));
}
export function calculate(raw, month, today = danishDate()) {
  validMonth(month);
  const budget = validateBudget(raw);
  const accounts = new Map(budget.accounts.map(a => [a.id, a]));
  const lines = budget.items.map(i => ({ ...i, monthlyAmount: itemAmount(i, month), ...paymentInfo(i, month, budget.payments, today) }));
  const income = budget.people.reduce((n, p) => n + p.income, 0);
  const sharedExpenses = lines.filter(i => i.kind === 'shared').reduce((n, i) => n + i.monthlyAmount, 0);
  const pool = income - sharedExpenses;
  const errors = [];
  if (!budget.people.length) errors.push('Tilføj mindst én person.');
  const percentages = budget.people.filter(p => p.allocation === 'percent');
  const fixed = budget.people.filter(p => p.allocation === 'fixed');
  const automatic = budget.people.filter(p => p.allocation === 'auto');
  const percentSum = percentages.reduce((n, p) => n + p.value, 0);
  const fixedSum = fixed.reduce((n, p) => n + p.value, 0);
  if (percentSum > 10000) errors.push('Procentandelene må højst være 100 %.');
  const targets = new Map(fixed.map(p => [p.id, p.value]));
  // Largest remainder avoids losing cents when explicit percentages total 100%.
  const denominator = 10000n;
  const percentageTotal = Number(floorDiv(BigInt(pool) * BigInt(percentSum) + 5000n, denominator));
  const percentageRows = percentages.map(p => {
    const product = BigInt(pool) * BigInt(p.value);
    const base = floorDiv(product, denominator);
    return { id: p.id, base: Number(base), remainder: Number(product - base * denominator) };
  });
  const missing = percentageTotal - percentageRows.reduce((n, p) => n + p.base, 0);
  const rank = [...percentageRows].sort((a, b) => b.remainder - a.remainder);
  const extras = new Set(rank.slice(0, missing).map(p => p.id));
  percentageRows.forEach(p => targets.set(p.id, p.base + Number(extras.has(p.id))));
  const remainder = pool - percentageTotal - fixedSum;
  if (pool >= 0 && remainder < 0) errors.push('De valgte andele og faste beløb overstiger rådighedspuljen.');
  if (!automatic.length && remainder !== 0) errors.push('Fordelingen skal bruge hele puljen. Vælg automatisk rest til mindst én person, eller ret andelene.');
  const automaticAmounts = divide(remainder, automatic.length);
  automatic.forEach((p, n) => targets.set(p.id, automaticAmounts[n]));
  const people = budget.people.map(p => {
    const ownShared = lines.filter(i => i.kind === 'shared' && accounts.get(i.accountId).ownerId === p.id).reduce((n, i) => n + i.monthlyAmount, 0);
    const personal = lines.filter(i => i.kind === 'personal' && i.personId === p.id).reduce((n, i) => n + i.monthlyAmount, 0);
    const before = targets.get(p.id) ?? 0;
    // Personal bills paid from a shared account must also be funded by their owner.
    const sharedAccountPersonal = lines.filter(i => i.kind === 'personal' && i.personId === p.id && accounts.get(i.accountId).ownerId === null).reduce((n, i) => n + i.monthlyAmount, 0);
    return { id: p.id, name: p.name, income: p.income, ownShared, personal, before, after: before - personal,
      transfer: p.income - ownShared - before + sharedAccountPersonal };
  });
  const accountTotals = budget.accounts.map(a => ({ ...a,
    shared: lines.filter(i => i.accountId === a.id && i.kind === 'shared').reduce((n, i) => n + i.monthlyAmount, 0),
    personal: lines.filter(i => i.accountId === a.id && i.kind === 'personal').reduce((n, i) => n + i.monthlyAmount, 0) }));
  const sharedAccountNeed = accountTotals.filter(a => a.ownerId === null).reduce((n, a) => n + a.shared + a.personal, 0);
  const warnings = [];
  if (pool < 0) warnings.push('De fælles udgifter overstiger indtægterne. Budgettet har underskud.');
  if (people.some(p => p.transfer < 0)) warnings.push('Et negativt overførselsbeløb betyder, at personen skal modtage penge fra fællespuljen.');
  return { month, income, sharedExpenses, pool, people, lines, accounts: accountTotals, sharedAccountNeed, errors, warnings };
}

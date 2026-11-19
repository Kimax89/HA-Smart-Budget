import { validateBudget, validMonth } from './validation.js';
import { danishDate, itemAmount, paymentInfo } from './payments.js';
export { BudgetError, emptyBudget, accountIcons } from './model.js';
export { validateBudget, validMonth } from './validation.js';
export { danishDate, itemAmount, paymentInfo } from './payments.js';

// BigInt division must round down, including when the household pool is negative.
const floorDiv = (n, d) => (n >= 0n ? n / d : -((-n + d - 1n) / d));

function divide(total, count) {
  if (!count) return [];
  const base = Math.floor(total / count),
    extra = total - base * count;
  return Array.from({ length: count }, (_, n) => base + (n < extra ? 1 : 0));
}
function allocateDisposable(people, pool) {
  const errors = [];
  if (!people.length) errors.push('Tilføj mindst én person.');
  const percentages = people.filter((p) => p.allocation === 'percent');
  const fixed = people.filter((p) => p.allocation === 'fixed');
  const automatic = people.filter((p) => p.allocation === 'auto');
  const percentSum = percentages.reduce((n, p) => n + p.value, 0);
  const fixedSum = fixed.reduce((n, p) => n + p.value, 0);
  if (percentSum > 10000) errors.push('Procentandelene må højst være 100 %.');
  const targets = new Map(fixed.map((p) => [p.id, p.value]));
  // Largest remainder avoids losing cents when explicit percentages total 100%.
  const denominator = 10000n;
  const percentageTotal = Number(floorDiv(BigInt(pool) * BigInt(percentSum) + 5000n, denominator));
  const percentageRows = percentages.map((p) => {
    const product = BigInt(pool) * BigInt(p.value);
    const base = floorDiv(product, denominator);
    return { id: p.id, base: Number(base), remainder: Number(product - base * denominator) };
  });
  const missing = percentageTotal - percentageRows.reduce((n, p) => n + p.base, 0);
  const rank = [...percentageRows].sort((a, b) => b.remainder - a.remainder);
  const extras = new Set(rank.slice(0, missing).map((p) => p.id));
  percentageRows.forEach((p) => targets.set(p.id, p.base + Number(extras.has(p.id))));
  const remainder = pool - percentageTotal - fixedSum;
  if (pool >= 0 && remainder < 0)
    errors.push('De valgte andele og faste beløb overstiger rådighedspuljen.');
  if (!automatic.length && remainder !== 0)
    errors.push(
      'Fordelingen skal bruge hele puljen. Vælg automatisk rest til mindst én person, eller ret andelene.',
    );
  const automaticAmounts = divide(remainder, automatic.length);
  automatic.forEach((p, n) => targets.set(p.id, automaticAmounts[n]));
  return { targets, errors };
}

export function calculate(raw, month, today = danishDate()) {
  validMonth(month);
  const budget = validateBudget(raw);
  const accounts = new Map(budget.accounts.map((a) => [a.id, a]));
  const lines = budget.items.map((i) => ({
    ...i,
    monthlyAmount: itemAmount(i, month),
    ...paymentInfo(i, month, budget.payments, today),
  }));
  const income = budget.people.reduce((n, p) => n + p.income, 0);
  const sharedExpenses = lines
    .filter((i) => i.kind === 'shared')
    .reduce((n, i) => n + i.monthlyAmount, 0);
  const pool = income - sharedExpenses;
  const { targets, errors } = allocateDisposable(budget.people, pool);
  const people = budget.people.map((p) => {
    const ownShared = lines
      .filter((i) => i.kind === 'shared' && accounts.get(i.accountId).ownerId === p.id)
      .reduce((n, i) => n + i.monthlyAmount, 0);
    const personal = lines
      .filter((i) => i.kind === 'personal' && i.personId === p.id)
      .reduce((n, i) => n + i.monthlyAmount, 0);
    const before = targets.get(p.id) ?? 0;
    // Personal bills paid from a shared account must also be funded by their owner.
    const sharedAccountPersonal = lines
      .filter(
        (i) =>
          i.kind === 'personal' &&
          i.personId === p.id &&
          accounts.get(i.accountId).ownerId === null,
      )
      .reduce((n, i) => n + i.monthlyAmount, 0);
    return {
      id: p.id,
      name: p.name,
      income: p.income,
      ownShared,
      personal,
      before,
      after: before - personal,
      transfer: p.income - ownShared - before + sharedAccountPersonal,
    };
  });
  const accountTotals = budget.accounts.map((a) => ({
    ...a,
    shared: lines
      .filter((i) => i.accountId === a.id && i.kind === 'shared')
      .reduce((n, i) => n + i.monthlyAmount, 0),
    personal: lines
      .filter((i) => i.accountId === a.id && i.kind === 'personal')
      .reduce((n, i) => n + i.monthlyAmount, 0),
  }));
  const sharedAccountNeed = accountTotals
    .filter((a) => a.ownerId === null)
    .reduce((n, a) => n + a.shared + a.personal, 0);
  const warnings = [];
  if (pool < 0)
    warnings.push('De fælles udgifter overstiger indtægterne. Budgettet har underskud.');
  if (people.some((p) => p.transfer < 0))
    warnings.push(
      'Et negativt overførselsbeløb betyder, at personen skal modtage penge fra fællespuljen.',
    );
  return {
    month,
    income,
    sharedExpenses,
    pool,
    people,
    lines,
    accounts: accountTotals,
    sharedAccountNeed,
    errors,
    warnings,
  };
}

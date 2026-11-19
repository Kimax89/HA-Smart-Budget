import { validMonth } from './validation.js';

const monthIndex = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1;
export function danishDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Copenhagen',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function paymentInfo(item, month, payments = [], today = danishDate()) {
  validMonth(month);
  const elapsed = monthIndex(month) - monthIndex(item.startMonth);
  if (elapsed < 0 || elapsed % item.interval !== 0) return { dueDate: null, paymentStatus: null };
  const lastDay = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();
  const dueDate = `${month}-${String(Math.min(item.paymentDay ?? 1, lastDay)).padStart(2, '0')}`;
  return {
    dueDate,
    paymentStatus: payments.includes(item.id) ? 'paid' : dueDate < today ? 'overdue' : 'upcoming',
  };
}
export function itemAmount(item, month) {
  const elapsed = monthIndex(month) - monthIndex(item.startMonth);
  if (elapsed < 0) return 0;
  if (item.mode === 'due') return elapsed % item.interval === 0 ? item.amount : 0;
  // Distribute the leftover cents across the cycle; every cycle totals exactly the bill.
  return (
    Math.floor(item.amount / item.interval) +
    (elapsed % item.interval < item.amount % item.interval ? 1 : 0)
  );
}

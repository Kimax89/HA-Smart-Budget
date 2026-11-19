export class BudgetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const emptyBudget = () => ({
  people: [],
  accounts: [],
  items: [],
  categories: [],
  payments: [],
});
export const accountIcons = [
  'auto',
  'house',
  'user',
  'users',
  'wallet',
  'piggy-bank',
  'landmark',
  'credit-card',
  'car',
  'shopping-cart',
  'briefcase',
];

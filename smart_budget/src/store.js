import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { BudgetError, calculate, emptyBudget, validMonth, validateBudget } from './budget.js';

export class BudgetStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS months (
        month TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
        closed INTEGER NOT NULL DEFAULT 0, snapshot TEXT, updated_at TEXT NOT NULL
      ); PRAGMA user_version=1;`);
  }
  get(month) {
    validMonth(month);
    const row = this.db.prepare('SELECT * FROM months WHERE month <= ? ORDER BY month DESC LIMIT 1').get(month);
    const direct = row?.month === month;
    const state = row ? JSON.parse(row.state) : emptyBudget();
    const revision = createHash('sha256').update(`${month}:${row?.month ?? ''}:${row?.revision ?? 0}`).digest('hex');
    return { month, state, revision, sourceMonth: row?.month ?? null, saved: direct,
      closed: Boolean(direct && row.closed), updatedAt: direct ? row.updated_at : null,
      result: direct && row.closed ? JSON.parse(row.snapshot) : calculate(state, month) };
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = action(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  save(month, state, revision) {
    return this.transaction(() => {
      const current = this.get(month);
      if (current.closed) throw new BudgetError('Måneden er afsluttet. Genåbn den før ændringer.', 423);
      if (current.revision !== revision) throw new BudgetError('Budgettet er ændret i en anden fane. Genindlæs måneden før du gemmer.', 409);
      const clean = validateBudget(state);
      this.db.prepare(`INSERT INTO months(month,state,updated_at) VALUES (?,?,?)
        ON CONFLICT(month) DO UPDATE SET state=excluded.state, revision=months.revision+1, updated_at=excluded.updated_at`)
        .run(month, JSON.stringify(clean), new Date().toISOString());
      return this.get(month);
    });
  }
  setClosed(month, closed, revision) {
    return this.transaction(() => {
      const current = this.get(month);
      if (current.revision !== revision) throw new BudgetError('Måneden er ændret. Genindlæs og prøv igen.', 409);
      if (current.closed === closed) return current;
      if (closed && current.result.errors.length) throw new BudgetError(current.result.errors.join(' '));
      this.db.prepare(`INSERT INTO months(month,state,closed,snapshot,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(month) DO UPDATE SET closed=excluded.closed,snapshot=excluded.snapshot,
        revision=months.revision+1,updated_at=excluded.updated_at`)
        .run(month, JSON.stringify(current.state), Number(closed), closed ? JSON.stringify(current.result) : null, new Date().toISOString());
      return this.get(month);
    });
  }
  ledger(year) {
    if (!/^2[01]\d{2}$/.test(year)) throw new BudgetError('Ugyldigt år.');
    const months = this.db.prepare('SELECT month,snapshot FROM months WHERE closed=1 AND month LIKE ? ORDER BY month').all(`${year}-%`)
      .map(row => JSON.parse(row.snapshot));
    return { year, months, totals: months.reduce((t, m) => ({ income: t.income + m.income,
      sharedExpenses: t.sharedExpenses + m.sharedExpenses, pool: t.pool + m.pool }), { income: 0, sharedExpenses: 0, pool: 0 }) };
  }
  close() { this.db.close(); }
}

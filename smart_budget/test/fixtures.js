export function fixture() {
  return {
    people: [
      { id: 'a', name: 'Person A', income: 3_000_000, allocation: 'auto', value: 0 },
      { id: 'b', name: 'Person B', income: 2_000_000, allocation: 'auto', value: 0 }
    ],
    accounts: [{ id: 'a-account', name: 'Privat A', ownerId: 'a' }, { id: 'b-account', name: 'Privat B', ownerId: 'b' }, { id: 'shared', name: 'Husholdning', ownerId: null }],
    items: [
      { id: 'one', name: 'Fælles regning A', amount: 300_000, accountId: 'a-account', kind: 'shared', personId: null, interval: 1, mode: 'monthly', startMonth: '2030-01' },
      { id: 'two', name: 'Fælles regning B', amount: 100_000, accountId: 'b-account', kind: 'shared', personId: null, interval: 1, mode: 'monthly', startMonth: '2030-01' },
      { id: 'three', name: 'Fælles regning', amount: 1_600_000, accountId: 'shared', kind: 'shared', personId: null, interval: 1, mode: 'monthly', startMonth: '2030-01' },
      { id: 'four', name: 'Personlig regning', amount: 50_000, accountId: 'a-account', kind: 'personal', personId: 'a', interval: 1, mode: 'monthly', startMonth: '2030-01' }
    ]
  };
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetError } from './model.js';

export function validateIngressAccess(value = 'all') {
  if (!['all', 'admins', 'admins_edit'].includes(value))
    throw new Error('ingress_access skal være all, admins eller admins_edit.');
  return value;
}

export function readIngressAccess(filename) {
  try {
    const options = JSON.parse(readFileSync(filename, 'utf8'));
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new Error('Ugyldige Home Assistant-indstillinger.');
    const access = validateIngressAccess(options.ingress_access);
    if (options.admins_edit !== undefined && typeof options.admins_edit !== 'boolean')
      throw new Error('admins_edit skal være true eller false.');
    if (access === 'admins') return access;
    return options.admins_edit === true ? 'admins_edit' : access;
  } catch (error) {
    if (error.code === 'ENOENT') return 'all';
    throw error;
  }
}

export function checkIngressAccess(request, ingressOnly, access) {
  if (!ingressOnly) return { canEdit: true, overviewOnly: false };
  const ip = request.socket.remoteAddress?.replace(/^::ffff:/, '');
  if (ip !== '172.30.32.2') throw new BudgetError('Kun adgang gennem Home Assistant Ingress.', 403);
  if (access === 'admins' || access === 'admins_edit') {
    // Supervisor removes client-supplied identity headers before setting these.
    // Trust them only after verifying the actual proxy socket address above.
    const userId = request.headers['x-remote-user-id'];
    const groups = request.headers['x-remote-user-groups'];
    const identified = typeof userId === 'string' && Boolean(userId.trim());
    const administrator =
      identified &&
      typeof groups === 'string' &&
      groups
        .split(',')
        .map((group) => group.trim())
        .includes('system-admin');
    if (access === 'admins_edit' && identified)
      return { canEdit: administrator, overviewOnly: !administrator };
    if (!administrator)
      throw new BudgetError(
        'Smart Budget er begrænset til Home Assistant-administratorer. Hvis din Supervisor ikke sender brugergrupper, opdater den eller vælg Alle brugere i appens konfiguration.',
        403,
      );
  }
  return { canEdit: true, overviewOnly: false };
}

export function checkOverviewRequest(request, pathname, permissions) {
  if (!permissions.overviewOnly || !pathname.startsWith('/api/')) return;
  if (
    request.method === 'GET' &&
    (pathname === '/api/health' || /^\/api\/months\/\d{4}-\d{2}$/.test(pathname))
  )
    return;
  throw new BudgetError('Du har kun læseadgang til Overblikket.', 403);
}

// Read root-owned options before the container drops privileges. Only the
// validated access value is exported; options.json and tokens stay private.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(readIngressAccess(process.argv[2]));
}

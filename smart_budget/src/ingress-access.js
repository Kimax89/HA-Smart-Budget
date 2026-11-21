import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetError } from './model.js';

export function validateIngressAccess(value = 'all') {
  if (!['all', 'admins'].includes(value))
    throw new Error('ingress_access skal være all eller admins.');
  return value;
}

export function readIngressAccess(filename) {
  try {
    const options = JSON.parse(readFileSync(filename, 'utf8'));
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new Error('Ugyldige Home Assistant-indstillinger.');
    return validateIngressAccess(options.ingress_access);
  } catch (error) {
    if (error.code === 'ENOENT') return 'all';
    throw error;
  }
}

export function checkIngressAccess(request, ingressOnly, access) {
  if (!ingressOnly) return;
  const ip = request.socket.remoteAddress?.replace(/^::ffff:/, '');
  if (ip !== '172.30.32.2') throw new BudgetError('Kun adgang gennem Home Assistant Ingress.', 403);
  if (access === 'admins') {
    // Supervisor removes client-supplied identity headers before setting these.
    // Trust them only after verifying the actual proxy socket address above.
    const userId = request.headers['x-remote-user-id'];
    const groups = request.headers['x-remote-user-groups'];
    if (
      typeof userId !== 'string' ||
      !userId.trim() ||
      typeof groups !== 'string' ||
      !groups
        .split(',')
        .map((group) => group.trim())
        .includes('system-admin')
    )
      throw new BudgetError(
        'Smart Budget er begrænset til Home Assistant-administratorer. Hvis din Supervisor ikke sender brugergrupper, opdater den eller vælg Alle brugere i appens konfiguration.',
        403,
      );
  }
}

// Read root-owned options before the container drops privileges. Only the
// validated access value is exported; options.json and tokens stay private.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(readIngressAccess(process.argv[2]));
}

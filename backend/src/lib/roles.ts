/**
 * User roles and normalization for WAIGO B2B hierarchy.
 *
 * Canonical roles: FREE, ADMIN, RSM, DISTRIBUTOR_REP, DIRECT_USER, BASIC_USER.
 * Legacy enum values (TURNKEY, BASIC, DISTRIBUTOR) are normalized to new names
 * so existing DB rows work until migration is run.
 */

export const ROLES = {
  FREE: 'FREE',
  ADMIN: 'ADMIN',
  RSM: 'RSM',
  DISTRIBUTOR_REP: 'DISTRIBUTOR_REP',
  DIRECT_USER: 'DIRECT_USER',
  BASIC_USER: 'BASIC_USER',
} as const;

export type CanonicalRole = keyof typeof ROLES;

const LEGACY_TO_CANONICAL: Record<string, CanonicalRole> = {
  TURNKEY: 'DIRECT_USER',
  BASIC: 'BASIC_USER',
  DISTRIBUTOR: 'DISTRIBUTOR_REP',
};

/** Normalize role for permission checks (supports legacy enum values). */
export function effectiveRole(role: string): string {
  return LEGACY_TO_CANONICAL[role] ?? role;
}

/** Internal manufacturer roles (Admin, RSM). */
export function isInternal(role: string): boolean {
  const r = effectiveRole(role);
  return r === 'ADMIN' || r === 'RSM';
}

/** Can manage hierarchy: Admin, RSM, Distributor rep. */
export function canManageHierarchy(role: string): boolean {
  const r = effectiveRole(role);
  return r === 'ADMIN' || r === 'RSM' || r === 'DISTRIBUTOR_REP';
}

/** Can access sales dashboard (RSM, Admin). */
export function canAccessSales(role: string): boolean {
  const r = effectiveRole(role);
  return r === 'ADMIN' || r === 'RSM';
}

/** Can manage pricing contracts (Direct, Distributor rep, RSM, Admin). */
export function canManagePricingContracts(role: string): boolean {
  const r = effectiveRole(role);
  return r === 'ADMIN' || r === 'RSM' || r === 'DISTRIBUTOR_REP' || r === 'DIRECT_USER';
}

/** Can access cost tables / price contracts (same as pricing contracts). */
export function canAccessCostTables(role: string): boolean {
  return canManagePricingContracts(role);
}

/** Customer roles (buy through distributor or direct). */
export function isCustomerRole(role: string): boolean {
  const r = effectiveRole(role);
  return r === 'BASIC_USER' || r === 'DIRECT_USER';
}

/** Distributor role. */
export function isDistributorRep(role: string): boolean {
  return effectiveRole(role) === 'DISTRIBUTOR_REP';
}

/** Roles that require login for main app (exclude FREE). */
export function requiresLogin(role: string): boolean {
  return effectiveRole(role) !== 'FREE';
}

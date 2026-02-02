/**
 * Role-based max discount for quotes.
 * Canonical: FREE, BASIC_USER, DIRECT_USER, DISTRIBUTOR_REP, RSM, ADMIN.
 * Legacy (BASIC, TURNKEY, DISTRIBUTOR) supported for backward compat.
 */
export const ROLE_MAX_DISCOUNT: Record<string, number> = {
  FREE: 0,
  BASIC: 10,
  BASIC_USER: 10,
  TURNKEY: 15,
  DIRECT_USER: 15,
  DISTRIBUTOR: 20,
  DISTRIBUTOR_REP: 20,
  RSM: 35,
  ADMIN: 100,
};

/** Normalize legacy role to canonical for display/discount lookup */
export function effectiveRole(role: string): string {
  const map: Record<string, string> = {
    TURNKEY: 'DIRECT_USER',
    BASIC: 'BASIC_USER',
    DISTRIBUTOR: 'DISTRIBUTOR_REP',
  };
  return map[role] ?? role;
}

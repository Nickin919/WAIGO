/**
 * Role-based discount limits have been removed; no max discount is enforced.
 * effectiveRole is still used for UI (e.g. showing discount/margin columns).
 */

/** Normalize legacy role to canonical for display/feature lookup */
export function effectiveRole(role: string): string {
  const map: Record<string, string> = {
    TURNKEY: 'DIRECT_USER',
    BASIC: 'BASIC_USER',
    DISTRIBUTOR: 'DISTRIBUTOR_REP',
  };
  return map[role] ?? role;
}

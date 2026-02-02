/**
 * Role-based maximum discount percentage for quotes.
 * Canonical roles: FREE, BASIC_USER, DIRECT_USER, DISTRIBUTOR_REP, RSM, ADMIN.
 * Legacy (BASIC, TURNKEY, DISTRIBUTOR) are mapped via effectiveRole in controllers.
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

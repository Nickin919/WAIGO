/**
 * Role-based maximum discount percentage for quotes
 */
export const ROLE_MAX_DISCOUNT: Record<string, number> = {
  FREE: 0,
  BASIC: 10,
  TURNKEY: 15,
  DISTRIBUTOR: 20,
  RSM: 35,
  ADMIN: 100,
};

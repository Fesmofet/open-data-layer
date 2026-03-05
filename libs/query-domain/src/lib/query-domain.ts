/**
 * Shared domain logic for query/masking: governance resolution and place rules.
 * Mocked governance: owner, admins, trusted. No global lock; request-time mask.
 */

import type { GovernanceContext } from '@opden-data-layer/query-contracts';

/** Resolve governance mask for request. Mocked: returns the same context (no trust traversal yet). */
export function resolveGovernanceMask(context: GovernanceContext | undefined): GovernanceContext | null {
  if (!context) return null;
  return {
    owner: context.owner,
    admins: [...context.admins],
    trusted: [...context.trusted],
  };
}

/** Object type 'place' supported updates: single name, single map, multiple tags. */
export const PLACE_OBJECT_TYPE = 'place' as const;
export const PLACE_SINGLE_UPDATES = ['name', 'map'] as const;
export const PLACE_MULTI_UPDATES = ['tags'] as const;

export type PlaceSingleUpdate = (typeof PLACE_SINGLE_UPDATES)[number];
export type PlaceMultiUpdate = (typeof PLACE_MULTI_UPDATES)[number];

const PLACE_SINGLE_SET = new Set<string>(PLACE_SINGLE_UPDATES);
const PLACE_MULTI_SET = new Set<string>(PLACE_MULTI_UPDATES);

/** Whether an update type for place is single (one winning value) or multi (array). */
export function isPlaceSingleUpdate(updateType: string): boolean {
  return PLACE_SINGLE_SET.has(updateType);
}

export function isPlaceMultiUpdate(updateType: string): boolean {
  return PLACE_MULTI_SET.has(updateType);
}

/** All supported update types for object_type place. */
export function getPlaceSupportedUpdates(): { single: string[]; multi: string[] } {
  return {
    single: [...PLACE_SINGLE_UPDATES],
    multi: [...PLACE_MULTI_UPDATES],
  };
}

/** Rejection authority precedence: owner > admin > trusted (mocked; full spec constrains trusted by object authority). */
export const REJECTION_AUTHORITY_ORDER = ['owner', 'admin', 'trusted'] as const;

export type FinalStatus = 'VALID' | 'REJECTED';
export type DecisiveRole = 'owner' | 'admin' | 'trusted';

export interface RejectionResolution {
  finalStatus: FinalStatus;
  decisiveRole?: DecisiveRole;
}

/**
 * Resolve decisive validity at query time from governance context and raw voter evidence (rejected_by).
 * Hierarchy: owner wins; else admin; else trusted (mocked: trusted has reject authority without object-authority check).
 * No governance => no decisive rejection => VALID.
 */
export function resolveRejection(
  governance: GovernanceContext | null | undefined,
  rejectedBy: string | null | undefined
): RejectionResolution {
  if (!rejectedBy) return { finalStatus: 'VALID' };
  if (!governance) return { finalStatus: 'VALID' };
  if (governance.owner === rejectedBy) return { finalStatus: 'REJECTED', decisiveRole: 'owner' };
  if (governance.admins?.includes(rejectedBy)) return { finalStatus: 'REJECTED', decisiveRole: 'admin' };
  if (governance.trusted?.includes(rejectedBy)) return { finalStatus: 'REJECTED', decisiveRole: 'trusted' };
  return { finalStatus: 'VALID' };
}

/** Whether to filter out rejected updates when building the result set. Default true = exclude rejected. */
export function shouldExcludeRejected(includeRejected: boolean | undefined): boolean {
  return includeRejected !== true;
}

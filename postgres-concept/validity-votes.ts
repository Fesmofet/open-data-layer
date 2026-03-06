/**
 * One row per validity vote. Table: validity_votes.
 *
 * Position inlined via CanonicalPositionColumns. FK to object_updates ON DELETE CASCADE;
 * replacing an update automatically deletes its votes.
 */

import type { CanonicalPositionColumns, ValidityVoteValue } from './shared-types';

export interface ValidityVoteRow extends CanonicalPositionColumns {
  update_id: string;
  object_id: string;
  voter: string;
  vote: ValidityVoteValue;
}

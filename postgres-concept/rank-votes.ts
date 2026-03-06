/**
 * One row per rank vote. Table: rank_votes.
 *
 * Used for multi-cardinality updates. rank 1..10000 (CHECK in schema).
 * FK to object_updates ON DELETE CASCADE.
 */

import type { CanonicalPositionColumns } from './shared-types';

export interface RankVoteRow extends CanonicalPositionColumns {
  update_id: string;
  object_id: string;
  voter: string;
  rank: number;
  rank_context: string;
}

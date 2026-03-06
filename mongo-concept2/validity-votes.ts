/**
 * One document per validity vote. Collection: validity_votes.
 *
 * Extracted from the v1 embedded updates[].validityVotes[] array.
 * A remove operation is represented by deleting this document.
 */

import type { CanonicalPosition, ValidityVoteValue } from './shared-types';

export interface ValidityVoteDocument {
  updateId: string;
  objectId: string;
  voter: string;
  vote: ValidityVoteValue;
  position: CanonicalPosition;
}

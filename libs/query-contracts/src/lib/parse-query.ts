import type { GovernanceContext, QueryPlacesDto, TextSearchMode } from './query-contracts';

const num = (v: string | string[] | undefined) => (v == null ? undefined : Number(Array.isArray(v) ? v[0] : v));
const str = (v: string | string[] | undefined) => (v == null ? undefined : Array.isArray(v) ? v[0] : v);
const arr = (v: string | string[] | undefined) => (v == null ? undefined : Array.isArray(v) ? v : v ? [v] : undefined);
const bool = (v: string | string[] | undefined) => {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'true' || s === '1';
};

/**
 * Parse flat query params (e.g. minLng, minLat, maxLng, maxLat) into QueryPlacesDto.
 * Used by both query-mongo and query-postgres controllers.
 */
export function parsePlacesQuery(q: Record<string, string | string[] | undefined>): QueryPlacesDto {
  const dto: QueryPlacesDto = {};
  if (num(q.minLng) != null && num(q.minLat) != null && num(q.maxLng) != null && num(q.maxLat) != null) {
    dto.bbox = { minLng: num(q.minLng)!, minLat: num(q.minLat)!, maxLng: num(q.maxLng)!, maxLat: num(q.maxLat)! };
  }
  if (num(q.lng) != null && num(q.lat) != null && num(q.radiusMeters) != null) {
    dto.radius = { lng: num(q.lng)!, lat: num(q.lat)!, radiusMeters: num(q.radiusMeters)! };
  }
  const tags = arr(q.tags);
  if (tags?.length) dto.tags = tags;
  const tagsAny = arr(q.tagsAny);
  if (tagsAny?.length) dto.tagsAny = tagsAny;
  const page = num(q.page);
  if (page != null) dto.page = page;
  const limit = num(q.limit);
  if (limit != null) dto.limit = limit;

  const updateBodyExact = str(q.updateBodyExact);
  if (updateBodyExact != null) dto.updateBodyExact = updateBodyExact;
  const textQuery = str(q.textQuery);
  if (textQuery != null) dto.textQuery = textQuery;
  const textMode = str(q.textMode) as TextSearchMode | undefined;
  if (textMode === 'contains' || textMode === 'fulltext') dto.textMode = textMode;
  const includeRejected = bool(q.includeRejected);
  if (includeRejected != null) dto.includeRejected = includeRejected;
  const governanceActor = str(q.governanceActor);
  if (governanceActor != null) dto.governanceActor = governanceActor;
  const decisionSource = str(q.decisionSource);
  if (decisionSource != null) dto.decisionSource = decisionSource;

  const governance = parseGovernance(q);
  if (governance) dto.governance = governance;
  return dto;
}

/** Parse governance from query (owner, admins, trusted or governance JSON). Used by list and by-id endpoints. */
export function parseGovernance(q: Record<string, string | string[] | undefined>): GovernanceContext | undefined {
  const governanceJson = str(q.governance);
  if (governanceJson) {
    try {
      const parsed = JSON.parse(governanceJson) as { owner?: string; admins?: string[]; trusted?: string[] };
      if (parsed && typeof parsed.owner === 'string') {
        return {
          owner: parsed.owner,
          admins: Array.isArray(parsed.admins) ? parsed.admins : [],
          trusted: Array.isArray(parsed.trusted) ? parsed.trusted : [],
        };
      }
    } catch {
      // ignore
    }
  }
  const owner = str(q.owner);
  const admins = arr(q.admins);
  const trusted = arr(q.trusted);
  if (owner != null) {
    return {
      owner,
      admins: admins ?? [],
      trusted: trusted ?? [],
    };
  }
  return undefined;
}

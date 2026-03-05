import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  GovernanceContext,
  PlaceDto,
  PlaceQueryResult,
  QueryPlacesDto,
} from '@opden-data-layer/query-contracts';
import { PLACE_OBJECT_TYPE, resolveRejection, shouldExcludeRejected } from '@opden-data-layer/query-domain';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class PlacesDecompositionRepository {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async findById(objectId: string, governance?: GovernanceContext): Promise<PlaceDto | null> {
    const objRes = await this.pool.query('SELECT object_id, object_type, creator FROM place_objects WHERE object_id = $1', [objectId]);
    const obj = objRes.rows[0];
    if (!obj) return null;
    const upRes = await this.pool.query(
      'SELECT update_type, value_text, ST_AsGeoJSON(value_geo)::json AS value_geo, value_tags, rejected_by FROM place_updates WHERE object_id = $1',
      [objectId]
    );
    return this.assemblePlace(obj, upRes.rows, governance);
  }

  async query(dto: QueryPlacesDto): Promise<PlaceQueryResult> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(1000, Math.max(1, dto.limit ?? 20));
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let paramIdx = 0;

    let objectIds: string[] = [];
    if (dto.bbox || dto.radius) {
      const geoParams: unknown[] = [];
      let geoCond: string;
      if (dto.bbox) {
        geoCond = `ST_Intersects(value_geo, ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography)`;
        geoParams.push(dto.bbox.minLng, dto.bbox.minLat, dto.bbox.maxLng, dto.bbox.maxLat);
      } else {
        geoCond = `ST_DWithin(value_geo, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`;
        geoParams.push(dto.radius!.lng, dto.radius!.lat, dto.radius!.radiusMeters);
      }
      const res = await this.pool.query(
        `SELECT DISTINCT object_id FROM place_updates WHERE update_type = 'map' AND value_geo IS NOT NULL AND ${geoCond}`,
        geoParams
      );
      objectIds = res.rows.map((r) => r.object_id);
    }
    if (dto.tags?.length || dto.tagsAny?.length) {
      const tagCond = dto.tags?.length ? 'value_tags @> $1::text[]' : 'value_tags && $1::text[]';
      const tagParam = dto.tags ?? dto.tagsAny;
      const res = await this.pool.query(`SELECT DISTINCT object_id FROM place_updates WHERE update_type = 'tags' AND ${tagCond}`, [tagParam]);
      const tagIds = res.rows.map((r) => r.object_id);
      objectIds = objectIds.length ? objectIds.filter((id) => tagIds.includes(id)) : tagIds;
    }
    if (dto.updateBodyExact != null) {
      const res = await this.pool.query(`SELECT DISTINCT object_id FROM place_updates WHERE update_body_exact = $1`, [dto.updateBodyExact]);
      const bodyIds = res.rows.map((r) => r.object_id);
      objectIds = objectIds.length ? objectIds.filter((id) => bodyIds.includes(id)) : bodyIds;
    }
    if (dto.textQuery != null && dto.textQuery.length > 0) {
      let textSql: string;
      const pattern = `%${String(dto.textQuery).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      if (dto.textMode === 'fulltext') {
        textSql = `SELECT DISTINCT object_id FROM place_updates WHERE to_tsvector('simple', COALESCE(value_text, '') || ' ' || COALESCE(body, '')) @@ plainto_tsquery('simple', $1)`;
        const res = await this.pool.query(textSql, [dto.textQuery]);
        const textIds = res.rows.map((r) => r.object_id);
        objectIds = objectIds.length ? objectIds.filter((id) => textIds.includes(id)) : textIds;
      } else {
        textSql = `SELECT DISTINCT object_id FROM place_updates WHERE (value_text ILIKE $1 OR body ILIKE $1)`;
        const res = await this.pool.query(textSql, [pattern]);
        const textIds = res.rows.map((r) => r.object_id);
        objectIds = objectIds.length ? objectIds.filter((id) => textIds.includes(id)) : textIds;
      }
    }
    if (shouldExcludeRejected(dto.includeRejected) && dto.governance) {
      const res = await this.pool.query(
        `SELECT object_id, rejected_by FROM place_updates WHERE update_type = 'name' AND rejected_by IS NOT NULL`
      );
      const rejectedSet = new Set(
        res.rows.filter((r) => resolveRejection(dto.governance, r.rejected_by).finalStatus === 'REJECTED').map((r) => r.object_id)
      );
      objectIds = objectIds.length
        ? objectIds.filter((id) => !rejectedSet.has(id))
        : (await this.pool.query('SELECT object_id FROM place_objects WHERE object_type = $1', [PLACE_OBJECT_TYPE])).rows.map((r) => r.object_id).filter((id) => !rejectedSet.has(id));
    }
    let total: number;
    const hasFilters = !!(dto.bbox || dto.radius || dto.tags?.length || dto.tagsAny?.length || dto.updateBodyExact != null || (dto.textQuery != null && dto.textQuery.length > 0) || shouldExcludeRejected(dto.includeRejected));
    if (!hasFilters) {
      const countRes = await this.pool.query('SELECT COUNT(*)::int AS total FROM place_objects WHERE object_type = $1', [PLACE_OBJECT_TYPE]);
      total = countRes.rows[0]?.total ?? 0;
      const idRes = await this.pool.query('SELECT object_id FROM place_objects WHERE object_type = $1 ORDER BY object_id LIMIT $2 OFFSET $3', [
        PLACE_OBJECT_TYPE,
        limit,
        offset,
      ]);
      objectIds = idRes.rows.map((r) => r.object_id);
    } else {
      objectIds = [...new Set(objectIds)].sort((a, b) => a.localeCompare(b));
      total = objectIds.length;
      objectIds = objectIds.slice(offset, offset + limit);
    }

    const data: PlaceDto[] = [];
    for (const oid of objectIds) {
      const objRes = await this.pool.query('SELECT object_id, object_type, creator FROM place_objects WHERE object_id = $1', [oid]);
      const obj = objRes.rows[0];
      if (!obj) continue;
      const upRes = await this.pool.query(
        'SELECT update_type, value_text, ST_AsGeoJSON(value_geo)::json AS value_geo, value_tags, rejected_by FROM place_updates WHERE object_id = $1',
        [oid]
      );
      data.push(this.assemblePlace(obj, upRes.rows, dto.governance));
    }
    return { data, total };
  }

  private assemblePlace(
    obj: { object_id: string; object_type?: string; creator?: string },
    rows: {
      update_type: string;
      value_text?: string;
      value_geo?: unknown;
      value_tags?: string[];
      rejected_by?: string | null;
    }[],
    governance?: GovernanceContext
  ): PlaceDto {
    let name: string | undefined;
    let map: PlaceDto['map'];
    const tags: string[] = [];
    let rejectedBy: string | undefined;
    for (const r of rows) {
      if (r.update_type === 'name') {
        name = r.value_text ?? undefined;
        if (r.rejected_by != null) rejectedBy = r.rejected_by;
      } else if (r.update_type === 'map' && r.value_geo) {
        const geo = r.value_geo as { type?: string; coordinates?: [number, number] };
        if (geo?.coordinates) map = { type: 'Point', coordinates: geo.coordinates };
      } else if (r.update_type === 'tags' && Array.isArray(r.value_tags)) tags.push(...r.value_tags);
    }
    const resolution = resolveRejection(governance, rejectedBy);
    const dto: PlaceDto = {
      objectId: obj.object_id,
      objectType: obj.object_type ?? PLACE_OBJECT_TYPE,
      creator: obj.creator ?? '',
      name,
      map,
      tags,
    };
    dto.finalStatus = resolution.finalStatus;
    if (resolution.decisiveRole) dto.decisiveRole = resolution.decisiveRole;
    if (rejectedBy) dto.rejectedBy = rejectedBy;
    return dto;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  GovernanceContext,
  PlaceDto,
  PlaceQueryResult,
  QueryPlacesDto,
} from '@opden-data-layer/query-contracts';
import { resolveRejection, shouldExcludeRejected } from '@opden-data-layer/query-domain';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class PlacesCompositionRepository {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async findById(objectId: string, governance?: GovernanceContext): Promise<PlaceDto | null> {
    const res = await this.pool.query(
      `SELECT object_id, object_type, creator, name, ST_AsGeoJSON(map)::json AS map, tags, rejected_by FROM places_read WHERE object_id = $1`,
      [objectId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return this.rowToPlaceDto(row, governance);
  }

  async query(dto: QueryPlacesDto): Promise<PlaceQueryResult> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(1000, Math.max(1, dto.limit ?? 20));
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let paramIdx = 0;
    const conditions: string[] = ['object_type = $' + ++paramIdx];
    params.push('place');

    if (dto.bbox) {
      conditions.push(`ST_Intersects(map, ST_MakeEnvelope($${++paramIdx}, $${++paramIdx}, $${++paramIdx}, $${++paramIdx}, 4326)::geography)`);
      params.push(dto.bbox.minLng, dto.bbox.minLat, dto.bbox.maxLng, dto.bbox.maxLat);
    }
    if (dto.radius) {
      conditions.push(`ST_DWithin(map, ST_SetSRID(ST_MakePoint($${++paramIdx}, $${++paramIdx}), 4326)::geography, $${++paramIdx})`);
      params.push(dto.radius.lng, dto.radius.lat, dto.radius.radiusMeters);
    }
    if (dto.tags?.length) {
      conditions.push(`tags @> $${++paramIdx}::text[]`);
      params.push(dto.tags);
    }
    if (dto.tagsAny?.length) {
      conditions.push(`tags && $${++paramIdx}::text[]`);
      params.push(dto.tagsAny);
    }
    if (dto.updateBodyExact != null) {
      conditions.push(`update_body_exact = $${++paramIdx}`);
      params.push(dto.updateBodyExact);
    }
    if (dto.textQuery != null && dto.textQuery.length > 0) {
      const textParam = ++paramIdx;
      if (dto.textMode === 'fulltext') {
        conditions.push(`to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(body, '')) @@ plainto_tsquery('simple', $${textParam})`);
        params.push(dto.textQuery);
      } else {
        const pattern = `%${String(dto.textQuery).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
        conditions.push(`(name ILIKE $${textParam} OR body ILIKE $${textParam})`);
        params.push(pattern);
      }
    }
    if (shouldExcludeRejected(dto.includeRejected) && dto.governance) {
      const rejectedRes = await this.pool.query(
        `SELECT object_id, rejected_by FROM places_read WHERE rejected_by IS NOT NULL AND ${conditions.join(' AND ')}`,
        params
      );
      const rejectedIds = rejectedRes.rows
        .filter((r) => resolveRejection(dto.governance, r.rejected_by).finalStatus === 'REJECTED')
        .map((r) => r.object_id);
      if (rejectedIds.length) {
        conditions.push(`object_id != ALL($${++paramIdx}::text[])`);
        params.push(rejectedIds);
      }
    }

    const where = conditions.join(' AND ');
    const countRes = await this.pool.query(`SELECT COUNT(*)::int AS total FROM places_read WHERE ${where}`, params);
    const total = countRes.rows[0]?.total ?? 0;
    params.push(limit, offset);
    const dataRes = await this.pool.query(
      `SELECT object_id, object_type, creator, name, ST_AsGeoJSON(map)::json AS map, tags, rejected_by FROM places_read WHERE ${where} ORDER BY object_id LIMIT $${++paramIdx} OFFSET $${++paramIdx}`,
      params
    );
    const data = dataRes.rows.map((r) => this.rowToPlaceDto(r, dto.governance));
    return { data, total };
  }

  private rowToPlaceDto(
    row: {
      object_id: string;
      object_type?: string;
      creator?: string;
      name?: string;
      map?: { type?: string; coordinates?: [number, number] } | null;
      tags?: string[];
      rejected_by?: string | null;
    },
    governance?: GovernanceContext
  ): PlaceDto {
    const map = row.map;
    const rejectedBy = row.rejected_by ?? undefined;
    const resolution = resolveRejection(governance, rejectedBy);
    const dto: PlaceDto = {
      objectId: row.object_id,
      objectType: row.object_type ?? 'place',
      creator: row.creator ?? '',
      name: row.name ?? undefined,
      map: map?.coordinates ? { type: 'Point', coordinates: map.coordinates } : undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
    };
    dto.finalStatus = resolution.finalStatus;
    if (resolution.decisiveRole) dto.decisiveRole = resolution.decisiveRole;
    if (rejectedBy) dto.rejectedBy = rejectedBy;
    return dto;
  }
}

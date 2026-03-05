import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type {
  GovernanceContext,
  PlaceDto,
  PlaceQueryResult,
  QueryPlacesDto,
} from '@opden-data-layer/query-contracts';
import { PLACE_OBJECT_TYPE, resolveRejection, shouldExcludeRejected } from '@opden-data-layer/query-domain';

const OBJECTS_COLL = 'place_objects';
const UPDATES_COLL = 'place_updates';

@Injectable()
export class PlacesDecompositionRepository {
  constructor(@InjectConnection() private conn: Connection) {}

  async findById(objectId: string, governance?: GovernanceContext): Promise<PlaceDto | null> {
    const obj = await this.conn.collection(OBJECTS_COLL).findOne({ objectId });
    if (!obj) return null;
    const updates = await this.conn
      .collection(UPDATES_COLL)
      .find({ objectId })
      .toArray();
    return this.assemblePlace(obj, updates, governance);
  }

  async query(dto: QueryPlacesDto): Promise<PlaceQueryResult> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(1000, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    let objectIds: string[] = [];
    if (dto.bbox || dto.radius) {
      const geoFilter: Record<string, unknown> = { updateType: 'map' };
      if (dto.bbox) {
        geoFilter.value = {
          $geoWithin: {
            $box: [
              [dto.bbox.minLng, dto.bbox.minLat],
              [dto.bbox.maxLng, dto.bbox.maxLat],
            ],
          },
        };
      } else if (dto.radius) {
        geoFilter.value = {
          $geoWithin: {
            $centerSphere: [[dto.radius.lng, dto.radius.lat], dto.radius.radiusMeters / 6378100],
          },
        };
      }
      const cursor = this.conn.collection(UPDATES_COLL).find(geoFilter).project({ objectId: 1 });
      objectIds = (await cursor.toArray()).map((d) => d.objectId as string);
    }
    if (dto.tags?.length || dto.tagsAny?.length) {
      const tagFilter: Record<string, unknown> = { updateType: 'tags' };
      if (dto.tags?.length) tagFilter.value = { $all: dto.tags };
      else if (dto.tagsAny?.length) tagFilter.value = { $in: dto.tagsAny };
      const tagObjectIds = (await this.conn.collection(UPDATES_COLL).find(tagFilter).project({ objectId: 1 }).toArray()).map((d) => d.objectId as string);
      objectIds = objectIds.length ? objectIds.filter((id) => tagObjectIds.includes(id)) : tagObjectIds;
    }
    if (dto.updateBodyExact != null) {
      const bodyIds = (await this.conn.collection(UPDATES_COLL).find({ updateBodyExact: dto.updateBodyExact }).project({ objectId: 1 }).toArray()).map((d) => d.objectId as string);
      objectIds = objectIds.length ? objectIds.filter((id) => bodyIds.includes(id)) : bodyIds;
    }
    if (dto.textQuery != null && dto.textQuery.length > 0) {
      const escaped = dto.textQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const textFilter: Record<string, unknown> =
        dto.textMode === 'fulltext'
          ? { $text: { $search: dto.textQuery } }
          : { $or: [{ value: { $regex: escaped, $options: 'i' } }, { body: { $regex: escaped, $options: 'i' } }] };
      const textIds = (await this.conn.collection(UPDATES_COLL).find(textFilter).project({ objectId: 1 }).toArray()).map((d) => d.objectId as string);
      objectIds = objectIds.length ? objectIds.filter((id) => textIds.includes(id)) : textIds;
    }
    if (shouldExcludeRejected(dto.includeRejected) && dto.governance) {
      const nameRows = await this.conn
        .collection(UPDATES_COLL)
        .find({ updateType: 'name', rejectedBy: { $exists: true, $ne: null } })
        .project({ objectId: 1, rejectedBy: 1 })
        .toArray();
      const rejectedSet = new Set(
        nameRows.filter((d) => resolveRejection(dto.governance, d.rejectedBy).finalStatus === 'REJECTED').map((d) => d.objectId as string)
      );
      objectIds = objectIds.length ? objectIds.filter((id) => !rejectedSet.has(id)) : (await this.conn.collection(OBJECTS_COLL).find({ objectType: PLACE_OBJECT_TYPE }).project({ objectId: 1 }).toArray()).map((d) => d.objectId as string).filter((id) => !rejectedSet.has(id));
    }
    let total: number;
    const hasFilters = !!(dto.bbox || dto.radius || dto.tags?.length || dto.tagsAny?.length || dto.updateBodyExact != null || (dto.textQuery != null && dto.textQuery.length > 0) || shouldExcludeRejected(dto.includeRejected));
    if (!hasFilters) {
      total = await this.conn.collection(OBJECTS_COLL).countDocuments({ objectType: PLACE_OBJECT_TYPE });
      const all = await this.conn
        .collection(OBJECTS_COLL)
        .find({ objectType: PLACE_OBJECT_TYPE })
        .project({ objectId: 1 })
        .sort({ objectId: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      objectIds = all.map((d) => d.objectId as string);
    } else {
      objectIds = [...new Set(objectIds)].sort((a, b) => a.localeCompare(b));
      total = objectIds.length;
      objectIds = objectIds.slice(skip, skip + limit);
    }

    const data: PlaceDto[] = [];
    for (const oid of objectIds) {
      const obj = await this.conn.collection(OBJECTS_COLL).findOne({ objectId: oid });
      if (!obj) continue;
      const updates = await this.conn.collection(UPDATES_COLL).find({ objectId: oid }).toArray();
      data.push(this.assemblePlace(obj, updates, dto.governance));
    }
    return { data, total };
  }

  private assemblePlace(obj: Record<string, unknown>, updates: Record<string, unknown>[], governance?: GovernanceContext): PlaceDto {
    let name: string | undefined;
    let map: PlaceDto['map'];
    const tags: string[] = [];
    let rejectedBy: string | undefined;
    for (const u of updates) {
      const ut = String(u.updateType ?? '');
      const val = u.value;
      if (ut === 'name') {
        name = val != null ? String(val) : undefined;
        if (u.rejectedBy != null) rejectedBy = String(u.rejectedBy);
      } else if (ut === 'map') {
        const v = val as { type?: string; coordinates?: [number, number] } | undefined;
        if (v?.coordinates) map = { type: 'Point', coordinates: v.coordinates };
      } else if (ut === 'tags') {
        if (Array.isArray(val)) tags.push(...(val as string[]));
      }
    }
    const resolution = resolveRejection(governance, rejectedBy);
    const dto: PlaceDto = {
      objectId: String(obj.objectId ?? ''),
      objectType: String(obj.objectType ?? PLACE_OBJECT_TYPE),
      creator: String(obj.creator ?? ''),
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

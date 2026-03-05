import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type {
  GovernanceContext,
  PlaceDto,
  PlaceQueryResult,
  QueryPlacesDto,
} from '@opden-data-layer/query-contracts';
import { resolveRejection, shouldExcludeRejected } from '@opden-data-layer/query-domain';

const COLL = 'places_read';

@Injectable()
export class PlacesCompositionRepository {
  constructor(@InjectConnection() private conn: Connection) {}

  async findById(objectId: string, governance?: GovernanceContext): Promise<PlaceDto | null> {
    const doc = await this.conn.collection(COLL).findOne({ objectId });
    if (!doc) return null;
    return this.toPlaceDto(doc, governance);
  }

  async query(dto: QueryPlacesDto): Promise<PlaceQueryResult> {
    const filter: Record<string, unknown> = { objectType: 'place' };

    if (dto.bbox) {
      filter.map = {
        $geoWithin: {
          $box: [
            [dto.bbox.minLng, dto.bbox.minLat],
            [dto.bbox.maxLng, dto.bbox.maxLat],
          ],
        },
      };
    }
    if (dto.radius) {
      filter.map = {
        $geoWithin: {
          $centerSphere: [[dto.radius.lng, dto.radius.lat], dto.radius.radiusMeters / 6378100],
        },
      };
    }
    if (dto.tags?.length) {
      filter.tags = { $all: dto.tags };
    }
    if (dto.tagsAny?.length) {
      filter.tags = { $in: dto.tagsAny };
    }
    if (dto.updateBodyExact != null) {
      filter.updateBodyExact = dto.updateBodyExact;
    }
    if (dto.textQuery != null && dto.textQuery.length > 0) {
      if (dto.textMode === 'fulltext') {
        filter.$text = { $search: dto.textQuery };
      } else {
        const escaped = dto.textQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { body: { $regex: escaped, $options: 'i' } },
        ];
      }
    }
    if (shouldExcludeRejected(dto.includeRejected) && dto.governance) {
      const withRejection = await this.conn
        .collection(COLL)
        .find({ ...filter, rejectedBy: { $exists: true, $ne: null } })
        .project({ objectId: 1, rejectedBy: 1 })
        .toArray();
      const rejectedIds = withRejection
        .filter((d) => resolveRejection(dto.governance, d.rejectedBy).finalStatus === 'REJECTED')
        .map((d) => d.objectId);
      if (rejectedIds.length) filter.objectId = { $nin: rejectedIds };
    }

    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(1000, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.conn
        .collection(COLL)
        .find(filter)
        .sort({ objectId: 1 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 0, objectId: 1, objectType: 1, creator: 1, name: 1, map: 1, tags: 1, rejectedBy: 1 })
        .toArray()
        .then((arr) => arr.map((d) => this.toPlaceDto(d, dto.governance))),
      this.conn.collection(COLL).countDocuments(filter),
    ]);

    return { data, total };
  }

  private toPlaceDto(doc: Record<string, unknown>, governance?: GovernanceContext): PlaceDto {
    const map = doc.map as { type?: string; coordinates?: [number, number] } | undefined;
    const rejectedBy = doc.rejectedBy != null ? String(doc.rejectedBy) : undefined;
    const resolution = resolveRejection(governance, rejectedBy);
    const dto: PlaceDto = {
      objectId: String(doc.objectId ?? ''),
      objectType: String(doc.objectType ?? 'place'),
      creator: String(doc.creator ?? ''),
      name: doc.name != null ? String(doc.name) : undefined,
      map: map?.coordinates ? { type: 'Point', coordinates: map.coordinates } : undefined,
      tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
    };
    dto.finalStatus = resolution.finalStatus;
    if (resolution.decisiveRole) dto.decisiveRole = resolution.decisiveRole;
    if (rejectedBy) dto.rejectedBy = rejectedBy;
    return dto;
  }
}

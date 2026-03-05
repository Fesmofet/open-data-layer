import { Injectable } from '@nestjs/common';
import type { PlaceDto, PlaceQueryResult, QueryPlacesDto } from '@opden-data-layer/query-contracts';
import { resolveGovernanceMask } from '@opden-data-layer/query-domain';
import { env } from '../config/env';
import { PlacesCompositionRepository } from '../repositories/places-composition.repository';
import { PlacesDecompositionRepository } from '../repositories/places-decomposition.repository';

@Injectable()
export class PlacesService {
  constructor(
    private readonly compositionRepo: PlacesCompositionRepository,
    private readonly decompositionRepo: PlacesDecompositionRepository
  ) {}

  private get repo() {
    return env.queryStrategy === 'composition' ? this.compositionRepo : this.decompositionRepo;
  }

  async queryPlaces(dto: QueryPlacesDto): Promise<PlaceQueryResult> {
    void resolveGovernanceMask(dto.governance);
    return this.repo.query(dto);
  }

  async getById(objectId: string, governance?: Parameters<PlacesCompositionRepository['findById']>[1]): Promise<PlaceDto | null> {
    return this.repo.findById(objectId, governance);
  }
}

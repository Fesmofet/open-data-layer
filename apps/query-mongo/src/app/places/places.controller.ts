import { Controller, Get, Param, Query } from '@nestjs/common';
import { parseGovernance, parsePlacesQuery } from '@opden-data-layer/query-contracts';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  async getPlaces(@Query() query: Record<string, string | string[] | undefined>) {
    return this.placesService.queryPlaces(parsePlacesQuery(query));
  }

  @Get(':objectId')
  async getPlaceById(
    @Param('objectId') objectId: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const governance = parseGovernance(query);
    return this.placesService.getById(objectId, governance ?? undefined);
  }
}

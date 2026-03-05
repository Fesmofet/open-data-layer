import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { PlacesController } from './places/places.controller';
import { PlacesCompositionRepository } from './repositories/places-composition.repository';
import { PlacesDecompositionRepository } from './repositories/places-decomposition.repository';
import { PlacesService } from './places/places.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController, PlacesController],
  providers: [
    AppService,
    PlacesService,
    PlacesCompositionRepository,
    PlacesDecompositionRepository,
  ],
})
export class AppModule {}

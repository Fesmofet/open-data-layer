import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { env } from './config/env';
import { PlacesController } from './places/places.controller';
import { PlacesCompositionRepository } from './repositories/places-composition.repository';
import { PlacesDecompositionRepository } from './repositories/places-decomposition.repository';
import { PlacesService } from './places/places.service';

@Module({
  imports: [MongooseModule.forRoot(env.mongoUri)],
  controllers: [AppController, PlacesController],
  providers: [
    AppService,
    PlacesService,
    PlacesCompositionRepository,
    PlacesDecompositionRepository,
  ],
})
export class AppModule {}

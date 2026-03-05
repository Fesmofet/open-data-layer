import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { env } from './app/config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  await app.listen(env.port, '0.0.0.0');
  Logger.log(`Query (Postgres) running on http://localhost:${env.port}/${globalPrefix}`);
}

bootstrap();

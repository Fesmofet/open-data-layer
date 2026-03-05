import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { env } from '../config/env';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: env.databaseUrl, max: 20 }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}

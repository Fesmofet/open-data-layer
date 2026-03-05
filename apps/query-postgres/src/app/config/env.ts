export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/odl_query',
  queryStrategy: (process.env.QUERY_STRATEGY ?? 'composition') as 'composition' | 'decomposition',
  port: parseInt(process.env.PORT ?? '3002', 10),
};

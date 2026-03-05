export const env = {
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/odl-query',
  queryStrategy: (process.env.QUERY_STRATEGY ?? 'composition') as 'composition' | 'decomposition',
  port: parseInt(process.env.PORT ?? '3001', 10),
};

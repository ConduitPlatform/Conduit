import { MongoIndexOptions, PostgresIndexOptions } from '@conduitplatform/grpc-sdk';

export * from './schema.js';
export * from './collectionUtils.js';

export function checkIfPostgresOptions(
  options: MongoIndexOptions | PostgresIndexOptions,
) {
  const postgresOptions = [
    'concurrently',
    'name',
    'operator',
    'parser',
    'prefix',
    'unique',
    'using',
    'where',
  ];
  const result = Object.keys(options).some(option => !postgresOptions.includes(option));
  return !result;
}

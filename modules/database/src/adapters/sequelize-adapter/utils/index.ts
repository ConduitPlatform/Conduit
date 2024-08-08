export * from './schema.js';
export * from './collectionUtils.js';
export * from './indexChecks.js';
import { MongoIndexOptions, PgIndexOptions } from '@conduitplatform/grpc-sdk';

export function checkIfPostgresOptions(options: MongoIndexOptions | PgIndexOptions) {
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

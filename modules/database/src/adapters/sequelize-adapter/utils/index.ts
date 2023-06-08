import {
  MongoIndexOptions,
  MySQLMariaDBIndexType,
  PostgresIndexType,
  SequelizeIndexOptions,
  SQLIndexType,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';

export * from './schema';
export * from './collectionUtils';

export function checkIfSequelizeIndexOptions(
  options: MongoIndexOptions | SequelizeIndexOptions,
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
    'fields',
  ];
  const result = Object.keys(options).some(option => !postgresOptions.includes(option));
  return !result;
}

export function checkIfSequelizeIndexType(type: any) {
  return (
    Object.values(SQLIndexType).includes(type as SQLIndexType) ||
    Object.values(PostgresIndexType).includes(type as PostgresIndexType) ||
    Object.values(MySQLMariaDBIndexType).includes(type as MySQLMariaDBIndexType) ||
    Object.values(SQLiteIndexType).includes(type as SQLiteIndexType)
  );
}

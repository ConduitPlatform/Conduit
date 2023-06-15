import {
  MySQLMariaDBIndexType,
  PgIndexType,
  SQLIndexType,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';

export function checkSequelizeIndexType(type: any, dialect?: string) {
  switch (dialect) {
    case 'postgres':
      return Object.values(PgIndexType).includes(type as PgIndexType);
    case 'mysql' || 'mariadb':
      return Object.values(MySQLMariaDBIndexType).includes(type as MySQLMariaDBIndexType);
    case 'sqlite':
      return Object.values(SQLiteIndexType).includes(type as SQLiteIndexType);
    default:
      return (
        Object.values(SQLIndexType).includes(type as SQLIndexType) ||
        Object.values(PgIndexType).includes(type as PgIndexType) ||
        Object.values(MySQLMariaDBIndexType).includes(type as MySQLMariaDBIndexType) ||
        Object.values(SQLiteIndexType).includes(type as SQLiteIndexType)
      );
  }
}

export function checkSequelizeIndexOptions(options: any, dialect?: string) {
  const sequelizeOptions = [
    'name',
    'parser',
    'unique',
    'fields',
    'where',
    'prefix',
    'using',
  ];
  const pgOptions = sequelizeOptions.concat(['concurrently', 'operator']);
  const mySqlMariaDbOptions = sequelizeOptions.concat(['type']);
  switch (dialect) {
    case 'postgres':
      return !Object.keys(options).some(option => !pgOptions.includes(option));
    case 'mysql' || 'mariadb':
      return !Object.keys(options).some(option => !mySqlMariaDbOptions.includes(option));
    default:
      return !Object.keys(options).some(option => !sequelizeOptions.includes(option));
  }
}

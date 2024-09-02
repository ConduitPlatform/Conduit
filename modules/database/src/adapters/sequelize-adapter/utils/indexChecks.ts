import {
  MySQLMariaDBIndexType,
  PgIndexType,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';

export function checkIfSequelizeIndexType(type: any, dialect?: string) {
  switch (dialect) {
    case 'postgres':
      return type in PgIndexType;
    case 'mysql' || 'mariadb':
      return type in MySQLMariaDBIndexType;
    case 'sqlite':
      return type in SQLiteIndexType;
    default:
      return (
        type in PgIndexType || type in MySQLMariaDBIndexType || type in SQLiteIndexType
      );
  }
}

export function checkIfSequelizeIndexOptions(options: any, dialect?: string) {
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

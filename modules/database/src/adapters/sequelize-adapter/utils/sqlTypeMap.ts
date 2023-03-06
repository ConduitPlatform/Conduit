import { SQLDataType } from '@conduitplatform/grpc-sdk';

export const sqlDataTypeMap = new Map<SQLDataType, string>([
  [SQLDataType.VARCHAR, 'String'],
  [SQLDataType.CHAR, 'String'],
  [SQLDataType.TEXT, 'String'],
  [SQLDataType.FLOAT, 'Number'],
  [SQLDataType.INT, 'Number'],
  [SQLDataType.BIGINT, 'Number'],
  [SQLDataType.DOUBLE, 'Number'],
  [SQLDataType.DECIMAL, 'Number'],
  [SQLDataType.TIME, 'Date'],
  [SQLDataType.DATETIME, 'Date'],
  [SQLDataType.TIMESTAMP, 'Date'],
]);

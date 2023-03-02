import { DataType, Indexable, SQLDataType, TYPE } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * This function should take as an input a sequelize-auto object and convert it to a conduit schema
 */
export function sqlSchemaConverter(sqlSchema: Indexable) {
  for (const fieldName of Object.keys(sqlSchema)) {
    const field = sqlSchema[fieldName];
    field.type = extractType(field.type);
    extractProperties(field);
  }
}

function extractType(type: DataType) {
  switch (type) {
    case TYPE.String:
    case SQLDataType.VARCHAR:
      return DataTypes.STRING;
    case SQLDataType.TEXT:
      return DataTypes.TEXT;
    case SQLDataType.CHAR:
      return DataTypes.CHAR;
    case TYPE.Number:
    case SQLDataType.FLOAT:
      return DataTypes.FLOAT;
    case TYPE.Boolean:
      return DataTypes.BOOLEAN;
    case TYPE.Date:
      return DataTypes.DATE;
    case TYPE.JSON:
      return DataTypes.JSON;
    case TYPE.Relation:
    case TYPE.ObjectId:
    case SQLDataType.UUID:
      return DataTypes.UUID;
    case SQLDataType.INT:
      return DataTypes.INTEGER;
    case SQLDataType.BIGINT:
      return DataTypes.BIGINT;
    case SQLDataType.DOUBLE:
      return DataTypes.DOUBLE;
    case SQLDataType.DECIMAL:
      return DataTypes.DECIMAL;
    case SQLDataType.TIME:
      return DataTypes.TIME;
    case SQLDataType.DATETIME:
    case SQLDataType.TIMESTAMP:
      return DataTypes.DATE;
    case SQLDataType.BLOB:
      return DataTypes.BLOB;
    case SQLDataType.JSONB:
      return DataTypes.JSONB;
    default:
      return DataTypes.STRING;
  }
}

function extractProperties(field: Indexable) {
  if (field.hasOwnProperty('enum')) {
    field.enum = field.special;
    delete field.special;
  }
  if (field.hasOwnProperty('foreignKey') && !field.foreignKey.isPrimaryKey) {
    field.type = TYPE.Relation;
    switch (field.foreignKey.constraint_type) {
      case 'UNIQUE':
        field.unique = true;
        break;
      case 'FOREIGN KEY':
        field.model = field.foreignKey.target_table;
        break;
    }
  }
  if (
    (field.type === TYPE.Date && field.defaultValue === 'CURRENT_TIMESTAMP') ||
    field.defaultValue === 'CURRENT_DATE' ||
    field.defaultValue === 'now()'
  ) {
    field.defaultValue = Sequelize.fn('now');
  }
  if (field.hasOwnProperty('defaultValue') && !isNil(field.defaultValue)) {
    field.default = field.defaultValue;
    if (typeof field.default === 'string' && field.default.startsWith('uuid_generate')) {
      field.default = Sequelize.fn(field.default);
    }
  }
  if (field.hasOwnProperty('allowNull')) {
    field.required = !field.allowNull;
  }

  delete field.defaultValue;
  delete field.comment;
  delete field.foreignKey;
}

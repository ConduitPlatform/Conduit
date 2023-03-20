import {
  ConduitSchema,
  Indexable,
  SQLDataType,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import { cloneDeep, isArray, isObject } from 'lodash';
import {
  checkDefaultValue,
  convertModelOptionsIndexes,
  convertSchemaFieldIndexes,
  extractFieldProperties,
  extractRelations,
} from '../../utils';
import { sqlDataTypeMap } from '../utils/sqlTypeMap';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema): [
  ConduitSchema,
  {
    [key: string]:
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
  },
] {
  let copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
  const extractedRelations = extractRelations(jsonSchema.fields, copy.fields);
  copy = convertSchemaFieldIndexes(copy);
  iterDeep(jsonSchema.fields, copy.fields);
  return [copy, extractedRelations];
}

function extractType(type: string, sqlType?: SQLDataType) {
  if (sqlType) {
    const expectedType = sqlDataTypeMap.get(sqlType);
    if (expectedType && type !== expectedType) {
      throw new Error(
        `Invalid data type for SQL data type ${sqlType}: expected ${expectedType}, but got ${type}`,
      );
    }
  }
  switch (type) {
    case 'String':
      if (sqlType === SQLDataType.CHAR) {
        return DataTypes.CHAR;
      } else if (sqlType === SQLDataType.VARCHAR) {
        return DataTypes.STRING;
      } else if (sqlType === SQLDataType.TEXT) {
        return DataTypes.TEXT;
      } else {
        return DataTypes.STRING;
      }
    case 'Number':
      if (sqlType === SQLDataType.INT) {
        return DataTypes.INTEGER;
      } else if (sqlType === SQLDataType.BIGINT) {
        return DataTypes.BIGINT;
      } else if (sqlType === SQLDataType.FLOAT) {
        return DataTypes.FLOAT;
      } else if (sqlType === SQLDataType.DOUBLE) {
        return DataTypes.DOUBLE;
      } else if (sqlType === SQLDataType.DECIMAL) {
        return DataTypes.DECIMAL;
      } else {
        return DataTypes.FLOAT;
      }
    case 'Boolean':
      return DataTypes.BOOLEAN;
    case 'Date':
      if (sqlType === SQLDataType.TIME) {
        return DataTypes.TIME;
      } else if (sqlType === SQLDataType.DATETIME || sqlType === SQLDataType.TIMESTAMP) {
        return DataTypes.DATE;
      } else {
        return DataTypes.DATE;
      }
    case 'JSON':
      return DataTypes.JSONB;
    case 'Relation':
    case 'ObjectId':
      return DataTypes.UUID;
  }
  return DataTypes.JSONB;
}

function iterDeep(schema: any, resSchema: any) {
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      resSchema[key] = extractArrayType(schema[key]);
    } else if (isObject(schema[key])) {
      resSchema[key] = extractObjectType(schema[key]);
      if (!schema[key].hasOwnProperty('type')) {
        iterDeep(schema[key], resSchema[key]);
      }
    } else {
      resSchema[key] = extractType(schema[key]);
    }
  }
}

function extractArrayType(arrayField: UntypedArray) {
  let arrayElementType;
  if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
    if (arrayField[0].hasOwnProperty('type')) {
      arrayElementType = extractType(arrayField[0].type);
    } else {
      arrayElementType = DataTypes.JSONB;
    }
  } else {
    arrayElementType = extractType(arrayField[0]);
  }
  return { type: DataTypes.ARRAY(arrayElementType) };
}

function extractObjectType(objectField: Indexable) {
  const res: {
    type: any;
    defaultValue?: any;
    primaryKey?: boolean;
    unique?: boolean;
    allowNull?: boolean;
  } = { type: null };

  if (objectField.hasOwnProperty('type')) {
    res.type = extractType(objectField.type, objectField.sqlType);
    if (objectField.hasOwnProperty('default')) {
      res.defaultValue = checkDefaultValue(objectField.type, objectField.default);
    }
  } else {
    res.type = DataTypes.JSONB;
  }

  return extractFieldProperties(objectField, res);
}

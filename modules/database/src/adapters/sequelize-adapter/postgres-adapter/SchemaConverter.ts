import {
  ConduitSchema,
  DataType,
  Indexable,
  SQLDataType,
  TYPE,
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
    default:
      return DataTypes.JSONB;
  }
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
    res.type = extractType(objectField.type);
    if (objectField.hasOwnProperty('default')) {
      res.defaultValue = checkDefaultValue(objectField.type, objectField.default);
    }
  } else {
    res.type = DataTypes.JSONB;
  }

  return extractFieldProperties(objectField, res);
}

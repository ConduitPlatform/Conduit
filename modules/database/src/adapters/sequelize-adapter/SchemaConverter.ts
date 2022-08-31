import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import * as _ from 'lodash';
import { isBoolean, isNumber, isString, isArray, isObject } from 'lodash';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  const copy = _.cloneDeep(jsonSchema) as any;

  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }

  iterDeep(jsonSchema.fields, copy.fields);

  return copy;
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

function extractArrayType(arrayField: any[]) {
  let arrayElementType;
  if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
    if (arrayField[0].hasOwnProperty('type')) {
      arrayElementType = extractType(arrayField[0].type);
    } else {
      arrayElementType = DataTypes.JSON;
    }
  } else {
    arrayElementType = extractType(arrayField[0]);
  }
  return { type: DataTypes.ARRAY(arrayElementType) };
}

function extractObjectType(objectField: any) {
  const res: { type: any; defaultValue?: any; primaryKey?: boolean } = { type: null };

  if (objectField.hasOwnProperty('type')) {
    res.type = extractType(objectField.type);
    if (objectField.hasOwnProperty('default')) {
      res.defaultValue = checkDefaultValue(objectField.type, objectField.default);
    }
  } else {
    res.type = DataTypes.JSON;
  }

  if (objectField.hasOwnProperty('primaryKey') && objectField.primaryKey) {
    res.primaryKey = objectField.primaryKey ?? false;
  }

  return res;
}

function extractType(type: string) {
  switch (type) {
    case 'String':
      return DataTypes.STRING;
    case 'Number':
      return DataTypes.FLOAT;
    case 'Boolean':
      return DataTypes.BOOLEAN;
    case 'Date':
      return DataTypes.DATE;
    case 'JSON':
      return DataTypes.JSON;
    case 'Relation':
    case 'ObjectId':
      return DataTypes.UUID;
  }

  return DataTypes.JSON;
}

function checkDefaultValue(type: string, value: string) {
  switch (type) {
    case 'String':
      if (isString(value)) return value;
      return '';
    case 'Number':
      if (isNumber(value)) return value;
      const v = parseFloat(value);
      if (Number.isNaN(v)) return v;
      return 0;
    case 'Boolean':
      if (isBoolean(value)) return value;
      return value === 'true';
    default:
      return value;
  }
}

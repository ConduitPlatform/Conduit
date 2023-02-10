import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import { cloneDeep, isArray, isObject } from 'lodash';
import {
  checkDefaultValue,
  convertModelOptionsIndexes,
  convertSchemaFieldIndexes,
  extractFieldProperties,
  extractType,
} from '../../utils';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema): [
  ConduitSchema,
  { [key: string]: any },
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
  const extractedEmbedded = extractEmbedded(jsonSchema.fields, copy.fields);
  const extractedRelations = extractRelations(jsonSchema.fields, copy.fields);
  copy = convertSchemaFieldIndexes(copy);
  iterDeep(jsonSchema.fields, copy.fields);
  return [copy, extractedEmbedded, extractedRelations];
}

function extractEmbedded(ogSchema: any, schema: any) {
  const extracted: { [key: string]: any } = {};
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      const arrayField = schema[key];
      if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
        if (
          !arrayField[0].hasOwnProperty('type') ||
          typeof arrayField[0].type !== 'string'
        ) {
          extracted[key] = [arrayField[0]];
          delete schema[key];
          delete ogSchema[key];
        }
      }
    } else if (isObject(schema[key])) {
      if (!schema[key].hasOwnProperty('type') || typeof schema[key].type !== 'string') {
        extracted[key] = schema[key];
        delete schema[key];
        delete ogSchema[key];
      }
    }
  }
  return extracted;
}

function extractRelations(ogSchema: any, schema: any) {
  const extracted: {
    [key: string]:
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
  } = {};
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      const arrayField = schema[key];
      if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
        if (arrayField[0].hasOwnProperty('type') && arrayField[0].type === 'Relation') {
          extracted[key] = [{ ...arrayField[0] }];
          delete schema[key];
          delete ogSchema[key];
        }
      }
    } else if (isObject(schema[key])) {
      if (schema[key].hasOwnProperty('type') && schema[key].type === 'Relation') {
        extracted[key] = { ...schema[key] };
        delete schema[key];
        delete ogSchema[key];
      }
    }
  }
  return extracted;
}

function iterDeep(schema: any, resSchema: any) {
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      resSchema[key] = extractArrayType(schema[key], key);
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

function extractArrayType(arrayField: any[], field: string) {
  let arrayElementType;
  if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
    if (arrayField[0].hasOwnProperty('type')) {
      arrayElementType = extractType(arrayField[0].type);
    } else {
      throw new Error('Failed to extract embedded object type');
    }
  } else {
    arrayElementType = extractType(arrayField[0]);
  }
  if (arrayElementType === DataTypes.JSON) {
    return { type: DataTypes.JSON };
  } else {
    return {
      type: DataTypes.STRING,
      get(): any {
        // @ts-ignore
        return this.getDataValue(field).split(';');
      },
      set(val: any): any {
        // @ts-ignore
        this.setDataValue(field, val.join(';'));
      },
    };
  }
}

function extractObjectType(objectField: any) {
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
    throw new Error('Failed to extract embedded object type');
  }

  return extractFieldProperties(objectField, res);
}

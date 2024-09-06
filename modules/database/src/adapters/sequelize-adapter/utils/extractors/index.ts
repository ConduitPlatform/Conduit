import { ConduitModel, Indexable } from '@conduitplatform/grpc-sdk';
import { isArray, isObject } from 'lodash-es';

export interface RelationType {
  type: 'Relation';
  model: string;
  required?: boolean;
  select?: boolean;
}

export function extractRelations(ogSchema: ConduitModel, schema: any) {
  const extracted: { [key: string]: RelationType | RelationType[] } = {};
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
    } else if (schema[key].hasOwnProperty('type') && isArray(schema[key].type)) {
      const arrayField = schema[key].type;
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

export function convertObjectToDotNotation(
  schema: any,
  resSchema: any,
  keyMapping: any = {},
  parentKey: string | null = null,
  prefix: string = '',
  separator: string = '_',
) {
  for (const key of Object.keys(schema)) {
    if (!isArray(schema[key]) && isObject(schema[key])) {
      const extraction = extractObjectType(schema[key]);
      if (!extraction.hasOwnProperty('type')) {
        const newParentKey = parentKey ? `${parentKey}.${key}` : key;
        const newPrefix = prefix ? `${prefix}${separator}${key}` : key;
        convertObjectToDotNotation(
          extraction,
          resSchema,
          keyMapping,
          newParentKey,
          newPrefix,
          separator,
        );

        // Remove the original key from resSchema
        if (prefix) {
          delete resSchema[`${prefix}${separator}${key}`];
        } else {
          delete resSchema[key];
        }
      } else {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        resSchema[newKey] = extraction;
        if (parentKey || prefix) {
          keyMapping[newKey] = {
            parentKey: parentKey || prefix,
            childKey: key,
          };
        }
      }
    } else {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;
      resSchema[newKey] = schema[key];
      if (parentKey || prefix) {
        keyMapping[newKey] = {
          parentKey: parentKey || prefix,
          childKey: key,
        };
      }
    }
  }
}

function extractObjectType(objectField: Indexable): Indexable {
  if (objectField.hasOwnProperty('type')) {
    if (isArray(objectField.type)) {
      return objectField;
    } else if (isObject(objectField.type)) {
      return objectField.type;
    } else {
      return objectField;
    }
  } else {
    return objectField;
  }
}

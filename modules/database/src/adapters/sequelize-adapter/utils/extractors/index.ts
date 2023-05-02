import { ConduitModel, Indexable } from '@conduitplatform/grpc-sdk';
import { isArray, isObject } from 'lodash';

export function extractEmbedded(ogSchema: any, schema: any) {
  const extracted: Indexable = {};
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
    } else if (schema[key].hasOwnProperty('type') && isArray(schema[key].type)) {
      const arrayField = schema[key].type;
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
      if (!schema[key].hasOwnProperty('type')) {
        extracted[key] = schema[key];
        delete schema[key];
        delete ogSchema[key];
      } else if (typeof schema[key].type !== 'string') {
        extracted[key] = schema[key].type;
        delete schema[key];
        delete ogSchema[key];
      }
    }
  }
  return extracted;
}
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

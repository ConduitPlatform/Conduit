import { isArray, isObject } from 'lodash';
import { ConduitModel } from '@conduitplatform/grpc-sdk';

interface RelationType {
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

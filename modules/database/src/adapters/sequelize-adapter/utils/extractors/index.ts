import { ConduitModel, Indexable } from '@conduitplatform/grpc-sdk';
import { isArray, isObject } from 'lodash';

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
  objectPaths: string[] = [],
) {
  for (const key of Object.keys(schema)) {
    if (!isArray(schema[key]) && isObject(schema[key])) {
      const extraction = extractObjectType(schema[key]);
      if (!extraction.hasOwnProperty('type')) {
        const taf: any = {};
        const newFields: any = {};
        convertObjectToDotNotation(extraction, taf);
        // unwrap the taf object to a new object that is not nested
        for (const tafKey of Object.keys(taf)) {
          newFields[`${key}_${tafKey}`] = taf[tafKey];
          objectPaths.push(`${key}_${tafKey}`);
        }
        delete resSchema[key];
        // resSchema is passed by reference, so we can just add the new fields to it
        Object.assign(resSchema, newFields);
      } else {
        resSchema[key] = extraction;
      }
    } else {
      resSchema[key] = schema[key];
    }
  }
}

function extractObjectType(objectField: Indexable):
  | {
      type: any;
      defaultValue?: any;
      primaryKey?: boolean;
      unique?: boolean;
      allowNull?: boolean;
    }
  | Indexable {
  const res: {
    type: any;
    defaultValue?: any;
    primaryKey?: boolean;
    unique?: boolean;
    allowNull?: boolean;
  } = { type: null };

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

  return res;
}

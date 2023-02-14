import { isArray, isObject } from 'lodash';

export function extractRelations(ogSchema: any, schema: any) {
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

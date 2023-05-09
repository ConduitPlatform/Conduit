import { Indexable } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema';
import { ParsedQuery } from '../../../interfaces';
import { cloneDeep, get } from 'lodash';

const { isArray, isObject } = require('lodash');

function potentialNesting(field: any) {
  return (
    !isArray(field) &&
    isObject(field) &&
    !(field instanceof Buffer || field instanceof Date)
  );
}

export function processCreateQuery(query: Indexable, keyMapping: any) {
  const foundKeys = [];
  for (const key in keyMapping) {
    const val = get(
      query,
      keyMapping[key].parentKey + '.' + keyMapping[key].childKey,
      undefined,
    );
    if (val !== undefined) {
      query[key] = get(query, keyMapping[key].parentKey + '.' + keyMapping[key].childKey);
      foundKeys.push(keyMapping[key].parentKey);
    }
  }
  if (foundKeys.length > 0) {
    for (const key of foundKeys) {
      if (query.hasOwnProperty(key)) {
        delete query[key];
      }
    }
  }
}

function unwrapNestedKeys(object: any, keyMapping: any) {
  for (const concatenatedKey of Object.keys(keyMapping)) {
    if (object.hasOwnProperty(concatenatedKey)) {
      const { parentKey, childKey } = keyMapping[concatenatedKey];
      const nestedKeys = parentKey.split('.');
      let currentObject = object;

      for (const nestedKey of nestedKeys) {
        if (!currentObject.hasOwnProperty(nestedKey)) {
          currentObject[nestedKey] = {};
        }
        currentObject = currentObject[nestedKey];
      }

      currentObject[childKey] = object[concatenatedKey];
      delete object[concatenatedKey];
    }
  }
}

/**
 * unwraps the object according to the keyMapping
 * @param object
 * @param keyMapping
 * @param relations
 */
export function unwrap(
  object: any,
  keyMapping: any,
  relations: {
    [key: string]: SequelizeSchema | SequelizeSchema[];
  },
) {
  for (const key in object) {
    if (potentialNesting(object[key])) {
      if (relations.hasOwnProperty(key)) {
        unwrap(
          object[key],
          (relations[key] as SequelizeSchema).objectPaths,
          (relations[key] as SequelizeSchema).extractedRelations,
        );
      } else {
        unwrap(object[key], keyMapping, relations);
      }
      unwrapNestedKeys(object[key], keyMapping);
    }
    if (isArray(object[key])) {
      if (relations.hasOwnProperty(key)) {
        for (const element of object[key]) {
          unwrap(
            element,
            (relations[key] as SequelizeSchema[])[0].objectPaths,
            (relations[key] as SequelizeSchema[])[0].extractedRelations,
          );
        }
      } else {
        for (const element of object[key]) {
          unwrap(element, keyMapping, relations);
        }
      }
    }
  }
  unwrapNestedKeys(object, keyMapping);
}

/**
 * pre-processes queries to convert potential dot notation to _ notation
 * according to the keyMapping
 */
export function preprocessQuery(query: ParsedQuery, keyMapping: any) {
  for (const key in query) {
    if (potentialNesting(query[key])) {
      preprocessQuery(query[key], keyMapping);
    }
    if (isArray(query[key])) {
      for (const element of query[key]) {
        preprocessQuery(element, keyMapping);
      }
    }
    for (const concatenatedKey of keyMapping) {
      if (key.indexOf(concatenatedKey) !== -1) {
        const split = key.split(concatenatedKey);
        const newKey = concatenatedKey.replace(/\./g, '_');
        if (split[1] !== '') {
          query[newKey + split[1]] = cloneDeep(query[key]);
        } else {
          query[newKey] = cloneDeep(query[key]);
        }
        delete query[key];
      }
    }
  }
}

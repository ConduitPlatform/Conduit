import { Indexable } from '@conduitplatform/grpc-sdk';
import dottie from 'dottie';
import { SequelizeSchema } from '../SequelizeSchema';
import { ParsedQuery } from '../../../interfaces';
import { cloneDeep } from 'lodash';

const { isArray, isObject } = require('lodash');

function isObjectICare(field: any) {
  return (
    !isArray(field) &&
    isObject(field) &&
    !(field instanceof Buffer || field instanceof Date)
  );
}

/**
 * parses objects in query and unwraps them to the _ notation according to the keyMapping
 */
function processCreateQuery(query: Indexable, keyMapping: any) {
  function processObject(obj: Indexable, currentPath: string) {
    let processedObj: Indexable = {};

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const value = obj[key];

      if (keyMapping.hasOwnProperty(newPath)) {
        const newKey = keyMapping[newPath];
        processedObj[newKey] = value;
      } else {
        if (typeof value === 'object' && value !== null) {
          const processedValue = processObject(value, newPath);
          processedObj[key] = processedValue;
        } else {
          processedObj[key] = value;
        }
      }
    }

    return processedObj;
  }

  return processObject(query, '');
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
    if (isObjectICare(object[key])) {
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
    if (isObjectICare(query[key])) {
      preprocessQuery(query[key], keyMapping);
    }
    if (isArray(query[key])) {
      for (const element of query[key]) {
        preprocessQuery(element, keyMapping);
      }
    }
    for (const concatenatedKey of Object.keys(keyMapping)) {
      const { parentKey, childKey } = keyMapping[concatenatedKey];
      const dotPath = `${parentKey}.${childKey}`;
      if (key.indexOf(dotPath) !== -1) {
        const split = key.split(dotPath);
        query[concatenatedKey] = cloneDeep(query[key]);
        delete query[key];
      }
    }
  }
}

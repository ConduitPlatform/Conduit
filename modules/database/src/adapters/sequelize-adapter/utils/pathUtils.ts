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

function pathICare(myPath: string, objectDotPaths: string[]) {
  for (const path of objectDotPaths) {
    if (path.startsWith(myPath)) {
      return true;
    }
  }
}

export function processCreateQuery(query: Indexable, keyMapping: any) {
  for (const key in query) {
    /*
     * We need to check every key in the query to see if it is present in the keyMapping
     * and if yes unwrap the object in the key to match the original structure
     */
    if (!query.hasOwnProperty(key)) continue;
    if (isObjectICare(query[key])) {
      let matchedPath = false;
      for (const concatenatedKey of Object.keys(keyMapping)) {
        if (concatenatedKey.startsWith(key)) {
          matchedPath = true;
          let hasOne = false;
          // unwrap the object and add the fields to the query
          const processing: any = {};
          for (const field in query[key]) {
            const possibleConcatenatedKey = key + '_' + field;
            if (
              isObjectICare(query[key][field]) &&
              keyMapping.hasOwnProperty(possibleConcatenatedKey)
            ) {
              processing[possibleConcatenatedKey] = query[key][field];
              hasOne = true;
            } else {
              if (keyMapping.hasOwnProperty(possibleConcatenatedKey)) {
                processing[possibleConcatenatedKey] = query[key][field];
                hasOne = true;
              } else {
                if (!isObjectICare(processing[key])) {
                  processing[key] = {};
                }
                processing[key][field] = query[key][field];
              }
            }
          }
          if (hasOne) {
            processCreateQuery(processing, keyMapping);
            delete query[key];
            Object.assign(query, processing);
          }
        }
      }
      if (!matchedPath) console.log('No match found for key: ', key);
    }
  }
}

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
  for (const concatenatedKey of Object.keys(keyMapping)) {
    if (object.hasOwnProperty(concatenatedKey)) {
      const { parentKey, childKey } = keyMapping[concatenatedKey];
      dottie.set(object, `${parentKey}.${childKey}`, object[concatenatedKey]);
      delete object[concatenatedKey];
    }
  }
}

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

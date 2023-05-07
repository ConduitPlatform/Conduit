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

export function processCreateQuery(query: Indexable, objectDotPaths: string[]) {
  for (const key in query) {
    /*
     * We need to check every key in the query to see if it contains paths that match the objectDotPaths
     * and if yes unwrap the object in the key to match the objectPaths
     */
    if (!query.hasOwnProperty(key)) continue;
    if (isObjectICare(query[key])) {
      let matchedPath = false;
      for (const path of objectDotPaths) {
        if (path.startsWith(key)) {
          matchedPath = true;
          let hasOne = false;
          // unwrap the object and add the fields to the query
          const processing: any = {};
          for (const field in query[key]) {
            if (
              isObjectICare(query[key][field]) &&
              pathICare(key + '_' + field, objectDotPaths)
            ) {
              processing[key + '_' + field] = query[key][field];
              hasOne = true;
            } else {
              if (objectDotPaths.includes(key + '_' + field)) {
                processing[key + '_' + field] = query[key][field];
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
            processCreateQuery(processing, objectDotPaths);
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
  objectPaths: string[],
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
        unwrap(object[key], objectPaths, relations);
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
          unwrap(element, objectPaths, relations);
        }
      }
    }
  }
  for (const path of objectPaths) {
    if (object.hasOwnProperty(path)) {
      dottie.set(object, path.replace(/_/g, '.'), object[path]);
      delete object[path];
    }
  }
}

export function preprocessQuery(query: ParsedQuery, objectDotPaths: string[]) {
  for (const key in query) {
    if (isObjectICare(query[key])) {
      preprocessQuery(query[key], objectDotPaths);
    }
    if (isArray(query[key])) {
      for (const element of query[key]) {
        preprocessQuery(element, objectDotPaths);
      }
    }
    for (const path of objectDotPaths) {
      if (key.indexOf(path) !== -1) {
        const split = key.split(path);
        query[split[0].replace(/\./g, '_') + split[1]] = cloneDeep(query[key]);
        delete query[key];
      }
    }
  }
}

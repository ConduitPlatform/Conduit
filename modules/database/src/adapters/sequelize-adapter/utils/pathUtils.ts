import { Indexable } from '@conduitplatform/grpc-sdk';
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
export function processCreateQuery(query: Indexable, keyMapping: any) {
  processCreateQueryHelper(null, null, query, keyMapping);
}

function processCreateQueryHelper(
  parent: Indexable | null,
  parentKey: string | null,
  query: Indexable,
  keyMapping: any,
  currentPath: string = '',
) {
  const keys = Object.keys(query);

  for (const key of keys) {
    let keyPartOfMap = false;
    const matchingKeys = Object.keys(keyMapping).filter(
      concatenatedKey =>
        concatenatedKey.startsWith(
          currentPath + (parentKey ? parentKey + '_' : '') + key + '_',
        ) || concatenatedKey.startsWith(currentPath + '_' + key + '_'),
    );
    // If the value is an object, recursively process it
    if (isObjectICare(query[key]) && matchingKeys.length !== 0) {
      if (!parentKey) {
        processCreateQueryHelper(query, key, query[key], keyMapping, key);
      } else if (
        parentKey === currentPath ||
        (currentPath.indexOf(parentKey) !== -1 &&
          currentPath.indexOf(parentKey) + parentKey.length === currentPath.length)
      ) {
        processCreateQueryHelper(
          query,
          key,
          query[key],
          keyMapping,
          currentPath + '_' + key,
        );
      } else {
        processCreateQueryHelper(
          query,
          key,
          query[key],
          keyMapping,
          currentPath + '_' + parentKey + '_' + key,
        );
      }
    }
  }

  for (const key of keys) {
    const matchingKeys = Object.keys(keyMapping).filter(
      concatenatedKey =>
        concatenatedKey.startsWith(
          currentPath + (parentKey ? parentKey + '_' : '') + key + '_',
        ) || concatenatedKey.startsWith(currentPath + '_' + key),
    );

    if (matchingKeys.length > 0) {
      for (const matchingKey of matchingKeys) {
        const keyPath = keyMapping[matchingKey];
        const childKey = keyPath.childKey;
        const unwrappedKey = (parentKey ? parentKey + '_' : '') + key + '_' + childKey;

        if (query[key] && query[key].hasOwnProperty(childKey)) {
          if (parent) {
            parent[unwrappedKey] = query[key][childKey];
          } else {
            query[unwrappedKey] = query[key][childKey];
          }
          delete query[key][childKey];
        }

        // Clean up empty objects
        if (query[key] && Object.keys(query[key]).length === 0) {
          delete query[key];
        }
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

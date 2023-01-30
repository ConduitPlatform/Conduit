import { ParsedQuery } from '../../../interfaces';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { Op, WhereOptions } from 'sequelize';
import { isArray, isBoolean, isString } from 'lodash';

function arrayHandler(
  value: any,
  relations: {
    relations: Indexable;
    relationsDirectory: string[];
  },
  associations?: {
    associations: Indexable;
    associationsDirectory: { [key: string]: string[] };
  },
) {
  const newArray = [];
  for (const val of value) {
    newArray.push(_parseQuery(val, relations, associations));
  }
  return newArray;
}

function matchOperation(
  operator: string,
  value: any,
  relations: {
    relations: Indexable;
    relationsDirectory: string[];
  },
  associations?: {
    associations: Indexable;
    associationsDirectory: { [key: string]: string[] };
  },
) {
  switch (operator) {
    case '$eq':
      return { [Op.eq]: value };
    case '$exists':
      return value ? { [Op.ne]: null } : { [Op.eq]: null };
    case '$ne':
      // replace the parsed query with the sequelize-native equivalent
      if (value[Op.regexp]) {
        return { [Op.notRegexp]: value[Op.regexp] };
      }
      return { [Op.ne]: value };
    case '$gt':
      return { [Op.gt]: value };
    case '$not':
      // replace the parsed query with the sequelize-native equivalent
      if (value[Op.regexp]) {
        return { [Op.notRegexp]: value[Op.regexp] };
      }
      return { [Op.not]: value };
    case '$gte':
      return { [Op.gte]: value };
    case '$lt':
      return { [Op.lt]: value };
    case '$lte':
      return { [Op.lte]: value };
    case '$in':
      return {
        [Op.in]: arrayHandler(value, relations, associations),
      };
    case '$or':
      return arrayHandler(value, relations, associations);
    case '$and':
      return arrayHandler(value, relations, associations);
    case '$nin':
      return {
        [Op.notIn]: arrayHandler(value, relations, associations),
      };
    default:
      return value;
  }
}

function _parseQuery(
  query: ParsedQuery,
  relations: {
    relations: Indexable;
    relationsDirectory: string[];
  },
  associations?: {
    associations: Indexable;
    associationsDirectory: { [key: string]: string[] };
  },
) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query)) return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) =>
          _parseQuery(operation, relations, associations),
        ),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) =>
          _parseQuery(operation, relations, associations),
        ),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      const subQuery = _parseQuery(query[key], relations, associations);
      if (subQuery === undefined) continue;
      const matched = matchOperation(key, subQuery, relations, associations);
      if (key.indexOf('$') !== -1) {
        Object.assign(parsed, matched);
        continue;
      }
      Object.assign(parsed, {
        ...(handleRelation(
          key,
          matched,
          relations.relations,
          relations.relationsDirectory,
        ) ||
          handleAssoc(
            key,
            matched,
            associations?.associations,
            associations?.associationsDirectory,
          ) || { [key]: matched }),
      });
    }
  }
  if (
    Object.keys(parsed).length === 0 &&
    Object.getOwnPropertySymbols(parsed).length === 0
  )
    return;
  return parsed;
}

function handleAssoc(
  key: string,
  value: any,
  associations?: Indexable,
  requiredAssociations?: Indexable,
) {
  if (!associations || !requiredAssociations) return null;
  // Check if key contains an association
  const assocKey = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
  if (associations && associations[assocKey]) {
    // if it is not already in the requiredAssociations array
    if (!requiredAssociations![assocKey]) {
      requiredAssociations![assocKey] = [key];
    }
    return { [`$${key}${key.indexOf('.') !== -1 ? '' : '._id'}$`]: value };
  }
  return null;
}

function handleRelation(
  key: string,
  value: any,
  relations: Indexable,
  requiredRelations: Indexable,
) {
  const relationKey = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
  if (relations && relations[relationKey]) {
    if (requiredRelations.indexOf(key) === -1) {
      requiredRelations.push(key);
    }
    return { [`$${key}${key.indexOf('.') !== -1 ? '' : '._id'}$`]: value };
  }
}

export function parseQuery(
  query: ParsedQuery,
  relations: Indexable,
  populate?: string[],
  associations?: Indexable,
) {
  const parsingResult: {
    query?: WhereOptions;
    requiredRelations: string[];
    requiredAssociations: Indexable;
  } = {
    query: {},
    requiredRelations: [],
    requiredAssociations: {},
  };
  parsingResult.query = {
    ..._parseQuery(
      query,
      { relations, relationsDirectory: parsingResult.requiredRelations },
      associations && {
        associations,
        associationsDirectory: parsingResult.requiredAssociations,
      },
    ),
  };
  if (
    Object.keys(parsingResult.query).length === 0 &&
    Object.getOwnPropertySymbols(parsingResult.query).length === 0
  )
    parsingResult.query = undefined;
  return parsingResult;
}

export * from './sql';

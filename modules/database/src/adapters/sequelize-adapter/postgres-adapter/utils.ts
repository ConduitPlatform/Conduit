import { Op } from 'sequelize';
import { isArray, isBoolean, isString } from 'lodash';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { ParsedQuery } from '../../../interfaces';

function arrayHandler(value: any, relations: Indexable, relationsDirectory: string[]) {
  const newArray = [];
  for (const val of value) {
    newArray.push(parseQuery(val, relations, relationsDirectory));
  }
  return newArray;
}

function matchOperation(
  operator: string,
  value: any,
  relations: Indexable,
  relationsDirectory: string[],
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
      return { [Op.in]: arrayHandler(value, relations, relationsDirectory) };
    case '$or':
      return arrayHandler(value, relations, relationsDirectory);
    case '$and':
      return arrayHandler(value, relations, relationsDirectory);
    case '$nin':
      return { [Op.notIn]: arrayHandler(value, relations, relationsDirectory) };
    default:
      return value;
  }
}

export function parseQuery(
  query: ParsedQuery,
  relations: Indexable,
  relationsDirectory: string[],
) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query)) return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) =>
          parseQuery(operation, relations, relationsDirectory),
        ),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) =>
          parseQuery(operation, relations, relationsDirectory),
        ),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      const subQuery = parseQuery(query[key], relations, relationsDirectory);
      if (subQuery === undefined) continue;
      const matched = matchOperation(key, subQuery, relations, relationsDirectory);
      if (key.indexOf('$') !== -1) {
        Object.assign(parsed, matched);
        continue;
      }
      const relationKey = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
      if (relations && relations[relationKey]) {
        if (relationsDirectory.indexOf(key) === -1) {
          relationsDirectory.push(key);
        }
        parsed[`$${key}${key.indexOf('.') !== -1 ? '' : '._id'}$`] = matched;
      } else {
        parsed[key] = matched;
      }
    }
  }
  if (
    Object.keys(parsed).length === 0 &&
    Object.getOwnPropertySymbols(parsed).length === 0
  )
    return;
  return parsed;
}

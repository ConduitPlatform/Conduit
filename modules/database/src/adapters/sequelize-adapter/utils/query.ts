import { Op } from 'sequelize';
import { isArray, isBoolean, isString, merge } from 'lodash';
import {
  Indexable,
  MongoIndexOptions,
  PostgresIndexOptions,
} from '@conduitplatform/grpc-sdk';
import { MultiDocQuery, ParsedQuery, SingleDocQuery } from '../../../interfaces';
import { SequelizeSchema } from '../SequelizeSchema';

function arrayHandler(value: any) {
  const newArray = [];
  for (const val of value) {
    newArray.push(parseQuery(val)[0]);
  }
  return newArray;
}

function matchOperation(operator: string, value: any) {
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
      return { [Op.in]: arrayHandler(value) };
    case '$or':
      return arrayHandler(value);
    case '$and':
      return arrayHandler(value);
    case '$nin':
      return { [Op.notIn]: arrayHandler(value) };
    case '$contains':
      if (Array.isArray(value)) {
        return { [Op.contains]: arrayHandler(value) };
      }
      return { [Op.contains]: value };
    default:
      return value;
  }
}

export function parseQuery(query: ParsedQuery, associations?: Indexable) {
  const parsed: Indexable = isArray(query) ? [] : {};
  let requiredAssociations: { [key: string]: string[] } = {};
  if (isString(query) || isBoolean(query)) return [query, requiredAssociations];
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) => {
          let [result, assoc] = parseQuery(operation, associations);
          requiredAssociations = merge(requiredAssociations, assoc);
          return result;
        }),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) => {
          let [result, assoc] = parseQuery(operation, associations);
          requiredAssociations = merge(requiredAssociations, assoc);
          return result;
        }),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      const [subQuery, assoc] = parseQuery(query[key], associations);
      requiredAssociations = merge(requiredAssociations, assoc);
      if (subQuery === undefined) continue;
      const matched = matchOperation(key, subQuery);
      if (key.indexOf('$') !== -1) {
        Object.assign(parsed, matched);
        continue;
      }
      // Check if key contains an association
      let assocKey = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
      if (associations && associations[assocKey]) {
        // if it is not already in the requiredAssociations array
        if (!requiredAssociations[assocKey]) {
          requiredAssociations[assocKey] = [key];
        }
        if (key.indexOf('.') !== -1) {
          parsed[`$${key}$`] = matched;
        } else {
          parsed[`$${key}._id$`] = matched;
        }
        continue;
      }
      parsed[key] = matched;
    }
  }
  if (
    Object.keys(parsed).length === 0 &&
    Object.getOwnPropertySymbols(parsed).length === 0
  )
    return [undefined, requiredAssociations];
  return [parsed, requiredAssociations];
}

export function extractAssociationsFromObject(
  query: ParsedQuery | ParsedQuery[],
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): { [key: string]: string[] } {
  const requiredAssociations: { [key: string]: string[] } = {};
  if (!associations) return {};
  if (Array.isArray(query)) {
    query
      .map(q => extractAssociationsFromObject(q, associations))
      .forEach(assoc => merge(requiredAssociations, assoc));
    return requiredAssociations;
  }
  for (const assoc in associations) {
    if (query[assoc]) {
      if (!requiredAssociations[assoc]) {
        requiredAssociations[assoc] = [assoc];
      }
      let newAssoc = Array.isArray(associations[assoc])
        ? (associations[assoc] as any[])[0]
        : associations[assoc];
      let embeddedAssociations = extractAssociationsFromObject(
        query[assoc],
        newAssoc.associations,
      );
      for (const embeddedAssoc in embeddedAssociations) {
        requiredAssociations[assoc].push(`${assoc}.${embeddedAssoc}`);
      }
    }
  }
  return requiredAssociations;
}

export function checkIfPostgresOptions(
  options: MongoIndexOptions | PostgresIndexOptions,
) {
  const postgresOptions = [
    'concurrently',
    'name',
    'operator',
    'parser',
    'prefix',
    'unique',
    'using',
    'where',
  ];
  const result = Object.keys(options).some(option => !postgresOptions.includes(option));
  return !result;
}

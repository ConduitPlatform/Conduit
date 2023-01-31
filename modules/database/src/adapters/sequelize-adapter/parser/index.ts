import { ParsedQuery } from '../../../interfaces';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { Op, WhereOptions } from 'sequelize';
import { isArray, isBoolean, isString, isNumber } from 'lodash';
import { SequelizeSchema } from '../SequelizeSchema';

function arrayHandler(
  value: any,
  relations: {
    relations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    relationsDirectory: string[];
  },
  associations?: {
    associations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
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
    relations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    relationsDirectory: string[];
  },
  associations?: {
    associations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
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
    relations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    relationsDirectory: string[];
  },
  associations?: {
    associations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    associationsDirectory: { [key: string]: string[] };
  },
) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query) || isNumber(query)) return query;
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
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  requiredAssociations?: { [key: string]: string[] },
) {
  if (!associations || !requiredAssociations) return null;
  // Check if key contains an association
  const assocKey: string = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
  if (associations && associations[assocKey]) {
    // if it is not already in the requiredAssociations array
    if (!requiredAssociations![assocKey]) {
      requiredAssociations![assocKey] = [key];
    }
    let idField: any;
    if (Array.isArray(associations[assocKey])) {
      idField = (associations[assocKey] as SequelizeSchema[])[0].idField;
    } else {
      idField = (associations[assocKey] as SequelizeSchema).idField;
    }
    return { [`$${key}${key.indexOf('.') !== -1 ? '' : idField}$`]: value };
  }
  return null;
}

function handleRelation(
  key: string,
  value: any,
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  requiredRelations: string[],
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
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  queryOptions: { populate?: string[]; select?: string; exclude?: string[] },
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
) {
  const parsingResult: {
    query?: WhereOptions;
    requiredRelations: string[];
    requiredAssociations: { [key: string]: string[] };
    attributes?: { include?: string[]; exclude?: string[] } | string[];
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
  if (queryOptions.select) {
    if (queryOptions.select === '') {
      parsingResult.attributes = [];
    } else {
      for (const relation of queryOptions.populate || []) {
        while (queryOptions.select.indexOf(relation) !== -1) {
          queryOptions.select = queryOptions.select.replace(relation, ``);
        }
      }
      parsingResult.attributes = parseSelect(
        queryOptions.select,
        queryOptions.exclude || [],
        relations,
      );
    }
  } else {
    parsingResult.attributes = renameRelations(queryOptions.populate || [], relations);
  }
  if (
    Object.keys(parsingResult.query).length === 0 &&
    Object.getOwnPropertySymbols(parsingResult.query).length === 0
  )
    parsingResult.query = undefined;
  return parsingResult;
}

function parseSelect(
  select: string,
  excludedFields: string[],
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): { exclude?: string[]; include?: string[] } | string[] {
  const include: string[] = [];
  const exclude = [...excludedFields];
  const attributes = select.split(' ');
  let includedRelations = [];
  let returnIncludes = false;

  for (const attribute of attributes) {
    if (attribute[0] === '+') {
      let tmp = attribute;
      if (attribute[0] === '+') {
        tmp = attribute.slice(1);
      }
      const ind = exclude.indexOf(tmp);
      if (ind > -1) {
        exclude.splice(ind, 1);
      }
      returnIncludes = true;
      if (relations[tmp]) {
        includedRelations.push(tmp);
        if (!Array.isArray(relations[tmp])) {
          // @ts-ignore
          include.push([tmp + 'Id', tmp]);
        } else {
          include.push(tmp);
        }
      } else {
        include.push(tmp);
      }
    } else if (attribute[0] === '-') {
      if (relations[attribute.slice(1)]) {
        includedRelations.push(attribute.slice(1));
        if (!Array.isArray(relations[attribute.slice(1)])) {
          // @ts-ignore
          exclude.push(attribute.slice(1) + 'Id');
        } else {
          exclude.push(attribute.slice(1));
        }
      } else {
        exclude.push(attribute.slice(1));
      }
    } else {
      let tmp = attribute;
      const ind = exclude.indexOf(tmp);
      if (ind > -1) {
        exclude.splice(ind, 1);
      }
      if (relations[tmp]) {
        includedRelations.push(tmp);
        if (!Array.isArray(relations[tmp])) {
          // @ts-ignore
          include.push([tmp + 'Id', tmp]);
        } else {
          include.push(tmp);
        }
      } else {
        include.push(tmp);
      }
    }
  }
  return returnIncludes ? { include, exclude } : [...include];
}

export function renameRelations(
  population: string[],
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): { include: string[] } {
  const include: string[] = [];

  for (const relation in relations) {
    if (population.indexOf(relation) !== -1) continue;
    if (!Array.isArray(relations[relation])) {
      // @ts-ignore
      include.push([relation + 'Id', relation]);
    }
  }

  return {
    include,
  };
}

export * from './sql';

import { ParsedQuery } from '../../../interfaces';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { Op, WhereOptions } from 'sequelize';
import { isArray, isBoolean, isNil, isNumber, isString } from 'lodash';
import { SequelizeSchema } from '../SequelizeSchema';

function arrayHandler(
  schema: Indexable,
  value: any,
  dialect: string,
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
    newArray.push(_parseQuery(schema, val, dialect, relations, associations));
  }
  return newArray;
}

function constructOrArray(value: any) {
  const orArray = [];
  for (const v of value) {
    orArray.push(
      { [Op.like]: `${v}` },
      { [Op.like]: `${v};%` },
      { [Op.like]: `%;${v}` },
      { [Op.like]: `%;${v};%` },
    );
  }
  return orArray;
}

function matchOperation(
  schema: Indexable,
  previousKey: any,
  operator: string,
  value: any,
  dialect: string,
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
      if (
        !isArray(schema.compiledFields[previousKey]) ||
        schema.compiledFields[previousKey][0].type === 'Relation'
      ) {
        return { [Op.in]: arrayHandler(schema, value, dialect, relations, associations) };
      } else if (dialect === 'postgres') {
        return {
          [Op.overlap]: arrayHandler(schema, value, dialect, relations, associations),
        };
      } else {
        return { [Op.or]: constructOrArray(value) };
      }
    case '$or':
      return arrayHandler(schema, value, dialect, relations, associations);
    case '$and':
      return arrayHandler(schema, value, dialect, relations, associations);
    case '$like':
      return { [Op.like]: value };
    case '$ilike':
      if (dialect === 'postgres') {
        return { [Op.iLike]: value };
      } else {
        // fall back to case-sensitive $like
        return { [Op.like]: value };
      }
    default:
      return value;
  }
}

function _parseQuery(
  schema: Indexable,
  query: ParsedQuery,
  dialect: string,
  relations: {
    relations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    relationsDirectory: string[];
  },
  associations?: {
    associations: { [key: string]: SequelizeSchema | SequelizeSchema[] };
    associationsDirectory: { [key: string]: string[] };
  },
  previousKey?: any, // Retain previous key for $in and $nin operators
) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (
    isString(query) ||
    isBoolean(query) ||
    isNumber(query) ||
    query instanceof Buffer ||
    query instanceof Date
  )
    return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) =>
          _parseQuery(schema, operation, dialect, relations, associations),
        ),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) =>
          _parseQuery(schema, operation, dialect, relations, associations),
        ),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      // Reconstruct query when next operator is $nin
      const nextKey = !isNil(query[key]) ? Object.keys(query[key])[0] : null;
      if (nextKey === '$nin') {
        const reconstructedSubQuery = { [key]: { $in: query[key][nextKey] } };
        Object.assign(parsed, {
          [Op.not]: _parseQuery(
            schema,
            reconstructedSubQuery,
            dialect,
            relations,
            associations,
            '$nin',
          ),
        });
        return parsed;
      }
      const subQuery = _parseQuery(
        schema,
        query[key],
        dialect,
        relations,
        associations,
        key,
      );
      if (subQuery === undefined) continue;
      const matched = matchOperation(
        schema,
        previousKey,
        key,
        subQuery,
        dialect,
        relations,
        associations,
      );
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
          ) ||
          handleEmbeddedJson(key, matched, dialect) || { [key]: matched }),
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
    // many-to-many relations and querying of fields other than id
    if (Array.isArray(relations[key]) || key.indexOf('.') !== -1) {
      if (requiredRelations.indexOf(key) === -1) {
        requiredRelations.push(key);
      }
      return { [`$${key}${key.indexOf('.') !== -1 ? '' : '._id'}$`]: value };
    } else {
      return { [`${key}Id`]: value };
    }
  }
}

function handleEmbeddedJson(key: string, value: any, dialect: string) {
  if (dialect === 'postgres' || key.indexOf('.') === -1) return null;
  const keyArray = key.split('.');
  // Should not be a relation or association
  // if ((relations && relations[keyArray[0]]) ||
  //   (associations && associations[keyArray[0]]))
  //   return null;
  let embeddedJson = {};
  for (let i = keyArray.length - 1; i >= 0; i--) {
    const k = i !== 0 ? `"${keyArray[i]}"` : keyArray[i];
    const v = i !== keyArray.length - 1 ? embeddedJson : value;
    embeddedJson = { [k]: v };
  }
  return embeddedJson;
}

export function parseQuery(
  schema: Indexable,
  query: ParsedQuery,
  dialect: string,
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  queryOptions: { populate?: string[]; select?: string; exclude?: string[] },
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
    ..._parseQuery(schema, query, dialect, {
      relations,
      relationsDirectory: parsingResult.requiredRelations,
    }),
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
  const includedRelations = [];
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
      if (relations[tmp]) {
        includedRelations.push(tmp);
        if (!Array.isArray(relations[tmp])) {
          // @ts-ignore
          include.push([tmp + 'Id', tmp]);
          exclude.push(tmp + 'Id');
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
      returnIncludes = true;
      const tmp = attribute;
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
  return returnIncludes ? [...include] : { include, exclude };
}

export function renameRelations(
  population: string[],
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];

  for (const relation in relations) {
    if (population.indexOf(relation) !== -1) continue;
    if (!Array.isArray(relations[relation])) {
      // @ts-ignore
      include.push([relation + 'Id', relation]);
      exclude.push(relation + 'Id');
    }
  }

  return {
    include,
    exclude,
  };
}

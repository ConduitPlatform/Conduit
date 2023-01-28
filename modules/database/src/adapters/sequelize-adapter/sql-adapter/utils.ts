import { ModelStatic, Op } from 'sequelize';
import { SQLSchema } from './SQLSchema';
import _, { isArray, isBoolean, isNumber, isObject, isString, merge } from 'lodash';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { ParsedQuery } from '../../../interfaces';

function arrayHandler(
  value: any,
  relations: Indexable,
  relationsDirectory: string[],
  associations?: Indexable,
  associationsDirectory?: { [key: string]: string[] },
) {
  const newArray = [];
  for (const val of value) {
    newArray.push(
      parseQuery(val, relations, relationsDirectory, associations, associationsDirectory),
    );
  }
  return newArray;
}

function matchOperation(
  operator: string,
  value: any,
  relations: Indexable,
  relationsDirectory: string[],
  associations?: Indexable,
  associationsDirectory?: { [key: string]: string[] },
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
        [Op.in]: arrayHandler(
          value,
          relations,
          relationsDirectory,
          associations,
          associationsDirectory,
        ),
      };
    case '$or':
      return arrayHandler(
        value,
        relations,
        relationsDirectory,
        associations,
        associationsDirectory,
      );
    case '$and':
      return arrayHandler(
        value,
        relations,
        relationsDirectory,
        associations,
        associationsDirectory,
      );
    case '$nin':
      return {
        [Op.notIn]: arrayHandler(
          value,
          relations,
          relationsDirectory,
          associations,
          associationsDirectory,
        ),
      };
    default:
      return value;
  }
}

export function parseQuery(
  query: ParsedQuery,
  relations: Indexable,
  relationsDirectory: string[],
  associations?: Indexable,
  associationsDirectory?: { [key: string]: string[] },
) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query) || isNumber(query)) return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) =>
          parseQuery(
            operation,
            relations,
            relationsDirectory,
            associations,
            associationsDirectory,
          ),
        ),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) =>
          parseQuery(
            operation,
            relations,
            relationsDirectory,
            associations,
            associationsDirectory,
          ),
        ),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      const subQuery = parseQuery(
        query[key],
        relations,
        relationsDirectory,
        associations,
        associationsDirectory,
      );
      if (subQuery === undefined) continue;
      const matched = matchOperation(
        key,
        subQuery,
        relations,
        relationsDirectory,
        associations,
        associationsDirectory,
      );
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
        continue;
      } else {
        // Check if key contains an association
        let assocKey = key.indexOf('.') !== -1 ? key.split('.')[0] : key;
        if (associations && associations[assocKey]) {
          // if it is not already in the requiredAssociations array
          if (!associationsDirectory![assocKey]) {
            associationsDirectory![assocKey] = [key];
          }
          if (key.indexOf('.') !== -1) {
            parsed[`$${key}$`] = matched;
          } else {
            parsed[`$${key}._id$`] = matched;
          }
          continue;
        }
      }
      parsed[key] = matched;
    }
  }
  if (
    Object.keys(parsed).length === 0 &&
    Object.getOwnPropertySymbols(parsed).length === 0
  )
    return;
  return parsed;
}

function patch(query: Indexable, key: string) {
  if (query[key][Op.in]) {
    delete query[key];
    // @ts-ignore
    query[Op.or] = query[key][Op.in].map((value: any) => {
      return { [Op.like]: `%;${value};%` };
    });
  } else if (query[key][Op.notIn]) {
    delete query[key];
    // @ts-ignore
    query[Op.and] = query[key][Op.notIn].map((value: any) => {
      return { [Op.notLike]: `%;${value};%` };
    });
  }
}

export function arrayFind(
  key: string,
  fields: Indexable,
  associations: { [key: string]: SQLSchema | SQLSchema[] },
): boolean {
  if (fields[key]) {
    if (Array.isArray(fields[key])) {
      return true;
    } else if (Array.isArray(fields[key].type)) {
      return true;
    }
  } else if (key.indexOf('.') !== -1) {
    let assocKey = key.split('.')[0];
    let remain = key.split('.').slice(1).join('.');
    if (associations[assocKey]) {
      let assoc: SQLSchema = Array.isArray(associations[assocKey])
        ? (associations[assocKey] as SQLSchema[])[0]
        : (associations[assocKey] as SQLSchema);
      return arrayFind(remain, assoc.originalSchema.fields, assoc.associations);
    }
  }
  return false;
}

export function arrayPatch(
  dialect: string,
  query: Indexable,
  fields: Indexable,
  associations: { [key: string]: SQLSchema | SQLSchema[] },
) {
  if (dialect === 'postgres') return query;
  let newQuery = JSON.parse(JSON.stringify(query));
  for (const key in query) {
    if (fields[key]) {
      if (Array.isArray(fields[key])) {
        patch(newQuery, key);
      } else if (Array.isArray(fields[key].type)) {
        patch(newQuery, key);
      }
    } else if (key.indexOf('.') !== -1) {
      let assocKey = key.split('.')[0];
      if (associations[assocKey]) {
        let assoc: SQLSchema = Array.isArray(associations[assocKey])
          ? (associations[assocKey] as SQLSchema[])[0]
          : (associations[assocKey] as SQLSchema);
        let found = arrayFind(key, assoc.originalSchema.fields, assoc.associations);
        if (found) patch(newQuery, key);
      }
    }
  }
  return newQuery;
}

export function extractAssociationsFromObject(
  query: ParsedQuery | ParsedQuery[],
  associations?: { [key: string]: SQLSchema | SQLSchema[] },
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

export const extractAssociations = (
  model: ModelStatic<any>,
  associations: { [key: string]: SQLSchema | SQLSchema[] },
) => {
  for (const association in associations) {
    if (associations.hasOwnProperty(association)) {
      const value = associations[association];
      if (Array.isArray(value)) {
        const item = value[0];
        model.hasMany(item.model, {
          foreignKey: association,
          as: association,
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      } else {
        model.hasOne(value.model, {
          foreignKey: association,
          as: association,
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      }
    }
  }
};

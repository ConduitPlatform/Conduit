import { Op } from 'sequelize';
import _, { isArray, isBoolean, isObject, isString } from 'lodash';
import {
  ConduitModel,
  Indexable,
  MongoIndexOptions,
  PostgresIndexOptions,
} from '@conduitplatform/grpc-sdk';
import { SequelizeAdapter } from './index';
import { SequelizeSchema } from './SequelizeSchema';
import { ParsedQuery } from '../../interfaces';

function arrayHandler(value: any) {
  const newArray = [];
  for (const val of value) {
    newArray.push(parseQuery(val));
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

export function parseQuery(query: ParsedQuery) {
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query)) return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        [Op.or]: query[key].map((operation: ParsedQuery) => {
          return parseQuery(operation);
        }),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        [Op.and]: query[key].map((operation: ParsedQuery) => {
          return parseQuery(operation);
        }),
      });
    } else if (key === '$regex') {
      Object.assign(parsed, { [Op.regexp]: query[key] });
    } else if (key === '$options') {
      continue;
    } else {
      const subQuery = parseQuery(query[key]);
      if (subQuery === undefined) continue;
      const matched = matchOperation(key, subQuery);
      if (key.indexOf('$') !== -1) {
        Object.assign(parsed, matched);
      } else {
        parsed[key] = matched;
      }
    }
  }
  if (
    Object.keys(parsed).length === 0 &&
    Object.getOwnPropertySymbols(parsed).length === 0
  )
    return undefined;
  return parsed;
}

/**
 * @throws {Error}
 */
async function _createOrUpdate(obj: Indexable, model: SequelizeSchema) {
  if (obj.hasOwnProperty('_id')) {
    const _id = obj._id;
    delete obj._id;
    await model.findByIdAndUpdate(_id, JSON.stringify(obj), true);
    return _id;
  } else {
    const doc = await model.create(JSON.stringify(obj));
    return doc._id;
  }
}

/**
 * @throws {Error}
 */
async function _createWithPopulations(
  fields: ParsedQuery,
  document: ParsedQuery,
  adapter: SequelizeAdapter,
  validate: boolean = false,
) {
  for (const key of Object.keys(document)) {
    if (key === '$set') {
      await _createWithPopulations(fields, document[key], adapter, validate);
      continue;
    }

    if (!fields.hasOwnProperty(key)) continue;
    if (!isObject(fields[key])) continue;
    if (fields[key] === 'JSON' || fields[key].type === 'JSON') continue;

    if (isArray(document[key])) {
      for (let i = 0; i < document[key].length; i++) {
        const val = document[key][i];
        if (!isObject(val)) {
          continue;
        }
        if (fields[key][0].hasOwnProperty('model')) {
          const { model } = adapter.getSchemaModel(fields[key][0].model);
          if (validate) {
            // await model.model.validate(val);
            return;
          } else {
            document[key][i] = await _createOrUpdate(val, model);
          }
        } else {
          await _createWithPopulations(fields[key][0], val, adapter, validate);
        }
      }
    } else if (isObject(document[key])) {
      if (fields[key].hasOwnProperty('model')) {
        const { model } = adapter.getSchemaModel(fields[key].model);
        if (validate) {
          // await model.model.validate(document[key]);
          return;
        } else {
          document[key] = await _createOrUpdate(document[key], model);
        }
      } else {
        await _createWithPopulations(fields[key], document[key], adapter, validate);
      }
    }
  }
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

/**
 * @throws {Error}
 */
export async function createWithPopulations(
  fields: ConduitModel,
  document: ParsedQuery,
  adapter: SequelizeAdapter,
): Promise<any> {
  // TODO find a way to validate the whole object, now only the inner objects are validated.
  // The problem is that if we validate the object it will fail because the references will have an object
  // that must be created and be replaced with the _id (which isn't happening on the validation call)

  await _createWithPopulations(fields, _.cloneDeep(document), adapter, true);
  await _createWithPopulations(fields, document, adapter);
}

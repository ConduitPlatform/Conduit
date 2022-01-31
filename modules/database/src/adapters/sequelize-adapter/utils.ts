import { Op } from 'sequelize';
import _, { isArray, isObject } from 'lodash';
import { ConduitModel } from '@conduitplatform/conduit-grpc-sdk';
import { SequelizeAdapter } from './index';
import { SequelizeSchema } from './SequelizeSchema';

const deepdash = require('deepdash/standalone');

function arrayHandler(value: any) {
  let newArray = [];
  for (let val of value) {
    newArray.push(parseQuery(val));
  }
  return newArray;
}

function matchOperation(operator: string, value: any) {
  switch (operator) {
    case '$eq':
      return { [Op.eq]: value };
    case '$ne':
      return { [Op.ne]: value };
    case '$gt':
      return { [Op.gt]: value };
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

function replaceInPath(parsed: any, path: any[], replacedValue: any) {
  if (path.indexOf('$or') !== -1) {
    path.splice(path.indexOf('$or'), 1);
    path.push(Op.or);
  } else if (path.indexOf('$and') !== -1) {
    path.splice(path.indexOf('$and'), 1);
    path.push(Op.and);
  } else if (path.indexOf('$regex') !== -1) {
    path.splice(path.indexOf('$regex'), 1);
    path.push(Op.like);
    replacedValue = replacedValue.replace('.*', '%');
    replacedValue = replacedValue.replace('.*', '%');
  }
  return _.set(parsed, path, replacedValue);
}

export function parseQuery(query: any) {
  let parsed: any = {};

  deepdash.eachDeep(query, (value: any, key: any, parentValue: any, context: any) => {
    if (
      !parentValue?.hasOwnProperty(key) ||
      Array.isArray(parentValue) ||
      context._item.strPath.indexOf('[') !== -1 ||
      key === '$options'
    ) {
      return true;
    }
    let t = matchOperation(key, value);
    let path = context._item.parentItem.path;
    path = path ?? [key];
    parsed = replaceInPath(parsed, path, t);

    // console.log('Value: ', value);
    // console.log('StringPath: ', path);
    // console.log('Key: ', key);
    // console.log('ParentValue: ', parentValue);
  });
  console.log('Sequelize Parse Debug: ', parsed);
  return parsed;
}

/**
 * @throws {Error}
 */
async function _createOrUpdate(obj: any, model: SequelizeSchema) {
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
  fields: { [key: string]: any },
  document: { [key: string]: any },
  adapter: SequelizeAdapter,
  validate: boolean = false
) {
  for (const key of Object.keys(document)) {
    if (key === '$set') {
      await _createWithPopulations(fields, document[key], adapter, validate);
      continue;
    }

    if (!fields.hasOwnProperty(key)) continue;
    if (!isObject(fields[key])) continue;
    if (fields[key].type?.schemaName === 'Mixed') continue;
    if (fields[key].schemaName === 'Mixed') continue;

    if (isArray(document[key])) {
      for (let i = 0; i < document[key].length; i++) {
        let val: any = document[key][i];
        if (!isObject(val)) {
          continue;
        }
        if (fields[key][0].hasOwnProperty('ref')) {
          const { model } = adapter.getSchemaModel(fields[key][0].ref);
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
      if (fields[key].hasOwnProperty('ref')) {
        const { model } = adapter.getSchemaModel(fields[key].ref);
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

/**
 * @throws {Error}
 */
export async function createWithPopulations(
  fields: ConduitModel,
  document: { [key: string]: any },
  adapter: SequelizeAdapter
): Promise<any> {
  // TODO find a way to validate the whole object, now only the inner objects are validated.
  // The problem is that if we validate the object it will fail because the references will have an object
  // that must be created and be replaced with the _id (which isn't happening on the validation call)

  await _createWithPopulations(fields, _.cloneDeep(document), adapter, true);
  await _createWithPopulations(fields, document, adapter);
}

import {
  ConduitModel,
  Indexable,
  MongoIndexOptions,
  PostgresIndexOptions,
} from '@conduitplatform/grpc-sdk';
import { MongooseAdapter } from './index.js';
import { cloneDeep, isArray, isObject } from 'lodash-es';
import { MongooseSchema } from './MongooseSchema.js';
import { Doc, Fields } from '../SchemaAdapter.js';

/**
 * @throws {Error}
 */
async function _createOrUpdate(obj: Indexable, model: MongooseSchema) {
  if (obj.hasOwnProperty('_id')) {
    const _id = obj._id;
    delete obj._id;
    await model.findByIdAndUpdate(_id, JSON.stringify(obj));
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
  fields: Fields,
  document: Doc,
  adapter: MongooseAdapter,
  validate: boolean = false,
) {
  for (const key of Object.keys(document)) {
    if (key === '$set') {
      await _createWithPopulations(fields, document[key], adapter, validate);
      continue;
    }

    if (!fields.hasOwnProperty(key)) continue;
    if (!isObject(fields[key])) continue;
    // @ts-expect-error
    if (fields[key] === 'JSON' || fields[key].type === 'JSON') continue;

    if (isArray(document[key])) {
      for (let i = 0; i < document[key].length; i++) {
        const val = document[key][i];
        if (!isObject(val)) {
          continue;
        }
        let field = fields[key];
        // @ts-expect-error
        if (!isArray(field) && field.type && isArray(field.type)) {
          // @ts-expect-error
          field = field.type;
        }
        // @ts-expect-error
        if (field[0].hasOwnProperty('model')) {
          // @ts-expect-error
          const { model } = adapter.getSchemaModel(field[0].model);
          if (validate) {
            await model.model.validate(val);
          } else {
            document[key][i] = await _createOrUpdate(val, model);
          }
        } else {
          // @ts-expect-error
          await _createWithPopulations(field[0], val, adapter, validate);
        }
      }
    } else if (isObject(document[key])) {
      if (fields[key].hasOwnProperty('model')) {
        // @ts-expect-error
        const { model } = adapter.getSchemaModel(fields[key].model);
        if (validate) {
          await model.model.validate(document[key]);
        } else {
          document[key] = await _createOrUpdate(document[key], model);
        }
      } else {
        await _createWithPopulations(fields[key], document[key], adapter, validate);
      }
    }
  }
}

export function checkIfMongoOptions(options: MongoIndexOptions | PostgresIndexOptions) {
  const mongoOptions = [
    'background',
    'unique',
    'name',
    'partialFilterExpression',
    'sparse',
    'expireAfterSeconds',
    'storageEngine',
    'commitQuorum',
    'version',
    'weights',
    'default_language',
    'language_override',
    'textIndexVersion',
    '2dsphereIndexVersion',
    'bits',
    'min',
    'max',
    'bucketSize',
    'wildcardProjection',
    'hidden',
  ];
  const result = Object.keys(options).some(option => !mongoOptions.includes(option));
  return !result;
}

/**
 * @throws {Error}
 */
export async function createWithPopulations(
  fields: ConduitModel,
  document: Doc,
  adapter: MongooseAdapter,
): Promise<any> {
  // TODO find a way to validate the whole object, now only the inner objects are validated.
  // The problem is that if we validate the object it will fail because the references will have an object
  // that must be created and be replaced with the _id (which isn't happening on the validation call)

  await _createWithPopulations(fields, cloneDeep(document), adapter, true);
  await _createWithPopulations(fields, document, adapter);
}

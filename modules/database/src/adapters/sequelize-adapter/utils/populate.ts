import { ConduitModel, Indexable } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema';
import { ParsedQuery } from '../../../interfaces';
import { SequelizeAdapter } from '../index';
import _, { isArray, isObject } from 'lodash';

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

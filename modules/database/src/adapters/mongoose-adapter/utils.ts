import { ConduitModel } from '@quintessential-sft/conduit-grpc-sdk';
import { MongooseAdapter } from './index';
import _, { isArray, isObject } from 'lodash';
import { MongooseSchema } from './MongooseSchema';

/**
 * @throws {Error}
 */
async function _createOrUpdate(obj: any, model: MongooseSchema) {
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
  adapter: MongooseAdapter,
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
            await model.model.validate(val);
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

/**
 * @throws {Error}
 */
export async function createWithPopulations(
  fields: ConduitModel,
  document: { [key: string]: any },
  adapter: MongooseAdapter
): Promise<any> {
  // TODO find a way to validate the whole object, now only the inner objects are validated.
  // The problem is that if we validate the object it will fail because the references will have an object
  // that must be created and be replaced with the _id (which isn't happening on the validation call)

  await _createWithPopulations(fields, _.cloneDeep(document), adapter, true);
  await _createWithPopulations(fields, document, adapter);
}

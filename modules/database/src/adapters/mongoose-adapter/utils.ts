import { ConduitModel } from '@quintessential-sft/conduit-grpc-sdk';
import { MongooseAdapter } from './index';
import { isArray, isObject } from 'lodash';

export async function createWithPopulations(
  fields: ConduitModel,
  document: { [key: string]: any },
  adapter: MongooseAdapter,
): Promise<any> {

  for (const key of Object.keys(document)) {
    if (!isObject(fields[key])) continue;
    if (!fields.hasOwnProperty(key)) continue;

    try {
      if (isArray(document[key])) {
        for (let i = 0; i < document[key].length; i++) {
          let val = document[key][i];
          if (!isObject(val)) {
            continue;
          }
          // @ts-ignore
          if (fields[key][0].hasOwnProperty('ref')) {
            // @ts-ignore
            const model = adapter.getSchemaModel(fields[key][0].ref);
            const doc = await model.create(val);
            document[key][i] = doc._id;
          } else {
            // @ts-ignore
            await createWithPopulations(fields[key][0], val, adapter);
          }
        }
      } else if (isObject(document[key])) {
        if (fields[key].hasOwnProperty('ref')) {
          // @ts-ignore
          const model = adapter.getSchemaModel(fields[key].ref);
          const doc = await model.create(document[key]);
          document[key] = doc._id;
        } else {
          // @ts-ignore
          await createWithPopulations(fields[key], document[key], adapter);
        }
      }
    } catch (e) {
      return Promise.reject(e.message);
    }
  }
}

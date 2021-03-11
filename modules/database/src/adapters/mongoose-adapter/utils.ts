import { ConduitModel } from '@quintessential-sft/conduit-grpc-sdk';
import { Model } from 'mongoose';
import { MongooseAdapter } from './index';

export async function createWithPopulations(
  originalSchema: ConduitModel,
  document: any,
  adapter: MongooseAdapter
): Promise<any> {
  let keys = Object.keys(originalSchema);

  for (let i = 0; i < keys.length; i++) {
    let field = keys[i];
    if (!originalSchema.hasOwnProperty(field)) continue;
    // if (
    //   // !originalSchema[field].type &&
    //   originalSchema[field].type &&
    //   typeof originalSchema[field].type !== 'string'
    // ) {
    // }
    // // @ts-ignore
    // if (originalSchema[field].model) {
    //   if (document[field]._id) {
    //     document[field] = document[field]._id;
    //     continue;
    //   }

    if (Array.isArray(document[field])) {
      for (let k = 0; k < document[field].length; k++) {
        if (document[field][k]._id) {
          document[field][k] = document[field][k]._id;
          continue;
        }
        // @ts-ignore
        let model: Model<any> = adapter.getSchemaModel(
          // @ts-ignore
          originalSchema[field].model
        );
        let doc = await model.create(Object.assign({}, document[field][k]));
        document[field][k] = doc._id;
      }
    } else {
      // @ts-ignore
      let model: Model<any> = adapter.getSchemaModel(
        // @ts-ignore
        originalSchema[field].model
      );
      let doc = await model.create(Object.assign({}, document[field]));
      document[field] = doc._id;
    }
  }
  return document;
}

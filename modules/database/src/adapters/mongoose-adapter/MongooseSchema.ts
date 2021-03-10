import { Model, Mongoose, Schema } from 'mongoose';
import { SchemaAdapter } from '../../interfaces';
import { MongooseAdapter } from './index';
import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';

export class MongooseSchema implements SchemaAdapter {
  model: Model<any>;
  originalSchema: ConduitSchema;

  constructor(mongoose: Mongoose, schema: ConduitSchema, deepPopulate: any,
              private readonly adapter: MongooseAdapter) {
    this.originalSchema = schema;
    let mongooseSchema = new Schema(schema.modelSchema as any, schema.modelOptions);
    mongooseSchema.plugin(deepPopulate, {});
    this.model = mongoose.model(schema.name, mongooseSchema);
  }

  async createWithPopulations(originalSchema: Model<any>, document: any): Promise<any> {
    let keys = Object.keys(originalSchema);
    for (let i = 0; i < keys.length; i++) {
      let field = keys[i];
      if (!originalSchema.hasOwnProperty(field)) continue;
      // @ts-ignore
      if (
        // @ts-ignore
        !originalSchema[field].model &&
        // @ts-ignore
        originalSchema[field].type &&
        // @ts-ignore
        typeof originalSchema[field].type !== 'string'
      ) {
      }
      // @ts-ignore
      if (originalSchema[field].model) {
        if (document[field]._id) {
          document[field] = document[field]._id;
          continue;
        }

        if (Array.isArray(document[field])) {
          for (let k = 0; k < document[field].length; k++) {
            if (document[field][k]._id) {
              document[field][k] = document[field][k]._id;
              continue;
            }
            // @ts-ignore
            let model: Model<any> = this.adapter.getSchemaModel(
              // @ts-ignore
              originalSchema[field].model
            );
            let doc = await model.create(Object.assign({}, document[field][k]));
            document[field][k] = doc._id;
          }
        } else {
          // @ts-ignore
          let model: Model<any> = this.adapter.getSchemaModel(
            // @ts-ignore
            originalSchema[field].model
          );
          let doc = await model.create(Object.assign({}, document[field]));
          document[field] = doc._id;
        }
      }
    }
    return document;
  }

  async create(query: any): Promise<any> {
    query.createdAt = new Date();
    query.updatedAt = new Date();
    query = await this.createWithPopulations(this.model, query);
    return this.model.create(query).then((r) => r.toObject());
  }

  async createMany(docs: any[]): Promise<any> {
    let date = new Date();
    for (let i = 0; i < docs.length; i++) {
      let doc = docs[i];
      doc.createdAt = date;
      doc.updatedAt = date;
      doc = await this.createWithPopulations(this.model, doc);
    }

    return this.model.insertMany(docs).then((r) => r);
  }

  async findByIdAndUpdate(id: string, query: any): Promise<any> {
    // check if it is a document
    if (!query['$set']) {
      query['updatedAt'] = new Date();
    } else {
      query['$set']['updatedAt'] = new Date();
    }
    query = await this.createWithPopulations(this.model, query);
    return this.model.findByIdAndUpdate(id, query, { new: true }).lean().exec();
  }

  async updateMany(filterQuery: any, query: any): Promise<any> {
    query = await this.createWithPopulations(this.model, query);
    return this.model.updateMany(filterQuery, query).exec();
  }

  deleteOne(query: any): Promise<any> {
    return this.model.deleteOne(query).exec();
  }

  deleteMany(query: any): Promise<any> {
    return this.model.deleteMany(query).exec();
  }

  calculatePopulates(queryObj: any, population: string[]) {
    population.forEach((r: any, index: number) => {
      let final = r.toString();
      if (r.indexOf('.') !== -1) {
        final = '';
        r = r.split('.');
        let controlBool = true;
        while (controlBool) {
          if (this.originalSchema.modelSchema[r[0]]) {
            controlBool = false;
          } else {
            r.splice(0, 1);
          }
        }
        population[index] = r.join('.');
      }
    });
    // @ts-ignore
    queryObj = queryObj.deepPopulate(population);

    return queryObj;
  }

  findMany(
    query: any,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: string,
    populate?: string[]
  ): Promise<any> {
    let finalQuery = this.model.find(query);
    if (skip !== null) {
      finalQuery = finalQuery.skip(skip!);
    }
    if (limit !== null) {
      finalQuery = finalQuery.limit(limit!);
    }
    if (populate != null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    if (sort !== null) {
      finalQuery = finalQuery.sort(sort);
    }
    // } else {
    //   finalQuery = finalQuery.sort({ createdAt: -1 });
    // }
    return finalQuery.lean().exec();
  }

  findOne(query: any, select?: string, populate?: string[]): Promise<any> {
    let finalQuery = this.model.findOne(query, select);
    if (populate !== undefined && populate !== null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  countDocuments(query: any) {
    return this.model.find(query).countDocuments().exec();
  }
}

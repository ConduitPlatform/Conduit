import { Model, Mongoose, Schema } from 'mongoose';
import { MultiDocQuery, Query, SchemaAdapter, SingleDocQuery } from '../../interfaces';
import { MongooseAdapter } from './index';
import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { createWithPopulations } from './utils';

const EJSON = require('mongodb-extended-json');

export class MongooseSchema implements SchemaAdapter<Model<any>> {
  model: Model<any>;
  originalSchema: ConduitSchema;

  constructor(
    mongoose: Mongoose,
    schema: ConduitSchema,
    originalSchema: any,
    deepPopulate: any,
    private readonly adapter: MongooseAdapter,
  ) {
    this.originalSchema = originalSchema;
    let mongooseSchema = new Schema(schema.modelSchema as any, schema.schemaOptions);
    mongooseSchema.plugin(deepPopulate, {});
    this.model = mongoose.model(schema.name, mongooseSchema);
  }

  async create(query: SingleDocQuery): Promise<any> {
    let parsedQuery: { [key: string]: any };
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }

    parsedQuery.createdAt = new Date();
    parsedQuery.updatedAt = new Date();
    await this.createWithPopulations(parsedQuery);
    return this.model.create(parsedQuery).then((r) => r.toObject());
  }

  async createMany(query: MultiDocQuery): Promise<any> {
    let docs: [{ [key: string]: any }];
    if (typeof query === 'string') {
      docs = EJSON.parse(query);
    } else {
      docs = query;
    }
    let date = new Date();
    for (let doc of docs) {
      doc.createdAt = date;
      doc.updatedAt = date;
      await this.createWithPopulations(doc);
    }

    return this.model.insertMany(docs).then((r) => r);
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    updateProvidedOnly: boolean = false,
    populate?: string[],
  ): Promise<any> {
    let parsedQuery: { [key: string]: any };
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    parsedQuery['updatedAt'] = new Date();
    await this.createWithPopulations(parsedQuery);
    if (updateProvidedOnly) {
      parsedQuery = {
        $set: parsedQuery,
      };
    }
    let finalQuery = this.model.findByIdAndUpdate(id, parsedQuery, { new: true });
    if (populate !== undefined && populate !== null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  async updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    updateProvidedOnly: boolean = false,
  ): Promise<any> {
    let parsedFilter: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof filterQuery === 'string') {
      parsedFilter = EJSON.parse(filterQuery);
    } else {
      parsedFilter = filterQuery;
    }
    let parsedQuery: { [key: string]: any };
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    await this.createWithPopulations(parsedQuery);
    if (updateProvidedOnly) {
      parsedQuery = {
        $set: parsedQuery,
      };
    }
    return this.model.updateMany(this.parseQuery(parsedFilter), parsedQuery).exec();
  }

  deleteOne(query: Query): Promise<any> {
    let parsedQuery: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.deleteOne(this.parseQuery(parsedQuery)).exec();
  }

  deleteMany(query: Query): Promise<any> {
    let parsedQuery: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.deleteMany(this.parseQuery(parsedQuery)).exec();
  }

  calculatePopulates(queryObj: any, population: string[]) {
    population.forEach((r: any, index: number) => {
      let final = r.toString().trim();
      if (r.indexOf('.') !== -1) {
        r = final.split('.');
        let controlBool = true;
        while (controlBool) {
          if (this.originalSchema.modelSchema[r[0]]) {
            controlBool = false;
          } else if (r[0] === undefined || r[0].length === 0 || r[0] === '') {
            throw new Error('Failed populating \'' + final + '\'');
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
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: string,
    populate?: string[],
  ): Promise<any> {
    let parsedQuery: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let finalQuery = this.model.find(this.parseQuery(parsedQuery), select);
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

  findOne(query: Query, select?: string, populate?: string[]): Promise<any> {
    let parsedQuery: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let finalQuery = this.model.findOne(this.parseQuery(parsedQuery), select);
    if (populate !== undefined && populate !== null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  countDocuments(query: Query) {
    let parsedQuery: { [key: string]: any } | [{ [key: string]: any }];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.find(this.parseQuery(parsedQuery)).countDocuments().exec();
  }

  private async createWithPopulations(document: any): Promise<any> {
    return createWithPopulations(this.originalSchema.fields, document, this.adapter);
  }

  private parseQuery(query: any) {
    let parsed: any = {};

    Object.keys(query).forEach((key) => {
      if (query[key]?.hasOwnProperty('$contains')) {
        parsed[key] = { $in: query[key]['$contains'] };
      } else {
        parsed[key] = query[key];
      }
    });

    return parsed;
  }
}

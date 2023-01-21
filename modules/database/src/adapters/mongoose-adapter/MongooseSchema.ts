import { Model, Mongoose, Schema, SortOrder } from 'mongoose';
import {
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces';
import { MongooseAdapter } from './index';
import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { _ConduitSchema, _ConduitSchemaOptions } from '../../interfaces';
import { createWithPopulations } from './utils';
import { isNil } from 'lodash';

const EJSON = require('mongodb-extended-json');

export class MongooseSchema implements SchemaAdapter<Model<any>> {
  model: Model<any>;
  fieldHash: string;

  constructor(
    mongoose: Mongoose,
    schema: ConduitSchema,
    readonly originalSchema: any,
    deepPopulate: any,
    private readonly adapter: MongooseAdapter,
  ) {
    if (!isNil(schema.collectionName)) {
      (schema.modelOptions as _ConduitSchemaOptions).collection = schema.collectionName; // @dirty-type-cast
    } else {
      (schema as _ConduitSchema).collectionName = schema.name; //restore collectionName
    }
    const mongooseSchema = new Schema(schema.fields, schema.modelOptions);
    mongooseSchema.plugin(deepPopulate, {});
    this.model = mongoose.model(schema.name, mongooseSchema);
  }

  async create(query: SingleDocQuery) {
    const parsedQuery = {
      ...(typeof query === 'string' ? EJSON.parse(query) : query),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.createWithPopulations(parsedQuery);
    return this.model.create(parsedQuery).then(r => r.toObject());
  }

  async createMany(query: MultiDocQuery) {
    let docs: ParsedQuery[] = [];
    if (typeof query === 'string') {
      docs = EJSON.parse(query);
    } else {
      docs = query;
    }
    const date = new Date();
    for (const doc of docs) {
      doc.createdAt = date;
      doc.updatedAt = date;
      await this.createWithPopulations(doc);
    }

    return this.model.insertMany(docs).then(r => r);
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    updateProvidedOnly: boolean = false,
    populate?: string[],
  ) {
    let parsedQuery: ParsedQuery;
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
  ) {
    let parsedFilter: ParsedQuery | ParsedQuery[];
    if (typeof filterQuery === 'string') {
      parsedFilter = EJSON.parse(filterQuery);
    } else {
      parsedFilter = filterQuery;
    }
    let parsedQuery: ParsedQuery;
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

  deleteOne(query: Query) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.deleteOne(this.parseQuery(parsedQuery)).exec();
  }

  deleteMany(query: Query) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.deleteMany(this.parseQuery(parsedQuery)).exec();
  }

  private calculatePopulates(queryObj: any, population: string[]) {
    population.forEach((r: string | string[], index: number) => {
      const final = r.toString().trim();
      if (r.indexOf('.') !== -1) {
        r = final.split('.');
        let controlBool = true;
        while (controlBool) {
          if (this.originalSchema.fields[r[0]]) {
            controlBool = false;
          } else if (r[0] === undefined || r[0].length === 0 || r[0] === '') {
            throw new Error("Failed populating '" + final + "'");
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
    sort?: { [key: string]: number },
    populate?: string[],
  ) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let finalQuery = this.model.find(this.parseQuery(parsedQuery), select);
    if (!isNil(skip)) {
      finalQuery = finalQuery.skip(skip!);
    }
    if (!isNil(limit)) {
      finalQuery = finalQuery.limit(limit!);
    }
    if (!isNil(populate)) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    if (!isNil(sort)) {
      finalQuery = finalQuery.sort(this.parseSort(sort));
    }
    // } else {
    //   finalQuery = finalQuery.sort({ createdAt: -1 });
    // }
    return finalQuery.lean().exec();
  }

  findOne(query: Query, select?: string, populate?: string[]) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
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
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = EJSON.parse(query);
    } else {
      parsedQuery = query;
    }
    return this.model.find(this.parseQuery(parsedQuery)).countDocuments().exec();
  }

  private async createWithPopulations(document: ParsedQuery) {
    return createWithPopulations(this.originalSchema.fields, document, this.adapter);
  }

  private parseQuery(query: ParsedQuery) {
    const parsed = {} as ParsedQuery;

    Object.keys(query).forEach(key => {
      if (query[key]?.hasOwnProperty('$contains')) {
        parsed[key] = { $in: query[key]['$contains'] };
      } else {
        parsed[key] = query[key];
      }
    });

    return parsed;
  }

  private parseSort(sort: { [key: string]: number }): { [p: string]: SortOrder } {
    return sort as { [p: string]: SortOrder };
  }
}

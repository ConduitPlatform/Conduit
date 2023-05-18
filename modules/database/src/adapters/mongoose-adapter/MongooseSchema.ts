import {
  Model,
  Mongoose,
  PopulateOptions,
  Query as MongooseQuery,
  Schema,
  SortOrder,
} from 'mongoose';
import {
  _ConduitSchema,
  _ConduitSchemaOptions,
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces';
import { MongooseAdapter } from './index';
import { parseQuery } from './parser';
import { ConduitSchema, Indexable, UntypedArray } from '@conduitplatform/grpc-sdk';
import { cloneDeep, isNil } from 'lodash';

const EJSON = require('mongodb-extended-json');

export class MongooseSchema implements SchemaAdapter<Model<any>> {
  model: Model<any>;
  fieldHash: string;

  constructor(
    mongoose: Mongoose,
    schema: ConduitSchema,
    readonly originalSchema: any,
    private readonly adapter: MongooseAdapter,
  ) {
    if (!isNil(schema.collectionName)) {
      (schema.modelOptions as _ConduitSchemaOptions).collection = schema.collectionName; // @dirty-type-cast
    } else {
      (schema as _ConduitSchema).collectionName = schema.name; //restore collectionName
    }
    const mongooseSchema = new Schema(schema.fields as Indexable, schema.modelOptions);
    this.model = mongoose.model(schema.name, mongooseSchema);
  }

  async create(query: SingleDocQuery) {
    const parsedQuery = {
      ...(typeof query === 'string' ? EJSON.parse(query) : query),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.model.create(parsedQuery).then(r => r.toObject());
  }

  async createMany(query: MultiDocQuery) {
    const docs = typeof query === 'string' ? EJSON.parse(query) : query;
    return this.model.insertMany(docs).then(r => r);
  }

  async findByIdAndUpdate(id: string, query: SingleDocQuery, populate?: string[]) {
    let parsedQuery: ParsedQuery = typeof query === 'string' ? EJSON.parse(query) : query;
    parsedQuery['updatedAt'] = new Date();
    if (!parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = {
        $set: parsedQuery,
      };
    }
    let finalQuery = this.model.findByIdAndUpdate(id, parsedQuery, { new: true });
    if (populate !== undefined && populate !== null) {
      finalQuery = this.populate(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  async updateMany(filterQuery: Query, query: SingleDocQuery, populate?: string[]) {
    const parsedFilter = parseQuery(
      typeof filterQuery === 'string' ? EJSON.parse(filterQuery) : filterQuery,
    );
    let parsedQuery = typeof query === 'string' ? EJSON.parse(query) : query;
    if (!parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = {
        $set: parsedQuery,
      };
    }
    const affectedIds = await this.model
      .find(parsedFilter, '_id')
      .lean()
      .exec()
      .then(r => {
        r.map(r => r._id);
      });
    return this.model
      .updateMany(parsedFilter, parsedQuery)
      .exec()
      .then(() => {
        let finalQuery = this.model.find({ _id: { $in: affectedIds } });
        if (populate !== undefined && populate !== null) {
          finalQuery = this.populate(finalQuery, populate);
        }
        return finalQuery.lean().exec();
      });
  }

  deleteOne(query: Query) {
    const parsedQuery = parseQuery(
      typeof query === 'string' ? EJSON.parse(query) : query,
    );
    return this.model.deleteOne(parsedQuery).exec();
  }

  deleteMany(query: Query) {
    const parsedQuery = parseQuery(
      typeof query === 'string' ? EJSON.parse(query) : query,
    );
    return this.model.deleteMany(parsedQuery).exec();
  }

  findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: { [key: string]: number },
    populate?: string[],
  ) {
    const parsedQuery = parseQuery(
      typeof query === 'string' ? EJSON.parse(query) : query,
    );
    let finalQuery = this.model.find(parsedQuery, select);
    if (!isNil(skip)) {
      finalQuery = finalQuery.skip(skip!);
    }
    if (!isNil(limit)) {
      finalQuery = finalQuery.limit(limit!);
    }
    if (!isNil(populate)) {
      finalQuery = this.populate(finalQuery, populate);
    }
    if (!isNil(sort)) {
      finalQuery = finalQuery.sort(this.parseSort(sort));
    }
    return finalQuery.lean().exec();
  }

  findOne(query: Query, select?: string, populate?: string[]) {
    const parsedQuery = parseQuery(
      typeof query === 'string' ? EJSON.parse(query) : query,
    );
    let finalQuery = this.model.findOne(parsedQuery, select);
    if (populate !== undefined && populate !== null) {
      finalQuery = this.populate(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  countDocuments(query: Query) {
    const parsedQuery = parseQuery(
      typeof query === 'string' ? EJSON.parse(query) : query,
    );
    return this.model.find(parsedQuery).countDocuments().exec();
  }

  async columnExistence(columns: string[]): Promise<boolean> {
    const array: object[] = [];
    for (const column of columns) {
      array.push({ [column]: { $exists: true } });
    }
    const result = await this.model.db
      .collection(this.originalSchema.collectionName)
      .findOne({ $and: array });
    return result !== null;
  }

  public calculatePopulates(population: string[]) {
    const populates: (string | PopulateOptions)[] = [];
    population.forEach((r: string | string[], index: number) => {
      const final = r.toString().trim();
      if (final.indexOf('.') !== -1) {
        let controlBool = true;
        let processing = cloneDeep(final);
        while (controlBool) {
          if (this.model.schema.paths[processing]) {
            controlBool = false;
          } else if (
            processing === undefined ||
            processing.length === 0 ||
            processing === ''
          ) {
            throw new Error("Failed populating '" + final + "'");
          } else {
            const split = processing.split('.');
            split.splice(split.length - 1, 1);
            processing = split.join('.');
          }
        }
        if (processing === final) {
          populates.push(processing);
        } else if (
          this.model.schema.paths[processing].options.ref === undefined &&
          this.model.schema.paths[processing].options.type[0].ref === undefined
        ) {
          throw new Error(
            `Failed populating '${final}', path exists for ${processing} but missing ${
              final.split(processing)[1]
            }`,
          );
        } else {
          let ref =
            this.model.schema.paths[processing].options.ref ||
            this.model.schema.paths[processing].options.type[0].ref;
          const childPopulates = this.adapter.models[ref].calculatePopulates([
            final.replace(processing + '.', ''),
          ]);
          if (populates.indexOf(processing) !== -1) {
            populates.splice(populates.indexOf(processing), 1);
            populates.push({ path: processing, populate: childPopulates });
          } else {
            const found = populates.filter(r => {
              if (
                typeof r === 'object' &&
                r.hasOwnProperty('path') &&
                r['path'] === processing
              ) {
                if (!r.hasOwnProperty('populate')) {
                  r['populate'] = childPopulates;
                } else {
                  r['populate'] = (r['populate']! as UntypedArray).concat(childPopulates);
                }
                return true;
              }
              return false;
            });
            if (found.length === 0) {
              populates.push({ path: processing, populate: childPopulates });
            }
          }
        }
      } else {
        populates.push(final);
      }
    });
    return populates;
  }

  public populate(queryObj: MongooseQuery<any, any>, population: string[]) {
    const populates = this.calculatePopulates(population);
    for (const populate of populates) {
      if (typeof populate === 'object') {
        queryObj = queryObj.populate(populate as PopulateOptions);
      } else {
        queryObj = queryObj.populate(populate as string);
      }
    }
    return queryObj;
  }

  private parseSort(sort: { [key: string]: number }): { [p: string]: SortOrder } {
    return sort as { [p: string]: SortOrder };
  }
}

import _, { isNil } from 'lodash';
import {
  DataTypes,
  FindAttributeOptions,
  FindOptions,
  ModelCtor,
  Sequelize,
  OrderItem,
} from 'sequelize';
import {
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces';
import { createWithPopulations, parseQuery } from './utils';
import { SequelizeAdapter } from './index';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';

const deepdash = require('deepdash/standalone');

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SequelizeSchema implements SchemaAdapter<ModelCtor<any>> {
  model: ModelCtor<any>;
  originalSchema: ConduitSchema;
  fieldHash: string;
  excludedFields: string[];
  relations: Indexable;

  constructor(
    sequelize: Sequelize,
    schema: Indexable,
    originalSchema: ConduitSchema,
    private readonly adapter: SequelizeAdapter,
  ) {
    this.originalSchema = originalSchema;
    this.excludedFields = [];
    this.relations = {};
    const self = this;
    let primaryKeyExists = false;
    let idField: string = '';

    deepdash.eachDeep(
      this.originalSchema.fields,
      (value: Indexable, key: string, parentValue: Indexable) => {
        if (!parentValue?.hasOwnProperty(key!)) {
          return true;
        }

        if (parentValue[key].hasOwnProperty('select')) {
          if (!parentValue[key].select) {
            self.excludedFields.push(key);
          }
        }

        if (
          parentValue[key].hasOwnProperty('type') &&
          parentValue[key].type === 'Relation'
        ) {
          this.relations[key] = parentValue[key].model;
        }

        if (parentValue[key].hasOwnProperty('type') && parentValue[key].type === 'JSON') {
          const dialect = sequelize.getDialect();
          if (dialect === 'postgres') {
            parentValue[key].type = DataTypes.JSONB;
          }
        }

        if (
          parentValue[key].hasOwnProperty('primaryKey') &&
          parentValue[key].primaryKey
        ) {
          primaryKeyExists = true;
          idField = key;
        }
      },
    );
    if (!primaryKeyExists) {
      schema.fields._id = {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      };
    } else {
      schema.fields._id = {
        type: DataTypes.VIRTUAL,
        get() {
          return `${this[idField]}`;
        },
      };
    }
    incrementDbQueries();
    this.model = sequelize.define(schema.collectionName, schema.fields, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
  }

  sync() {
    incrementDbQueries();
    return this.model.sync({ alter: true });
  }

  async create(query: SingleDocQuery) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    parsedQuery.createdAt = new Date();
    parsedQuery.updatedAt = new Date();
    incrementDbQueries();
    await this.createWithPopulations(parsedQuery);
    return this.model.create(parsedQuery, { raw: true });
  }

  async createMany(query: MultiDocQuery) {
    let parsedQuery: ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const date = new Date();
    for (const doc of parsedQuery) {
      doc.createdAt = date;
      doc.updatedAt = date;
      await this.createWithPopulations(doc);
    }
    incrementDbQueries();
    return this.model.bulkCreate(parsedQuery);
  }

  async findOne(
    query: Query,
    select?: string,
    populate?: string[],
    relations?: Indexable,
  ) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const options: FindOptions = { where: parseQuery(parsedQuery), raw: true };
    options.attributes = {
      exclude: [...this.excludedFields],
    } as unknown as FindAttributeOptions;
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    incrementDbQueries();
    const document = await this.model.findOne(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        if (this.relations.hasOwnProperty(relation)) {
          if (relations.hasOwnProperty(this.relations[relation])) {
            incrementDbQueries();
            document[relation] = await relations[this.relations[relation]].findOne({
              _id: document[relation],
            });
          }
        }
      }
    }

    return document;
  }

  async findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: string,
    populate?: string[],
    relations?: Indexable,
  ): Promise<any> {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const options: FindOptions = { where: parseQuery(parsedQuery), raw: true };
    options.attributes = {
      exclude: [...this.excludedFields],
    } as unknown as FindAttributeOptions;
    if (!isNil(skip)) {
      options.offset = skip;
    }
    if (!isNil(limit)) {
      options.limit = limit;
    }
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    if (!isNil(sort)) {
      options.order = this.parseSort(sort);
    }

    const documents = await this.model.findAll(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        const cache: Indexable = {};
        for (const document of documents) {
          if (this.relations.hasOwnProperty(relation)) {
            if (relations.hasOwnProperty(this.relations[relation])) {
              if (!cache.hasOwnProperty(document[relation])) {
                incrementDbQueries();
                cache[document[relation]] = await relations[
                  this.relations[relation]
                ].findOne({ _id: document[relation] });
              }
              document[relation] = cache[document[relation]];
            }
          }
        }
      }
    }

    return documents;
  }

  deleteOne(query: Query) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    return this.model.destroy({ where: parseQuery(parsedQuery), limit: 1 });
  }

  deleteMany(query: Query) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    return this.model.destroy({ where: parseQuery(parsedQuery) });
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    updateProvidedOnly: boolean = false,
    populate?: string[],
    relations?: Indexable,
  ) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    if (parsedQuery.hasOwnProperty('$inc')) {
      incrementDbQueries();
      await this.model.increment(parsedQuery['$inc'], { where: { _id: id } }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      delete parsedQuery['$inc'];
    }

    if (updateProvidedOnly) {
      const record = await this.model.findByPk(id, { raw: true }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      if (!isNil(record)) {
        parsedQuery = { ...record, ...parsedQuery };
      }
    } else if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
      incrementDbQueries();
      const record = await this.model.findByPk(id, { raw: true }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      if (!isNil(record)) {
        parsedQuery = { ...record, ...parsedQuery };
      }
    }

    if (parsedQuery.hasOwnProperty('$push')) {
      for (const key in parsedQuery['$push']) {
        incrementDbQueries();
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                parsedQuery['$push'][key],
              ),
            },
            { where: { _id: id } },
          )
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });
      }
      delete parsedQuery['$push'];
    }

    if (parsedQuery.hasOwnProperty('$pull')) {
      const dbDocument = await this.model.findByPk(id).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      for (const key in parsedQuery['$push']) {
        const ind = dbDocument[key].indexOf(parsedQuery['$push'][key]);
        if (ind > -1) {
          dbDocument[key].splice(ind, 1);
        }
      }
      incrementDbQueries();
      await this.model.update(parsedQuery, { where: { _id: id } }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      delete parsedQuery['$pull'];
    }

    parsedQuery.updatedAt = new Date();
    incrementDbQueries();
    await this.createWithPopulations(parsedQuery);
    const document = (await this.model.upsert({ _id: id, ...parsedQuery }))[0];
    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        const cache: Indexable = {};
        if (this.relations.hasOwnProperty(relation)) {
          if (relations.hasOwnProperty(this.relations[relation])) {
            if (!cache.hasOwnProperty(document[relation])) {
              incrementDbQueries();
              cache[document[relation]] = await relations[
                this.relations[relation]
              ].findOne({ _id: document[relation] });
            }
            document[relation] = cache[document[relation]];
          }
        }
      }
    }

    return document;
  }

  async updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    updateProvidedOnly: boolean = false,
  ) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let parsedFilter: ParsedQuery | ParsedQuery[] | undefined;
    if (typeof filterQuery === 'string') {
      parsedFilter = JSON.parse(filterQuery);
    } else {
      parsedFilter = filterQuery;
    }

    parsedFilter = parseQuery(parsedFilter as ParsedQuery | ParsedQuery[]);
    incrementDbQueries();
    if (query.hasOwnProperty('$inc')) {
      await this.model
        // @ts-ignore
        .increment(parsedQuery['$inc'] as any, { where: parsedFilter })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      delete parsedQuery['$inc'];
    }

    if (updateProvidedOnly) {
      incrementDbQueries();
      const record = await this.model
        // @ts-ignore
        .findOne({ where: parsedFilter, raw: true })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      if (!isNil(record)) {
        parsedQuery = _.mergeWith(record, parsedQuery);
      }
    }

    if (parsedQuery.hasOwnProperty('$push')) {
      for (const key in parsedQuery['$push']) {
        incrementDbQueries();
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                parsedQuery['$push'][key],
              ),
            },
            // @ts-ignore
            { where: parsedFilter },
          )
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });
      }
      delete parsedQuery['$push'];
    }

    if (parsedQuery.hasOwnProperty('$pull')) {
      const documents = await this.findMany(filterQuery).catch(
        ConduitGrpcSdk.Logger.error,
      );
      for (const document of documents) {
        for (const key in parsedQuery['$push']) {
          const ind = document[key].indexOf(parsedQuery['$push'][key]);
          if (ind > -1) {
            document[key].splice(ind, 1);
          }
        }
        incrementDbQueries();
        // @ts-ignore
        await this.model.update(document, { where: parsedFilter }).catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      }
      delete parsedQuery['$pull'];
    }

    incrementDbQueries();
    parsedQuery.updatedAt = new Date();
    await this.createWithPopulations(parsedQuery);
    // @ts-ignore
    return this.model.update(parsedQuery, { where: parsedFilter });
  }

  countDocuments(query: Query): Promise<number> {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    return this.model.count({ where: parseQuery(parsedQuery) });
  }

  private async createWithPopulations(document: ParsedQuery) {
    incrementDbQueries();
    return createWithPopulations(this.originalSchema.fields, document, this.adapter);
  }

  private parseSelect(select: string): string[] | { exclude: string[] } {
    const include = [];
    const exclude = [...this.excludedFields];
    const attributes = select.split(' ');
    let returnInclude = false;

    for (const attribute of attributes) {
      if (attribute[0] === '+') {
        const tmp = attribute.slice(1);
        include.push(tmp);

        const ind = exclude.indexOf(tmp);
        if (ind > -1) {
          exclude.splice(ind, 1);
        }
      } else if (attribute[0] === '-') {
        exclude.push(attribute.slice(1));
      } else {
        include.push(attribute);
        returnInclude = true;
      }
    }

    if (returnInclude) {
      return include;
    }

    return { exclude };
  }

  private parseSort(sort: string) {
    const fields = sort.split(' ');
    const order = [];
    for (const field of fields) {
      let tmp;
      if (field[0] === '-') {
        tmp = [field.slice(1), 'DESC'] as OrderItem;
      } else {
        tmp = [field, 'ASC'] as OrderItem;
      }
      order.push(tmp);
    }
    return order;
  }
}

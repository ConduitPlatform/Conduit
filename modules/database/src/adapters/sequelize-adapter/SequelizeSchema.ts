import _, { isNil } from 'lodash';
import {
  DataTypes,
  FindAttributeOptions,
  FindOptions,
  ModelStatic,
  Order,
  OrderItem,
  Sequelize,
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

export class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];
  relations: Indexable;
  _associations: { [key: string]: SequelizeSchema | SequelizeSchema[] };

  constructor(
    sequelize: Sequelize,
    schema: Indexable,
    readonly originalSchema: ConduitSchema,
    private readonly adapter: SequelizeAdapter,
    associations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    this.excludedFields = [];
    this.relations = {};
    this._associations = associations;
    const self = this;
    let primaryKeyExists = false;
    let idField: string = '';

    deepdash.eachDeep(
      schema.fields,
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
    for (const association in associations) {
      if (associations.hasOwnProperty(association)) {
        const value = associations[association];
        if (Array.isArray(value)) {
          const item = value[0];
          if (item instanceof SequelizeSchema) {
            this.model.hasMany(item.model, {
              foreignKey: association,
              as: association,
            });
            // item.model.belongsTo(this.model);
          }
        } else {
          if (value instanceof SequelizeSchema) {
            this.model.hasOne(value.model, {
              foreignKey: association,
              as: association,
            });
            // value.model.belongsTo(this.model);
          }
        }
      }
    }
  }

  sync() {
    const syncOptions = { alter: true };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
    incrementDbQueries();
    for (const association in this._associations) {
      if (this._associations.hasOwnProperty(association)) {
        const value = this._associations[association];
        if (Array.isArray(value)) {
          promiseChain = promiseChain.then(() => value[0].sync());
        } else {
          promiseChain = promiseChain.then(() => value.sync());
        }
      }
    }
    return promiseChain;
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
    return await this.model
      .create(parsedQuery, {
        include: { all: true, nested: true },
      })
      .then(doc => doc.toJSON());
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
    return this.model
      .bulkCreate(parsedQuery, {
        include: {
          all: true,
          nested: true,
        },
      })
      .then(docs => docs.map(doc => doc.toJSON()));
  }

  async findOne(query: Query, select?: string, populate?: string[]) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const options: FindOptions = {
      where: parseQuery(parsedQuery),
      nest: true,
      include: { all: true, nested: true },
    };
    options.attributes = {
      exclude: [...this.excludedFields],
    } as unknown as FindAttributeOptions;
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    incrementDbQueries();
    const document = await this.model.findOne(options).then(doc => doc.toJSON());

    if (!isNil(populate) && !isNil(this.relations)) {
      for (const relationField of populate) {
        if (this.relations.hasOwnProperty(relationField)) {
          const relationSchema = this.relations[relationField];
          incrementDbQueries();
          const schemaModel = this.adapter.getSchemaModel(relationSchema).model;
          document[relationField] = await schemaModel.findOne({
            _id: document[relationField],
          });
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
    sort?: { [field: string]: -1 | 1 },
    populate?: string[],
  ): Promise<any> {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const options: FindOptions = {
      where: parseQuery(parsedQuery),
      nest: true,
      include: { all: true, nested: true, required: false },
    };
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

    const documents = await this.model
      .findAll(options)
      .then(docs => docs.map(doc => doc.toJSON()));

    if (!isNil(populate) && !isNil(this.relations)) {
      for (const relation of populate) {
        const relationField = relation.split('.')[1];
        const cache: Indexable = {};
        for (const document of documents) {
          if (this.relations.hasOwnProperty(relationField)) {
            const relationSchema = this.relations[relationField];
            const cacheIdentifier = `${relation}:${document[relationField]}`;
            if (!cache.hasOwnProperty(cacheIdentifier)) {
              incrementDbQueries();
              const schemaModel = this.adapter.getSchemaModel(relationSchema).model;
              cache[cacheIdentifier] = await schemaModel.findOne({
                _id: document[relationField],
              });
            }
            document[relationField] = cache[cacheIdentifier];
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
      const record = await this.model
        .findByPk(id, { nest: true, include: { all: true, nested: true } })
        .then(doc => doc.toJSON())
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      if (!isNil(record)) {
        parsedQuery = { ...record, ...parsedQuery };
      }
    } else if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
      incrementDbQueries();
      const record = await this.model
        .findByPk(id, { nest: true, include: { all: true, nested: true } })
        .then(doc => doc.toJSON())
        .catch(e => {
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
      const dbDocument = await this.model
        .findByPk(id)
        .then(doc => doc.toJSON())
        .catch(e => {
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
    const document = (await this.model.upsert({ _id: id, ...parsedQuery }))[0].toJSON();
    if (!isNil(populate) && !isNil(this.relations)) {
      for (const relationField of populate) {
        if (this.relations.hasOwnProperty(relationField)) {
          const relationSchema = this.relations[relationField];
          incrementDbQueries();
          const schemaModel = this.adapter.getSchemaModel(relationSchema).model;
          document[relationField] = await schemaModel.findOne({
            _id: document[relationField],
          });
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
        .findOne({
          where: parsedFilter,
          nest: true,
          include: { all: true, nested: true },
        })
        .then(doc => doc.toJSON())
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
    return this.model
      .update(parsedQuery, { where: parsedFilter })
      .then(doc => doc.toJSON());
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

  private parseSort(sort: { [field: string]: -1 | 1 }) {
    const order: Order = [];
    Object.keys(sort).forEach(field => {
      order.push([field, sort[field] === 1 ? 'ASC' : 'DESC'] as OrderItem);
    });
    return order;
  }
}

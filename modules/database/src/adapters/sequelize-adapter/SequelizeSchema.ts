import _, { isNil } from 'lodash';
import {
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
import { extractAssociations, sqlTypesProcess } from './utils/schema';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];
  relations: Indexable;

  constructor(
    sequelize: Sequelize,
    schema: Indexable,
    readonly originalSchema: ConduitSchema,
    private readonly adapter: SequelizeAdapter,
    private readonly associations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    this.excludedFields = [];
    this.relations = {};

    sqlTypesProcess(
      sequelize,
      originalSchema,
      schema,
      this.excludedFields,
      this.relations,
    );

    incrementDbQueries();
    this.model = sequelize.define(schema.collectionName, schema.fields, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
    extractAssociations(this.model, associations);
  }

  sync() {
    const syncOptions = { alter: true };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
    incrementDbQueries();
    for (const association in this.associations) {
      if (this.associations.hasOwnProperty(association)) {
        const value = this.associations[association];
        if (Array.isArray(value)) {
          promiseChain = promiseChain.then(() => value[0].sync());
        } else {
          promiseChain = promiseChain.then(() => value.sync());
        }
      }
    }
    return promiseChain;
  }

  constructAssociationInclusion(requiredAssociations: { [key: string]: string[] }) {
    const inclusionArray = [];
    for (const association in this.associations) {
      if (!this.associations.hasOwnProperty(association)) continue;
      const associationTarget = this.associations[association];
      const associationSchema = Array.isArray(associationTarget)
        ? (associationTarget as SequelizeSchema[])[0]
        : (associationTarget as SequelizeSchema);
      const associationObject: {
        model: ModelStatic<any>;
        as: string;
        required: boolean;
        include?: any;
      } = {
        model: associationSchema.model,
        as: association,
        required: requiredAssociations.hasOwnProperty(association),
      };
      if (requiredAssociations.hasOwnProperty(association)) {
        let newAssociations: { [key: string]: string[] } = {};
        requiredAssociations[association].forEach(v => {
          // if v contains ".", which may be contained multiple times, remove the first occurrence of "." and everything before it
          if (v.indexOf('.') > -1) {
            let path = v.substring(v.indexOf('.') + 1);
            if (v.indexOf('.') > -1) {
              let associationName = v.substring(0, v.indexOf('.'));
              if (!newAssociations.hasOwnProperty(associationName)) {
                newAssociations[associationName] = [];
              }
              newAssociations[associationName].push(path);
            }
          }
        });
        if (Object.keys(associationSchema.associations).length > 0) {
          associationObject.include =
            associationSchema.constructAssociationInclusion(newAssociations);
        }
      }
      inclusionArray.push(associationObject);
    }
    return inclusionArray;
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
        include: this.constructAssociationInclusion({}),
      })
      .then(doc => (doc ? doc.toJSON() : doc));
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
        include: this.constructAssociationInclusion({}),
      })
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs));
  }

  private async findPopulations(document: Indexable, populate?: string[]) {
    if (isNil(populate) || isNil(this.relations)) return;
    for (const relationField of populate) {
      if (!this.relations.hasOwnProperty(relationField)) continue;
      const relationSchema = this.relations[relationField];
      incrementDbQueries();
      const schemaModel = this.adapter.getSchemaModel(relationSchema).model;
      document[relationField] = await schemaModel.findOne({
        _id: document[relationField],
      });
    }
  }

  private async findManyPopulations(documents: Indexable[], populate?: string[]) {
    if (isNil(populate) || isNil(this.relations)) return;
    for (const relation of populate) {
      const relationField = relation.split('.')[1];
      const cache: Indexable = {};
      for (const document of documents) {
        if (!this.relations.hasOwnProperty(relationField)) continue;
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

  async findOne(query: Query, select?: string, populate?: string[]) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(requiredAssociations ?? {}),
    };
    options.attributes = {
      exclude: [...this.excludedFields],
    } as unknown as FindAttributeOptions;
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    incrementDbQueries();
    const document = await this.model
      .findOne(options)
      .then(doc => (doc ? doc.toJSON() : doc));
    await this.findPopulations(document, populate);

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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(requiredAssociations ?? {}),
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
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs));

    await this.findManyPopulations(documents, populate);

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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    return this.model.destroy({ where: filter, limit: 1 });
  }

  deleteMany(query: Query) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    return this.model.destroy({ where: filter });
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
        .then(doc => (doc ? doc.toJSON() : doc))
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
        .then(doc => (doc ? doc.toJSON() : doc))
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
        .then(doc => (doc ? doc.toJSON() : doc))
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

    parsedFilter = parseQuery(
      parsedFilter as ParsedQuery | ParsedQuery[],
      this.associations,
    )[0];
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
        .then(doc => (doc ? doc.toJSON() : doc))
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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    return this.model.count({ where: filter });
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

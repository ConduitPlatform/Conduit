import {
  FindAttributeOptions,
  FindOptions,
  Model,
  ModelStatic,
  Order,
  OrderItem,
  Sequelize,
  Transaction,
} from 'sequelize';
import {
  ConduitDatabaseSchema,
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces';
import { extractRelations, getTransactionAndParsedQuery, sqlTypesProcess } from './utils';
import { SequelizeAdapter } from './index';
import ConduitGrpcSdk, { Indexable } from '@conduitplatform/grpc-sdk';
import { parseQuery } from './parser';
import { isNil } from 'lodash';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];
  synced: boolean;
  readonly idField;

  constructor(
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitDatabaseSchema,
    protected readonly adapter: SequelizeAdapter,
    protected readonly extractedRelations: {
      [key: string]: SequelizeSchema | SequelizeSchema[];
    },
  ) {
    this.excludedFields = [];
    this.idField = sqlTypesProcess(
      sequelize,
      originalSchema,
      schema,
      this.excludedFields,
    );
    incrementDbQueries();
    this.model = sequelize.define(schema.collectionName, schema.fields, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
    // if a relation is to self, then it will be undefined inside the extractedRelations
    // so we set it manually to self
    for (const relation in extractedRelations) {
      if (
        Array.isArray(extractedRelations[relation]) &&
        (extractedRelations[relation] as SequelizeSchema[])[0] === undefined
      ) {
        extractedRelations[relation] = [this];
      } else if (
        !Array.isArray(extractedRelations[relation]) &&
        extractedRelations[relation] === undefined
      ) {
        extractedRelations[relation] = this;
      }
    }
    extractRelations(
      this.originalSchema.name,
      originalSchema,
      this.model,
      extractedRelations,
    );
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    populate?: string[],
    transaction?: Transaction,
  ): Promise<Indexable> {
    const { t, parsedQuery, transactionProvided } = await getTransactionAndParsedQuery(
      transaction,
      query,
      this.sequelize,
    );
    for (const key in parsedQuery) {
      // check if the key is an object with fields, and not an object like Date
      if (
        typeof parsedQuery[key] === 'object' &&
        parsedQuery[key].hasOwnProperty('hasOwnProperty')
      ) {
        // unwrap the object and add the fields to the query
        const processing: any = {};
        for (const field in parsedQuery[key]) {
          processing[key + '.' + field] = parsedQuery[key][field];
        }
        delete parsedQuery[key];
        Object.assign(parsedQuery, processing);
      }
    }
    try {
      const parentDoc = await this.model.findByPk(id, {
        nest: true,
        transaction: t,
      });
      if (parsedQuery.hasOwnProperty('$inc')) {
        const inc = parsedQuery['$inc'];
        for (const key in inc) {
          if (!inc.hasOwnProperty(key)) continue;
          if (this.extractedRelations[key]) {
            throw new Error(`Cannot increment relation: ${key}`);
          }
          if (inc[key] > 0) {
            parsedQuery[key] = Sequelize.literal(`${key} + ${inc[key]}`);
          } else {
            parsedQuery[key] = Sequelize.literal(`${key} - ${Math.abs(inc[key])}`);
          }
        }
        delete parsedQuery['$inc'];
      }
      if (Object.keys(parsedQuery).length === 0) {
        return this.model
          .findByPk(id, {
            nest: true,
            include: this.constructRelationInclusion(populate),
          })
          .then(doc => (doc ? doc.toJSON() : doc));
      }

      if (parsedQuery.hasOwnProperty('$push')) {
        const push = parsedQuery['$push'];
        for (const key in push) {
          if (this.extractedRelations[key]) {
            if (!Array.isArray(this.extractedRelations[key])) {
              throw new Error(`Cannot push in non-array field: ${key}`);
            }
            let modelName = key.charAt(0).toUpperCase() + key.slice(1);
            if (push[key]['$each']) {
              if (!modelName.endsWith('s')) {
                modelName = modelName + 's';
              }
              parentDoc[`add${modelName}`](push[key]['$each'], parentDoc._id);
            } else {
              const actualRel = key.charAt(0).toUpperCase() + key.slice(1);
              parentDoc[`add${actualRel}Id`](push[key], parentDoc._id);
            }
            continue;
          }
          if (push[key]['$each']) {
            parentDoc[key] = [...parentDoc[key], ...push[key]['$each']];
          } else {
            parentDoc[key] = [...parentDoc[key], push[key]];
          }
        }
        await parentDoc.save();
        delete parsedQuery['$push'];
      }

      if (Object.keys(parsedQuery).length === 0) {
        return this.model
          .findByPk(id, {
            nest: true,
          })
          .then(doc => (doc ? doc.toJSON() : doc));
      }

      parsedQuery.updatedAt = new Date();
      incrementDbQueries();
      const relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      const data = await this.model
        .findByPk(id, {
          nest: true,
          transaction: t,
        })
        .then(doc => this.createWithPopulation(doc, relationObjects, t!))
        .then(() => {
          if (!transactionProvided) {
            return t!.commit();
          }
          return;
        })
        .then(() => {
          return this.model.findByPk(id, {
            nest: true,
            include: this.constructRelationInclusion(populate),
          });
        })
        .then(doc => (doc ? doc.toJSON() : doc));
      return data;
    } catch (e) {
      if (!transactionProvided) {
        await t!.rollback();
      }
      throw e;
    }
  }

  async create(query: SingleDocQuery, transaction?: Transaction) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    parsedQuery.createdAt = new Date();
    parsedQuery.updatedAt = new Date();
    incrementDbQueries();
    const relationObjects = this.extractRelationsModification(parsedQuery);
    let t: Transaction | undefined = transaction;
    const transactionProvided = transaction !== undefined;
    if (!transactionProvided) {
      t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    }
    for (const key in parsedQuery) {
      // check if the key is an object with fields, and not an object like Date
      if (
        typeof parsedQuery[key] === 'object' &&
        parsedQuery[key].hasOwnProperty('hasOwnProperty')
      ) {
        // unwrap the object and add the fields to the query
        const processing: any = {};
        for (const field in parsedQuery[key]) {
          processing[key + '.' + field] = parsedQuery[key][field];
        }
        delete parsedQuery[key];
        Object.assign(parsedQuery, processing);
      }
    }
    return this.model
      .create(parsedQuery, {
        transaction: t,
      })
      .then(doc => {
        return this.createWithPopulation(doc, relationObjects, t);
      })
      .then(doc => {
        if (!transactionProvided) {
          t!.commit();
        }
        return doc;
      })
      .then(doc => (doc ? doc.toJSON() : doc))
      .catch(err => {
        if (!transactionProvided) {
          t!.rollback();
        }
        throw err;
      });
  }

  async createMany(query: MultiDocQuery) {
    let parsedQuery: ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    for (let i = 0; i < parsedQuery.length; i++) {
      for (const key in parsedQuery[i]) {
        // check if the key is an object with fields, and not an object like Date
        if (
          typeof parsedQuery[i][key] === 'object' &&
          parsedQuery[i][key].hasOwnProperty('hasOwnProperty')
        ) {
          // unwrap the object and add the fields to the query
          const processing: any = {};
          for (const field in parsedQuery[i][key]) {
            processing[key + '.' + field] = parsedQuery[i][key][field];
          }
          delete parsedQuery[i][key];
          Object.assign(parsedQuery[i], processing);
        }
      }
    }
    return this.model
      .bulkCreate(parsedQuery, { transaction: t })
      .then(() => {
        t.commit();
      })
      .catch(err => {
        t.rollback();
        throw err;
      });
  }

  async findOne(query: Query, select?: string, populate?: string[]) {
    const { filter, parsingResult } = this.parseQueryFilter(query, { populate, select });
    const options: FindOptions = {
      where: filter,
      nest: true,
      attributes: parsingResult.attributes! as FindAttributeOptions,
      include: this.includeRelations(parsingResult.requiredRelations, populate || []),
    };

    incrementDbQueries();
    return this.model.findOne(options).then(doc => (doc ? doc.toJSON() : doc));
  }

  sync() {
    const syncOptions = { alter: { drop: false } };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
    for (const relation in this.extractedRelations) {
      if (!this.extractedRelations.hasOwnProperty(relation)) continue;
      const value = this.extractedRelations[relation];
      // many-to-many relations cannot be null
      if (!Array.isArray(value)) continue;
      const item = value[0];
      const name = this.model.name + '_' + item.originalSchema.name;
      promiseChain = promiseChain.then(() =>
        this.sequelize.models[name].sync({ alter: { drop: false } }),
      );
    }
    promiseChain = promiseChain.then(() => (this.synced = true));
    return promiseChain;
  }

  includeRelations(relationDirectory: string[], populate: string[]) {
    return this.constructRelationInclusion(relationDirectory, true).concat(
      this.constructRelationInclusion(
        populate?.filter(p => !relationDirectory.includes(p)) || [],
      ),
    );
  }

  constructRelationInclusion(populate?: string[], required?: boolean) {
    const inclusionArray: {
      model: ModelStatic<any>;
      as: string;
      required: boolean;
      include?: any;
      attributes?: { exclude: string[] };
    }[] = [];
    if (!populate) return inclusionArray;
    for (const population of populate) {
      if (population.indexOf('.') > -1) {
        let path = population.split('.');
        const relationName = path[0];
        const relationTarget = this.extractedRelations[relationName];
        if (!relationTarget) continue;
        const relationSchema: SequelizeSchema = Array.isArray(relationTarget)
          ? relationTarget[0]
          : relationTarget;
        const relationObject: {
          model: ModelStatic<any>;
          as: string;
          required: boolean;
          include?: any;
          attributes?: { exclude: string[] };
        } = {
          model: relationSchema.model,
          as: relationName,
          required: required || false,
          attributes: { exclude: relationSchema.excludedFields },
        };
        path.shift();
        path = [path.join('.')];
        relationObject.include = relationSchema.constructRelationInclusion(
          path,
          required,
        );
        inclusionArray.push(relationObject);
      } else {
        const relationTarget = this.extractedRelations[population];
        if (!relationTarget) continue;
        const relationSchema = Array.isArray(relationTarget)
          ? relationTarget[0]
          : relationTarget;
        const relationObject: {
          model: ModelStatic<any>;
          as: string;
          required: boolean;
          include?: any;
          attributes?: { exclude: string[] };
        } = {
          model: relationSchema.model,
          as: population,
          required: required || false,
          attributes: { exclude: relationSchema.excludedFields },
        };
        inclusionArray.push(relationObject);
      }
    }
    return inclusionArray;
  }

  createWithPopulation(
    doc: Model,
    relationObjects: Indexable,
    transaction?: Transaction,
  ) {
    let hasOne = false;
    for (const relation in this.extractedRelations) {
      if (!this.extractedRelations.hasOwnProperty(relation)) continue;
      if (!relationObjects.hasOwnProperty(relation)) continue;
      const relationTarget = this.extractedRelations[relation];
      hasOne = true;
      if (Array.isArray(relationTarget)) {
        let modelName = relation.charAt(0).toUpperCase() + relation.slice(1);
        if (!modelName.endsWith('s')) {
          modelName = modelName + 's';
        }
        // @ts-ignore
        doc[`set${modelName}`](relationObjects[relation], doc._id);
      } else {
        const actualRel = relation.charAt(0).toUpperCase() + relation.slice(1);
        // @ts-ignore
        doc[`set${actualRel}`](relationObjects[relation], doc._id);
      }
    }
    return hasOne ? doc.save({ transaction }) : doc;
  }

  extractManyRelationsModification(parsedQuery: ParsedQuery[]) {
    const relationObjects = [];
    for (const queries of parsedQuery) {
      relationObjects.push(this.extractRelationsModification(queries));
    }
    return relationObjects;
  }

  extractRelationsModification(parsedQuery: ParsedQuery) {
    const relationObjects = {};
    for (const target in parsedQuery) {
      if (!parsedQuery.hasOwnProperty(target)) continue;
      if (this.extractedRelations.hasOwnProperty(target)) {
        if (Array.isArray(parsedQuery[target])) {
          // @ts-ignore
          relationObjects[target] = parsedQuery[target];
          delete parsedQuery[target];
        } else {
          parsedQuery[target + 'Id'] = parsedQuery[target];
          delete parsedQuery[target];
        }
      }
    }
    return relationObjects;
  }

  async findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: { [field: string]: -1 | 1 },
    populate?: string[],
  ) {
    const { filter, parsingResult } = this.parseQueryFilter(query, { populate, select });
    const options: FindOptions = {
      where: filter,
      nest: true,
      attributes: parsingResult.attributes as FindAttributeOptions,
      include: this.includeRelations(parsingResult.requiredRelations, populate || []),
    };
    if (!isNil(skip)) {
      options.offset = skip;
    }
    if (!isNil(limit)) {
      options.limit = limit;
    }
    if (!isNil(sort)) {
      options.order = this.parseSort(sort);
    }

    return this.model
      .findAll(options)
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs));
  }

  deleteMany(query: Query) {
    const { filter, parsingResult } = this.parseQueryFilter(query);
    return this.model
      .findAll({
        where: filter,
        include: this.includeRelations(parsingResult.requiredRelations, []),
      })
      .then(docs => {
        return Promise.all(docs.map(doc => doc.destroy({ returning: true })));
      })
      .then(r => {
        return { deletedCount: r.length };
      });
  }

  deleteOne(query: Query) {
    const { filter, parsingResult } = this.parseQueryFilter(query);
    return this.model
      .findOne({
        where: filter,
        include: this.includeRelations(parsingResult.requiredRelations, []),
      })
      .then(doc => {
        return doc?.destroy({ returning: true });
      })
      .then(r => {
        return { deletedCount: r ? 1 : 0 };
      });
  }

  countDocuments(query: Query): Promise<number> {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    const parsingResult = parseQuery(
      this.originalSchema,
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
    );
    return this.model.count({
      where: parsingResult.query,
      include: this.includeRelations(parsingResult.requiredRelations, []),
    });
  }

  async updateMany(filterQuery: Query, query: SingleDocQuery, populate?: string[]) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let parsedFilter: ParsedQuery | undefined;
    if (typeof filterQuery === 'string') {
      parsedFilter = JSON.parse(filterQuery);
    } else {
      parsedFilter = filterQuery;
    }

    const parsingResult = parseQuery(
      this.originalSchema,
      parsedFilter!,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
    );
    parsedFilter = parsingResult.query;
    incrementDbQueries();
    const docs = await this.model.findAll({
      where: parsedFilter,
      attributes: ['_id'],
    });
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    try {
      const data = await Promise.all(
        docs.map(doc => this.findByIdAndUpdate(doc._id, parsedQuery, populate, t)),
      );
      await t.commit();
      return data;
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  async columnExistence(columns: string[]): Promise<boolean> {
    const dialect = this.adapter.sequelize.getDialect();
    let result: string[];
    if (dialect === 'sqlite') {
      result = await this.model
        .sequelize!.query(`PRAGMA table_info(${this.originalSchema.collectionName});`)
        .then(r => r[0].map((obj: any) => obj.name));
    } else {
      result = await this.model
        .sequelize!.query(
          `SELECT column_name FROM information_schema.columns
                WHERE table_name = '${this.originalSchema.collectionName}';`,
        )
        .then(r => r[0].map((obj: any) => obj.column_name));
    }
    return columns.every(column => result.includes(column));
  }

  parseQueryFilter(query: Query, options?: { populate?: string[]; select?: string }) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    const queryOptions = !isNil(options)
      ? { ...options, exclude: [...this.excludedFields] }
      : {};
    const parsingResult = parseQuery(
      this.originalSchema,
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      queryOptions,
    );

    let filter = parsingResult.query;
    return { filter, parsingResult };
  }

  protected parseSort(sort: { [field: string]: -1 | 1 }) {
    const order: Order = [];
    Object.keys(sort).forEach(field => {
      order.push([field, sort[field] === 1 ? 'ASC' : 'DESC'] as OrderItem);
    });
    return order;
  }
}

import {
  FindAttributeOptions,
  FindOptions,
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
import { parseQuery, parseCreateRelations } from './parser';
import { isNil } from 'lodash';
import { processCreateQuery, unwrap } from './utils/pathUtils';
import {
  constructRelationInclusion,
  createWithPopulation,
  extractRelationsModification,
  includeRelations,
  parseQueryFilter,
} from './utils/query';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SequelizeSchema extends SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];
  synced: boolean;
  readonly idField;
  readonly objectDotPaths: string[];
  readonly objectDotPathMapping: { [key: string]: string } = {};

  constructor(
    grpcSdk: ConduitGrpcSdk,
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitDatabaseSchema,
    readonly adapter: SequelizeAdapter,
    readonly extractedRelations: {
      [key: string]: SequelizeSchema | SequelizeSchema[];
    },
    readonly objectPaths: {
      [key: string]: { parentKey: string; childKey: string };
    },
    readonly isView: boolean = false,
  ) {
    super(grpcSdk, adapter, isView);
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
      hooks: this.schema.modelOptions
        ? {
            beforeCreate: doc => {
              const date = new Date();
              doc.createdAt = date;
              doc.updatedAt = date;
            },
            beforeBulkCreate: docs => {
              const date = new Date();
              docs.forEach(doc => {
                doc.createdAt = date;
                doc.updatedAt = date;
              });
            },
          }
        : undefined,
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
    this.objectDotPaths = [];
    for (const concatenatedKey of Object.keys(objectPaths)) {
      const { parentKey, childKey } = objectPaths[concatenatedKey];
      this.objectDotPaths.push(`${parentKey}.${childKey}`);
      this.objectDotPathMapping[concatenatedKey] = `${parentKey}.${childKey}`;
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
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
      transaction?: Transaction;
    },
  ): Promise<Indexable> {
    const { t, parsedQuery, transactionProvided } = await getTransactionAndParsedQuery(
      options?.transaction,
      query,
      this.sequelize,
    );
    const parsedId = await this.getAuthorizedQuery(
      'edit',
      { _id: id },
      false,
      options?.userId,
      options?.scope,
    ).then(r => {
      if (!r) {
        throw new Error("Document doesn't exist or can't be modified by user.");
      }
      return r._id;
    });
    try {
      const parentDoc = await this.model.findByPk(parsedId, {
        nest: true,
        transaction: t,
      });
      if (parsedQuery) {
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
            .findByPk(parsedId, {
              nest: true,
              include: constructRelationInclusion(this, options?.populate),
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
            .findByPk(parsedId, {
              nest: true,
            })
            .then(doc => (doc ? doc.toJSON() : doc));
        }
        // process the update query after special conditions have been handled.
        processCreateQuery(parsedQuery, this.objectPaths);
      }
      incrementDbQueries();
      const relationObjects = extractRelationsModification(this, parsedQuery);
      await this.model.update(
        { ...parsedQuery },
        { where: { _id: parsedId }, transaction: t },
      );
      incrementDbQueries();

      const data = await this.model
        .findByPk(parsedId, {
          nest: true,
          transaction: t,
        })
        .then(doc => createWithPopulation(this, doc, relationObjects, t!))
        .then(() => {
          if (!transactionProvided) {
            return t!.commit();
          }
          return;
        })
        .then(() => {
          return this.model.findByPk(parsedId, {
            nest: true,
            include: constructRelationInclusion(this, options?.populate),
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

  async create(
    query: SingleDocQuery,
    options?: {
      scope?: string;
      userId?: string;
      transaction?: Transaction;
    },
  ) {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    incrementDbQueries();
    if (parsedQuery) {
      processCreateQuery(parsedQuery, this.objectPaths);
    }
    const relationObjects = extractRelationsModification(this, parsedQuery);
    let t: Transaction | undefined = options?.transaction;
    const transactionProvided = t !== undefined;
    if (!transactionProvided) {
      t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    }
    const obj = await this.model
      .create(parsedQuery ?? {}, { transaction: t })
      .then(doc => createWithPopulation(this, doc, relationObjects, t))
      .then(doc => {
        if (!transactionProvided) {
          t!.commit();
        }
        return doc;
      })
      .then(doc =>
        doc ? parseCreateRelations(doc.toJSON(), this.extractedRelations) : doc,
      )
      .catch(err => {
        if (!transactionProvided) {
          t!.rollback();
        }
        throw err;
      });
    unwrap(obj, this.objectPaths);
    await this.addPermissionToData(obj, options);
    return obj;
  }

  async createMany(
    query: MultiDocQuery,
    options?: {
      scope?: string;
      userId?: string;
    },
  ) {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const parsedQuery: ParsedQuery[] = this.parseStringToQuery(query) as ParsedQuery[];
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    for (let i = 0; i < parsedQuery.length; i++) {
      if (parsedQuery[i]) {
        processCreateQuery(parsedQuery[i]!, this.objectPaths);
        extractRelationsModification(this, parsedQuery[i]);
      }
    }
    const docs = await this.model
      .bulkCreate(parsedQuery as Indexable[], { transaction: t })
      .then(docs => {
        t.commit();
        return docs;
      })
      .then(docs => {
        const parsedDocs: Indexable[] = [];
        for (const doc of docs) {
          const document = parseCreateRelations(doc.toJSON(), this.extractedRelations);
          unwrap(document, this.objectPaths);
          parsedDocs.push(document);
        }
        return parsedDocs;
      })
      .catch(err => {
        t.rollback();
        throw err;
      });
    await this.addPermissionToData(docs, options);
    return docs;
  }

  async findOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
      select?: string;
      populate?: string[];
    },
  ) {
    const filter = await this.getAuthorizedQuery(
      'read',
      query as Indexable,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(filter) && !isNil(query)) {
      return null;
    }
    const { filter: parsedFilter, parsingResult } = parseQueryFilter(
      this,
      this.parseStringToQuery(filter),
      {
        populate: options?.populate,
        select: options?.select,
      },
    );
    const findOptions: FindOptions = {
      where: parsedFilter!,
      nest: true,
      attributes: parsingResult.attributes! as FindAttributeOptions,
      include: includeRelations(
        this,
        parsingResult.requiredRelations,
        options?.populate || [],
      ),
    };

    incrementDbQueries();
    return this.model.findOne(findOptions).then(doc => {
      if (!doc) return doc;
      const document = doc.toJSON();
      unwrap(document, this.objectPaths, this.extractedRelations);
      return document;
    });
  }

  sync() {
    if (this.isView) return Promise.resolve();
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

  async findMany(
    query: Query,
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: { [field: string]: -1 | 1 };
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    const { query: filter, modified } = await this.getPaginatedAuthorizedQuery(
      'read',
      query as Indexable,
      options?.userId,
      options?.scope,
      options?.skip,
      options?.limit,
      options?.sort,
    );
    if (isNil(filter) && !isNil(query)) {
      return [];
    }
    const { filter: parsedFilter, parsingResult } = parseQueryFilter(
      this,
      this.parseStringToQuery(filter),
      {
        populate: options?.populate,
        select: options?.select,
      },
    );
    const findOptions: FindOptions = {
      where: parsedFilter,
      nest: true,
      attributes: parsingResult.attributes as FindAttributeOptions,
      include: includeRelations(
        this,
        parsingResult.requiredRelations,
        options?.populate || [],
      ),
    };
    if (!isNil(options?.skip) && !modified) {
      findOptions.offset = options!.skip;
    }
    if (!isNil(options?.limit) && !modified) {
      findOptions.limit = options!.limit;
    }
    if (!isNil(options?.sort)) {
      findOptions.order = this.parseSort(options!.sort);
    }

    return this.model.findAll(findOptions).then(docs => {
      if (!docs.length) return docs;
      return docs.map(doc => {
        const document = doc.toJSON();
        unwrap(document, this.objectPaths, this.extractedRelations);
        return document;
      });
    });
  }

  async deleteMany(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    const parsedQuery = this.parseStringToQuery(query);
    const { filter, parsingResult } = parseQueryFilter(this, parsedQuery);
    const parsedFilter = await this.getAuthorizedQuery(
      'delete',
      filter,
      true,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter) && !isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .findAll({
        where: parsedFilter ?? {},
        include: includeRelations(this, parsingResult.requiredRelations, []),
      })
      .then(docs => {
        return Promise.all(docs.map(doc => doc.destroy({ returning: true })));
      })
      .then(r => {
        return { deletedCount: r.length };
      });
  }

  async deleteOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    const parsedQuery = this.parseStringToQuery(query);
    const { filter, parsingResult } = parseQueryFilter(this, parsedQuery);
    const parsedFilter = await this.getAuthorizedQuery(
      'delete',
      filter,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter) && !isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .findOne({
        where: parsedFilter!,
        include: includeRelations(this, parsingResult.requiredRelations, []),
      })
      .then(doc => {
        return doc?.destroy({ returning: true });
      })
      .then(r => {
        return { deletedCount: r ? 1 : 0 };
      });
  }

  async countDocuments(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<number> {
    if (!isNil(options?.userId) || !isNil(options?.scope)) {
      const view = await this.permissionCheck('read', options?.userId, options?.scope);
      if (view) {
        return view.countDocuments(query, {
          userId: undefined,
          scope: undefined,
        });
      }
    }
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
      this.objectDotPaths,
      this.objectDotPathMapping,
    );
    return this.model.count({
      where: parsingResult.query,
      include: includeRelations(this, parsingResult.requiredRelations, []),
    });
  }

  async updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    const parsedFilterQuery: ParsedQuery = this.parseStringToQuery(query);
    const parsedFilter = await this.getAuthorizedQuery(
      'edit',
      this.parseStringToQuery(filterQuery),
      true,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter) && !isNil(parsedFilterQuery)) {
      return [];
    }
    const parsingResult = parseQuery(
      this.originalSchema,
      parsedFilter,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
      this.objectDotPaths,
      this.objectDotPathMapping,
    );
    incrementDbQueries();
    const docs = await this.model.findAll({
      where: parsingResult.query,
      attributes: ['_id'],
    });
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    try {
      const data = await Promise.all(
        docs.map(doc =>
          this.findByIdAndUpdate(doc._id, parsedFilter, {
            populate: options?.populate,
            transaction: t,
          }),
        ),
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

  protected parseSort(sort: { [field: string]: -1 | 1 }) {
    const order: Order = [];
    Object.keys(sort).forEach(field => {
      order.push([field, sort[field] === 1 ? 'ASC' : 'DESC'] as OrderItem);
    });
    return order;
  }

  findByIdAndReplace(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any> {
    const completeDoc: ParsedQuery = { ...this.parseStringToQuery(query) };
    // remove operators since it is not supported for replace ops
    for (const key of Object.keys(completeDoc)) {
      if (key.startsWith('$')) {
        delete completeDoc[key];
      }
    }
    for (const key of Object.keys(this.schema.fields)) {
      if (!completeDoc.hasOwnProperty(key)) {
        completeDoc[key] = null;
      }
    }
    delete completeDoc._id;
    delete completeDoc.createdAt;
    return this.findByIdAndUpdate(id, completeDoc, options);
  }

  parseStringToQuery(
    query: Query | SingleDocQuery | MultiDocQuery | null,
  ): ParsedQuery | ParsedQuery[] {
    return typeof query === 'string' ? JSON.parse(query) : query;
  }

  replaceOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any> {
    return this.findOne(filterQuery, options).then(doc => {
      if (!doc) {
        throw new Error('Document not found');
      }
      return this.findByIdAndReplace(doc._id, query, options);
    });
  }

  async updateOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
      transaction?: Transaction;
    },
  ): Promise<any> {
    return this.findOne(filterQuery, options).then(doc => {
      if (!doc) {
        throw new Error('Document not found');
      }
      return this.findByIdAndUpdate(doc._id, query, options);
    });
  }
}

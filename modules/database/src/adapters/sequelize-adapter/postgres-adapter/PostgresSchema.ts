import { isNil } from 'lodash';
import {
  FindAttributeOptions,
  FindOptions,
  ModelStatic,
  Sequelize,
  Transaction,
} from 'sequelize';
import { MultiDocQuery, ParsedQuery, Query, SingleDocQuery } from '../../../interfaces';
import { parseQuery } from './utils';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema';
import { PostgresAdapter } from './index';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class PostgresSchema extends SequelizeSchema {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];

  constructor(
    sequelize: Sequelize,
    schema: Indexable,
    originalSchema: ConduitSchema,
    adapter: PostgresAdapter,
    extractedRelations: {
      [key: string]:
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
    },
  ) {
    super(sequelize, schema, originalSchema, adapter as any, extractedRelations);
  }

  sync() {
    const syncOptions = { alter: true };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
    incrementDbQueries();
    return promiseChain;
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
    let relationObjects = this.extractRelationsModification(parsedQuery);
    let t: Transaction | undefined = transaction;
    let transactionProvided = transaction !== undefined;
    if (!transactionProvided) {
      t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    }

    return await this.model
      .create(parsedQuery, {
        transaction: t,
      })
      .then(doc => this.createWithPopulation(doc, relationObjects, t))
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
    incrementDbQueries();
    let relationObjects = this.extractManyRelationsModification(parsedQuery);
    let t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    return this.model
      .bulkCreate(parsedQuery, {
        transaction: t,
      })
      .then(docs => {
        return Promise.all(
          docs.map((doc, index) =>
            this.createWithPopulation(doc, relationObjects[index], t),
          ),
        );
      })
      .then(docs => {
        t.commit();
        return docs;
      })
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs))
      .catch(err => {
        t.rollback();
        throw err;
      });
  }

  async findOne(query: Query, select?: string, populate?: string[]) {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    let filter = parseQuery(parsedQuery, this.extractedRelations);

    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructRelationInclusion(populate),
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
    let filter = parseQuery(parsedQuery, this.extractedRelations);
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructRelationInclusion(populate),
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
    let filter = parseQuery(parsedQuery, this.extractedRelations);
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
    let filter = parseQuery(parsedQuery, this.extractedRelations);
    return this.model.destroy({ where: filter });
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    populate?: string[],
    transaction?: Transaction,
  ): Promise<{ [key: string]: any }> {
    let t: Transaction | undefined = transaction;
    let transactionProvided = transaction !== undefined;
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    if (isNil(t)) {
      t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    }
    try {
      let parentDoc = await this.model.findByPk(id, {
        nest: true,
        include: this.constructRelationInclusion(populate),
        transaction: t,
      });
      if (parsedQuery.hasOwnProperty('$inc')) {
        let inc = parsedQuery['$inc'];
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

      if (parsedQuery.hasOwnProperty('$push')) {
        let push = parsedQuery['$push'];
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
              let actualRel = key.charAt(0).toUpperCase() + key.slice(1);
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

      parsedQuery.updatedAt = new Date();
      incrementDbQueries();
      let relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      let data = await this.model
        .findByPk(id, {
          nest: true,
          include: this.constructRelationInclusion(populate),
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

  async updateMany(filterQuery: Query, query: SingleDocQuery, populate?: string[]) {
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
      this.extractedRelations,
    );
    incrementDbQueries();
    let docs = await this.model.findAll({
      where: parsedFilter,
      attributes: ['_id'],
    });
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    try {
      let data = await Promise.all(
        docs.map(doc => this.findByIdAndUpdate(doc._id, parsedQuery, populate, t)),
      );
      await t.commit();
      return data;
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  countDocuments(query: Query): Promise<number> {
    let parsedQuery: ParsedQuery | ParsedQuery[];
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    const filter = parseQuery(parsedQuery, this.extractedRelations);
    return this.model.count({ where: filter });
  }
}

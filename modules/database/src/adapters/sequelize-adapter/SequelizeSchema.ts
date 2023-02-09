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
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces';
import { extractRelations, sqlTypesProcess } from './utils';
import { SequelizeAdapter } from './index';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import {
  arrayPatch,
  extractAssociations,
  extractAssociationsFromObject,
  parseQuery,
} from './parser';
import { isNil } from 'lodash';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export abstract class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];
  readonly idField;

  protected constructor(
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitSchema,
    protected readonly adapter: SequelizeAdapter<SequelizeSchema>,
    protected readonly extractedRelations: {
      [key: string]: SequelizeSchema | SequelizeSchema[];
    },
    readonly associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
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
    extractRelations(this.originalSchema.name, this.model, extractedRelations);
    if (associations) {
      extractAssociations(this.model, associations);
    }
  }

  constructAssociationInclusion(
    requiredAssociations?: { [key: string]: string[] },
    requiredOnly = false,
  ) {
    if (isNil(requiredAssociations)) return [];
    const inclusionArray = [];
    for (const association in this.associations) {
      if (!this.associations.hasOwnProperty(association)) continue;
      const associationTarget = this.associations[association];
      const associationSchema = Array.isArray(associationTarget)
        ? (associationTarget as SequelizeSchema[])[0]
        : (associationTarget as SequelizeSchema);
      if (requiredOnly && !requiredAssociations.hasOwnProperty(association)) continue;
      const associationObject: {
        model: ModelStatic<any>;
        as: string;
        required: boolean;
        include?: any;
        attributes?: { exclude: string[] };
      } = {
        model: associationSchema.model,
        as: association,
        required: requiredAssociations.hasOwnProperty(association),
        attributes: { exclude: associationSchema.excludedFields },
      };
      if (requiredAssociations.hasOwnProperty(association)) {
        const newAssociations: { [key: string]: string[] } = {};
        requiredAssociations[association].forEach(v => {
          // if v contains ".", which may be contained multiple times, remove the first occurrence of "." and everything before it
          if (v.indexOf('.') > -1) {
            const path = v.substring(v.indexOf('.') + 1);
            if (v.indexOf('.') > -1) {
              const associationName = v.substring(0, v.indexOf('.'));
              if (!newAssociations.hasOwnProperty(associationName)) {
                newAssociations[associationName] = [];
              }
              newAssociations[associationName].push(path);
            }
          }
        });
        if (
          associationSchema.associations &&
          Object.keys(associationSchema.associations).length > 0
        ) {
          associationObject.include = associationSchema.constructAssociationInclusion(
            newAssociations,
            requiredOnly,
          );
        }
      }
      inclusionArray.push(associationObject);
    }
    return inclusionArray;
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
    let assocs;
    if (this.associations) {
      assocs = extractAssociationsFromObject(parsedQuery, this.associations);
    }
    const relationObjects = this.extractRelationsModification(parsedQuery);
    let t: Transaction | undefined = transaction;
    const transactionProvided = transaction !== undefined;
    if (!transactionProvided) {
      t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    }
    return await this.model
      .create(parsedQuery, {
        include: this.constructAssociationInclusion(assocs, true),
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
    let assocs;
    if (this.associations) {
      assocs = extractAssociationsFromObject(parsedQuery, this.associations);
    }
    const relationObjects = this.extractManyRelationsModification(parsedQuery);
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    return this.model
      .bulkCreate(parsedQuery, {
        include: this.constructAssociationInclusion(assocs, true),
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
    const parsingResult = parseQuery(
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      { populate, select, exclude: [...this.excludedFields] },
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    const options: FindOptions = {
      where: filter,
      nest: true,
      attributes: parsingResult.attributes! as FindAttributeOptions,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, populate || [])),
    };

    incrementDbQueries();
    const document = await this.model
      .findOne(options)
      .then(doc => (doc ? doc.toJSON() : doc));

    return document;
  }

  sync() {
    const syncOptions = { alter: { drop: false } };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
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
        const path = population.split('.');
        const relationName = path[0];
        const relationTarget = this.extractedRelations[relationName];
        if (relationTarget) continue;
        const relationSchema: SequelizeSchema = Array.isArray(relationTarget)
          ? (relationTarget as any[])[0]
          : (relationTarget as any);
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
        relationObject.include = relationSchema.constructRelationInclusion(
          path,
          required,
        );
        inclusionArray.push(relationObject);
      } else {
        const relationTarget = this.extractedRelations[population];
        if (!relationTarget) continue;
        const relationSchema = Array.isArray(relationTarget)
          ? (relationTarget as any[])[0]
          : (relationTarget as any);
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

  createWithPopulation(doc: Model<any>, relationObjects: any, transaction?: Transaction) {
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
    const relationObjects = [{}];
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
        // @ts-ignore
        relationObjects[target] = parsedQuery[target];
        delete parsedQuery[target];
      }
    }
    return relationObjects;
  }

  protected parseSort(sort: { [field: string]: -1 | 1 }) {
    const order: Order = [];
    Object.keys(sort).forEach(field => {
      order.push([field, sort[field] === 1 ? 'ASC' : 'DESC'] as OrderItem);
    });
    return order;
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
    const parsingResult = parseQuery(
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      { populate, select, exclude: [...this.excludedFields] },
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    const options: FindOptions = {
      where: filter,
      nest: true,
      attributes: parsingResult.attributes as FindAttributeOptions,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, populate || [])),
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

    const documents = await this.model
      .findAll(options)
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs));

    return documents;
  }

  deleteMany(query: Query) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    const parsingResult = parseQuery(
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    return this.model
      .findAll({
        where: filter,
        include: this.constructAssociationInclusion(
          parsingResult.requiredAssociations,
        ).concat(...this.includeRelations(parsingResult.requiredRelations, [])),
      })
      .then(docs => {
        if (docs) {
          return Promise.all(docs.map(doc => doc.destroy()));
        }
      });
  }

  deleteOne(query: Query) {
    let parsedQuery: ParsedQuery;
    if (typeof query === 'string') {
      parsedQuery = JSON.parse(query);
    } else {
      parsedQuery = query;
    }
    incrementDbQueries();
    const parsingResult = parseQuery(
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    return this.model
      .findOne({
        where: filter,
        include: this.constructAssociationInclusion(
          parsingResult.requiredAssociations,
        ).concat(...this.includeRelations(parsingResult.requiredRelations, [])),
      })
      .then(doc => {
        doc?.destroy();
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
      parsedQuery,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
      this.associations,
    );
    return this.model.count({
      where: parsingResult.query,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, [])),
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
      parsedFilter!,
      this.adapter.sequelize.getDialect(),
      this.extractedRelations,
      {},
      this.associations,
    );
    parsedFilter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      parsedFilter = arrayPatch(
        parsedFilter,
        this.originalSchema.fields,
        this.associations,
      );
    }

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

  abstract findByIdAndUpdate(
    id: any,
    document: SingleDocQuery,
    populate?: string[],
    transaction?: Transaction,
  ): Promise<any>;
}

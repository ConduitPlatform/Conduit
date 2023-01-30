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

  protected constructor(
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitSchema,
    protected readonly adapter: SequelizeAdapter<SequelizeSchema>,
    protected readonly extractedRelations: {
      [key: string]:
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
    },
    readonly associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    this.excludedFields = [];
    sqlTypesProcess(sequelize, originalSchema, schema, this.excludedFields);
    incrementDbQueries();
    this.model = sequelize.define(schema.collectionName, schema.fields, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
    extractRelations(this.originalSchema.name, this.model, extractedRelations, adapter);
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
      this.extractedRelations,
      populate,
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, populate || [])),
    };
    options.attributes = {
      exclude: [...this.excludedFields],
    } as unknown as FindAttributeOptions;
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    } else {
      options.attributes = this.renameRelations(populate || []);
    }
    incrementDbQueries();
    const document = await this.model
      .findOne(options)
      .then(doc => (doc ? doc.toJSON() : doc));

    return document;
  }

  sync() {
    const syncOptions = { alter: true };
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
        const associationName = path[0];
        const associationTarget = this.extractedRelations[associationName];
        if (associationTarget) continue;
        let associationSchema = (
          Array.isArray(associationTarget)
            ? (associationTarget as any[])[0]
            : (associationTarget as any)
        ).model;
        associationSchema = this.adapter.models[associationSchema];
        const associationObject: {
          model: ModelStatic<any>;
          as: string;
          required: boolean;
          include?: any;
          attributes?: { exclude: string[] };
        } = {
          model: associationSchema.model,
          as: associationName,
          required: required || false,
          attributes: { exclude: associationSchema.excludedFields },
        };
        path.shift();
        associationObject.include = associationSchema.constructRelationInclusion(
          path,
          required,
        );
        inclusionArray.push(associationObject);
      } else {
        const associationTarget = this.extractedRelations[population];
        if (!associationTarget) continue;
        let associationSchema = (
          Array.isArray(associationTarget)
            ? (associationTarget as any[])[0]
            : (associationTarget as any)
        ).model;
        associationSchema = this.adapter.models[associationSchema];
        const associationObject: {
          model: ModelStatic<any>;
          as: string;
          required: boolean;
          include?: any;
          attributes?: { exclude: string[] };
        } = {
          model: associationSchema.model,
          as: population,
          required: required || false,
          attributes: { exclude: associationSchema.excludedFields },
        };
        inclusionArray.push(associationObject);
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

  protected parseSelect(select: string): { exclude: string[]; include?: string[] } {
    const include: string[] = [];
    const exclude = [...this.excludedFields];
    const attributes = select.split(' ');
    let includedRelations = [];

    for (const attribute of attributes) {
      if (attribute[0] === '+' || attribute[0] !== '-') {
        let tmp = attribute;
        if (attribute[0] === '+') {
          tmp = attribute.slice(1);
        }
        const ind = exclude.indexOf(tmp);
        if (ind > -1) {
          exclude.splice(ind, 1);
        }
        if (this.extractedRelations[tmp]) {
          includedRelations.push(tmp);
          if (!Array.isArray(this.extractedRelations[tmp])) {
            // @ts-ignore
            include.push([tmp + 'Id', tmp]);
          } else {
            include.push(tmp);
          }
        } else {
          include.push(tmp);
        }
      } else {
        if (this.extractedRelations[attribute.slice(1)]) {
          includedRelations.push(attribute.slice(1));
          if (!Array.isArray(this.extractedRelations[attribute.slice(1)])) {
            // @ts-ignore
            exclude.push(attribute.slice(1) + 'Id');
          } else {
            exclude.push(attribute.slice(1));
          }
        } else {
          exclude.push(attribute.slice(1));
        }
      }
    }
    for (const relation in this.extractedRelations) {
      if (includedRelations.indexOf(relation) > -1) continue;

      if (!Array.isArray(this.extractedRelations[relation])) {
        // @ts-ignore
        include.push([relation + 'Id', relation]);
      }
    }

    return {
      exclude,
      ...(include.length > 0 && {
        include: include,
      }),
    };
  }

  protected renameRelations(population: string[]): { include: string[] } {
    const include: string[] = [];

    for (const relation in this.extractedRelations) {
      if (population.indexOf(relation) !== -1) continue;
      if (!Array.isArray(this.extractedRelations[relation])) {
        // @ts-ignore
        include.push([relation + 'Id', relation]);
      }
    }

    return {
      include,
    };
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
      this.extractedRelations,
      populate,
      this.associations,
    );
    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, populate || [])),
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
    } else {
      options.attributes = this.renameRelations(populate || []);
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
      this.extractedRelations,
      undefined,
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
      this.extractedRelations,
      undefined,
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
      this.extractedRelations,
      [],
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
      this.extractedRelations,
      undefined,
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

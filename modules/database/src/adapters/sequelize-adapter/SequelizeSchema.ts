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
import {
  arrayPatch,
  extractAssociations,
  extractAssociationsFromObject,
  parseQuery,
} from './parser';
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
    extractRelations(
      this.originalSchema.name,
      originalSchema,
      this.model,
      extractedRelations,
    );
    if (associations) {
      extractAssociations(this.model, associations);
    }
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
    try {
      const parentDoc = await this.model.findByPk(id, {
        nest: true,
        include: this.constructAssociationInclusion({}).concat(
          this.constructRelationInclusion(populate),
        ),
        transaction: t,
      });
      if (parsedQuery.hasOwnProperty('$inc')) {
        const inc = parsedQuery['$inc'];
        for (const key in inc) {
          if (!inc.hasOwnProperty(key)) continue;
          if (key.indexOf('.') > -1) {
            const [assoc, field] = [
              key.substring(0, key.indexOf('.')),
              key.substring(key.indexOf('.') + 1),
            ];
            if (!this.associations || !this.associations[assoc]) {
              throw new Error(`Cannot increment field ${key}`);
            }
            if (this.associations[assoc] && Array.isArray(this.associations[assoc])) {
              throw new Error(`Cannot increment array field: ${key}`);
            }
            await (this.associations[assoc] as SequelizeSchema).findByIdAndUpdate(
              parentDoc[assoc]._id,
              {
                $inc: { [field]: inc[key] },
              },
              undefined,
              t,
            );
            continue;
          }
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
        const push = parsedQuery['$push'];
        for (const key in push) {
          if (key.indexOf('.') > -1) {
            const [assoc, field] = [
              key.substring(0, key.indexOf('.') - 1),
              key.substring(key.indexOf('.') + 1),
            ];
            if (!this.associations || !this.associations[assoc]) {
              throw new Error(`Cannot push field ${key}`);
            }
            if (this.associations[assoc] && Array.isArray(this.associations[assoc])) {
              throw new Error(`Cannot push array field: ${key}`);
            }
            await (this.associations[assoc] as SequelizeSchema).findByIdAndUpdate(
              parentDoc[assoc]._id,
              {
                $push: { [field]: push[key] },
              },
              undefined,
              t,
            );
            continue;
          }
          if (this.associations && this.associations[key]) {
            if (!Array.isArray(this.associations[key])) {
              throw new Error(`Cannot push in non-array field: ${key}`);
            }
            if (push[key]['$each']) {
              let actualKey = key;
              if (key.charAt(key.length - 1) !== 's') {
                actualKey = key + 's';
              }
              parentDoc[`add${actualKey}`](push[key]['$each'], parentDoc._id);
            } else {
              parentDoc[`add${key}`](push[key], parentDoc._id);
            }
            continue;
          }

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

      parsedQuery.updatedAt = new Date();
      incrementDbQueries();
      const associationObjects: Indexable = {};
      for (const assoc in extractAssociationsFromObject(parsedQuery, this.associations)) {
        if (
          Array.isArray(this.associations![assoc]) &&
          !Array.isArray(parsedQuery[assoc])
        ) {
          throw new Error(`Cannot update association ${assoc} with non-array value`);
        }
        if (
          !Array.isArray(this.associations![assoc]) &&
          Array.isArray(parsedQuery[assoc])
        ) {
          throw new Error(`Cannot update association ${assoc} with array value`);
        }
        associationObjects[assoc] = parsedQuery[assoc];
        delete parsedQuery[assoc];
      }
      const relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      const data = await this.model
        .findByPk(id, {
          nest: true,
          include: this.constructAssociationInclusion({}).concat(
            this.constructRelationInclusion(populate),
          ),
          transaction: t,
        })
        .then(doc => {
          if (!doc) return doc;
          const promises = [];
          for (const assoc in associationObjects) {
            if (!associationObjects.hasOwnProperty(assoc)) continue;
            if (Array.isArray(associationObjects[assoc])) {
              for (const obj of associationObjects[assoc]) {
                if (obj.hasOwnProperty('_id')) {
                  promises.push(
                    (this.associations![assoc] as SequelizeSchema[])[0].findByIdAndUpdate(
                      doc[assoc]._id,
                      obj,
                      undefined,
                      t,
                    ),
                  );
                } else {
                  promises.push(
                    (this.associations![assoc] as SequelizeSchema[])[0]
                      .create(obj, t)
                      .then(r => {
                        doc[`add${assoc.charAt(0).toUpperCase() + assoc.slice(1)}`](
                          r._id,
                        );
                      }),
                  );
                }
              }
            } else {
              if (doc[assoc]) {
                promises.push(
                  (this.associations![assoc] as SequelizeSchema).findByIdAndUpdate(
                    doc[assoc]._id,
                    associationObjects[assoc],
                    undefined,
                    t,
                  ),
                );
              } else {
                promises.push(
                  (this.associations![assoc] as SequelizeSchema)
                    .create(associationObjects[assoc], t)
                    .then(r => {
                      doc[`set${assoc.charAt(0).toUpperCase() + assoc.slice(1)}`](r._id);
                    }),
                );
              }
            }
          }
          return Promise.all(promises).then(() => doc);
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
            include: this.constructAssociationInclusion({}).concat(
              this.constructRelationInclusion(populate),
            ),
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
    return this.model
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
    const relationObjectsArray = this.extractManyRelationsModification(parsedQuery);
    const t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    return this.model
      .bulkCreate(parsedQuery, {
        include: this.constructAssociationInclusion(assocs, true),
        transaction: t,
      })
      .then(docs => {
        return Promise.all(
          docs.map((doc, index) =>
            this.createWithPopulation(doc, relationObjectsArray[index], t),
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
    const { filter, parsingResult } = this.parseQueryFilter(query, { populate, select });
    const options: FindOptions = {
      where: filter,
      nest: true,
      attributes: parsingResult.attributes! as FindAttributeOptions,
      include: this.constructAssociationInclusion(
        parsingResult.requiredAssociations,
      ).concat(...this.includeRelations(parsingResult.requiredRelations, populate || [])),
    };

    incrementDbQueries();
    return this.model.findOne(options).then(doc => (doc ? doc.toJSON() : doc));
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

    return this.model
      .findAll(options)
      .then(docs => (docs ? docs.map(doc => (doc ? doc.toJSON() : doc)) : docs));
  }

  deleteMany(query: Query) {
    const { filter, parsingResult } = this.parseQueryFilter(query);
    return this.model
      .findAll({
        where: filter,
        include: this.constructAssociationInclusion(
          parsingResult.requiredAssociations,
        ).concat(...this.includeRelations(parsingResult.requiredRelations, [])),
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
        include: this.constructAssociationInclusion(
          parsingResult.requiredAssociations,
        ).concat(...this.includeRelations(parsingResult.requiredRelations, [])),
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
      this.originalSchema,
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
      this.associations,
    );

    let filter = parsingResult.query;
    if (this.sequelize.getDialect() !== 'postgres') {
      filter = arrayPatch(filter, this.originalSchema.fields, this.associations);
    }

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

import { isNil } from 'lodash';
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
import {
  extractAssociations,
  extractAssociationsFromObject,
  extractRelations,
  parseQuery,
  sqlTypesProcess,
} from './utils';
import { SequelizeAdapter } from './index';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];

  constructor(
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitSchema,
    private readonly adapter: SequelizeAdapter,
    readonly associations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
    private readonly extractedRelations: {
      [key: string]:
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
        | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
    },
  ) {
    this.excludedFields = [];

    sqlTypesProcess(sequelize, originalSchema, schema, this.excludedFields);

    incrementDbQueries();
    this.model = sequelize.define(schema.collectionName, schema.fields, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
    extractAssociations(this.model, associations);
    extractRelations(this.originalSchema.name, this.model, extractedRelations, adapter);
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

  constructRelationInclusion(populate?: string[]) {
    let inclusionArray: {
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
        let associationName = path[0];
        let associationTarget = this.extractedRelations[associationName];
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
          as: Array.isArray(associationTarget) ? associationName : associationName + 'Id',
          required: false,
          attributes: { exclude: associationSchema.excludedFields },
        };
        path.shift();
        associationObject.include = associationSchema.constructRelationInclusion(path);
        inclusionArray.push(associationObject);
      } else {
        let associationTarget = this.extractedRelations[population];
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
          as: Array.isArray(associationTarget) ? population : population + 'Id',
          required: false,
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
        let actualRel = relation.charAt(0).toUpperCase() + relation.slice(1);
        // @ts-ignore
        doc[`set${actualRel}Id`](relationObjects[relation], doc._id);
      }
    }
    return hasOne ? doc.save({ transaction }) : doc;
  }

  extractManyRelationsModification(parsedQuery: ParsedQuery[]) {
    let relationObjects = [{}];
    for (const queries of parsedQuery) {
      relationObjects.push(this.extractRelationsModification(queries));
    }
    return relationObjects;
  }

  extractRelationsModification(parsedQuery: ParsedQuery) {
    let relationObjects = {};
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
    let assocs = extractAssociationsFromObject(parsedQuery, this.associations);
    let relationObjects = this.extractRelationsModification(parsedQuery);
    let t: Transaction | undefined = transaction;
    let transactionProvided = transaction !== undefined;
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
    let assocs = extractAssociationsFromObject(parsedQuery, this.associations);
    let relationObjects = this.extractManyRelationsModification(parsedQuery);
    let t = await this.sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(requiredAssociations).concat(
        this.constructRelationInclusion(populate),
      ),
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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    const options: FindOptions = {
      where: filter,
      nest: true,
      include: this.constructAssociationInclusion(requiredAssociations).concat(
        this.constructRelationInclusion(populate),
      ),
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
        include: this.constructAssociationInclusion({}).concat(
          this.constructRelationInclusion(populate),
        ),
        transaction: t,
      });
      if (parsedQuery.hasOwnProperty('$inc')) {
        let inc = parsedQuery['$inc'];
        for (const key in inc) {
          if (!inc.hasOwnProperty(key)) continue;
          if (key.indexOf('.') > -1) {
            let [assoc, field] = [
              key.substring(0, key.indexOf('.')),
              key.substring(key.indexOf('.') + 1),
            ];
            if (!this.associations[assoc]) {
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
        let push = parsedQuery['$push'];
        for (const key in push) {
          if (key.indexOf('.') > -1) {
            let [assoc, field] = [
              key.substring(0, key.indexOf('.') - 1),
              key.substring(key.indexOf('.') + 1),
            ];
            if (!this.associations[assoc]) {
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
          if (this.extractedRelations[key]) {
            throw new Error(`Cannot increment relation: ${key}`);
          }
          if (this.associations[key]) {
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
      let assocs = extractAssociationsFromObject(parsedQuery, this.associations);
      let associationObjects: { [key: string]: any } = {};
      for (const assoc in assocs) {
        if (Array.isArray(assocs[assoc]) && !Array.isArray(parsedQuery[assoc])) {
          throw new Error(`Cannot update association ${assoc} with non-array value`);
        }
        if (!Array.isArray(assocs[assoc]) && Array.isArray(parsedQuery[assoc])) {
          throw new Error(`Cannot update association ${assoc} with array value`);
        }
        associationObjects[assoc] = parsedQuery[assoc];
        delete parsedQuery[assoc];
      }
      let relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      let data = await this.model
        .findByPk(id, {
          nest: true,
          include: this.constructAssociationInclusion(assocs).concat(
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
              associationObjects[assoc].forEach((obj: any) => {
                if (obj.hasOwnProperty('_id')) {
                  promises.push(
                    (this.associations[assoc] as SequelizeSchema).findByIdAndUpdate(
                      obj._id,
                      obj,
                      undefined,
                      t,
                    ),
                  );
                } else {
                  promises.push(async () => {
                    let returned = await (
                      this.associations[assoc] as SequelizeSchema
                    ).create(obj, t);
                    doc[`add${assoc.charAt(0).toUpperCase() + assoc.slice(1)}`](returned);
                  });
                }
              });
            } else {
              if (assoc.hasOwnProperty('_id')) {
                promises.push(
                  (this.associations[assoc] as SequelizeSchema).findByIdAndUpdate(
                    associationObjects[assoc]._id,
                    associationObjects[assoc],
                    undefined,
                    t,
                  ),
                );
              } else {
                promises.push(async () => {
                  let returned = (this.associations[assoc] as SequelizeSchema).create(
                    associationObjects[assoc],
                    t,
                  );
                  doc[`set${assoc.charAt(0).toUpperCase() + assoc.slice(1)}`](returned);
                });
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
            include: this.constructAssociationInclusion(assocs).concat(
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
      this.associations,
    )[0];

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
    const [filter, requiredAssociations] = parseQuery(parsedQuery, this.associations);
    return this.model.count({ where: filter });
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

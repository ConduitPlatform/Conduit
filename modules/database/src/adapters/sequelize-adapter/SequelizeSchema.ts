import { Model, ModelStatic, Order, OrderItem, Sequelize, Transaction } from 'sequelize';
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

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export abstract class SequelizeSchema implements SchemaAdapter<ModelStatic<any>> {
  model: ModelStatic<any>;
  fieldHash: string;
  excludedFields: string[];

  constructor(
    readonly sequelize: Sequelize,
    readonly schema: Indexable,
    readonly originalSchema: ConduitSchema,
    protected readonly adapter: SequelizeAdapter<SequelizeSchema>,
    protected readonly extractedRelations: {
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
    extractRelations(this.originalSchema.name, this.model, extractedRelations, adapter);
  }

  sync() {
    const syncOptions = { alter: true };
    let promiseChain: Promise<any> = this.model.sync(syncOptions);
    return promiseChain;
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

  protected parseSelect(select: string): string[] | { exclude: string[] } {
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

  protected parseSort(sort: { [field: string]: -1 | 1 }) {
    const order: Order = [];
    Object.keys(sort).forEach(field => {
      order.push([field, sort[field] === 1 ? 'ASC' : 'DESC'] as OrderItem);
    });
    return order;
  }

  abstract countDocuments(query: Query): Promise<number>;

  abstract create(query: SingleDocQuery): Promise<any>;

  abstract createMany(query: MultiDocQuery): Promise<any>;

  abstract deleteMany(query: Query): Promise<any>;

  abstract deleteOne(query: Query): Promise<any>;

  abstract findByIdAndUpdate(
    id: any,
    document: SingleDocQuery,
    populate?: string[],
  ): Promise<any>;

  abstract findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
  ): Promise<any>;

  abstract findOne(query: Query, select?: string, populate?: string[]): Promise<any>;

  abstract updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    populate?: string[],
  ): Promise<any>;
}

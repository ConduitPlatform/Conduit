import { isNil } from 'lodash';
import { ModelStatic, Sequelize, Transaction } from 'sequelize';
import { ParsedQuery, SingleDocQuery } from '../../../interfaces';
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
    extractedRelations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    super(sequelize, schema, originalSchema, adapter as any, extractedRelations);
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    populate?: string[],
    transaction?: Transaction,
  ): Promise<{ [key: string]: any }> {
    let t: Transaction | undefined = transaction;
    const transactionProvided = transaction !== undefined;
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
      const parentDoc = await this.model.findByPk(id, {
        nest: true,
        include: this.constructRelationInclusion(populate),
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

      parsedQuery.updatedAt = new Date();
      incrementDbQueries();
      const relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      const data = await this.model
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
}

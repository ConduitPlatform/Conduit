import { ModelStatic, Sequelize, Transaction } from 'sequelize';
import { SingleDocQuery } from '../../../interfaces';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema';
import { PostgresAdapter } from './index';
import { getTransactionAndParsedQuery, processPushOperations } from '../utils';

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
    const { t, parsedQuery, transactionProvided } = await getTransactionAndParsedQuery(
      transaction,
      query,
      this.sequelize,
    );
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
        processPushOperations(parentDoc, push, this.extractedRelations);
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

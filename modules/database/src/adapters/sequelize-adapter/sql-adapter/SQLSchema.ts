import { isNil } from 'lodash';
import { Sequelize, Transaction } from 'sequelize';
import { ParsedQuery, SingleDocQuery } from '../../../interfaces';
import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { SQLAdapter } from './index';
import { SequelizeSchema } from '../SequelizeSchema';
import { extractAssociationsFromObject } from '../parser';

const incrementDbQueries = () =>
  ConduitGrpcSdk.Metrics?.increment('database_queries_total');

export class SQLSchema extends SequelizeSchema {
  constructor(
    sequelize: Sequelize,
    schema: Indexable,
    originalSchema: ConduitSchema,
    adapter: SQLAdapter,
    extractedRelations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
    readonly associations: { [key: string]: SQLSchema | SQLSchema[] },
  ) {
    super(sequelize, schema, originalSchema, adapter, extractedRelations, associations);
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
            if (!this.associations[assoc]) {
              throw new Error(`Cannot increment field ${key}`);
            }
            if (this.associations[assoc] && Array.isArray(this.associations[assoc])) {
              throw new Error(`Cannot increment array field: ${key}`);
            }
            await (this.associations[assoc] as SQLSchema).findByIdAndUpdate(
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
            if (!this.associations[assoc]) {
              throw new Error(`Cannot push field ${key}`);
            }
            if (this.associations[assoc] && Array.isArray(this.associations[assoc])) {
              throw new Error(`Cannot push array field: ${key}`);
            }
            await (this.associations[assoc] as SQLSchema).findByIdAndUpdate(
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
      const assocs = extractAssociationsFromObject(parsedQuery, this.associations);
      const associationObjects: { [key: string]: any } = {};
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
      const relationObjects = this.extractRelationsModification(parsedQuery);
      await this.model.update({ ...parsedQuery }, { where: { _id: id }, transaction: t });
      incrementDbQueries();

      const data = await this.model
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
                    (this.associations[assoc] as SQLSchema).findByIdAndUpdate(
                      obj._id,
                      obj,
                      undefined,
                      t,
                    ),
                  );
                } else {
                  promises.push(async () => {
                    const returned = await (this.associations[assoc] as SQLSchema).create(
                      obj,
                      t,
                    );
                    doc[`add${assoc.charAt(0).toUpperCase() + assoc.slice(1)}`](returned);
                  });
                }
              });
            } else {
              if (assoc.hasOwnProperty('_id')) {
                promises.push(
                  (this.associations[assoc] as SQLSchema).findByIdAndUpdate(
                    associationObjects[assoc]._id,
                    associationObjects[assoc],
                    undefined,
                    t,
                  ),
                );
              } else {
                promises.push(async () => {
                  const returned = (this.associations[assoc] as SQLSchema).create(
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
}

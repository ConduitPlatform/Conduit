import { DataTypes, ModelStatic, Sequelize, Transaction } from 'sequelize';
import { ConduitGrpcSdk, Indexable, UntypedArray } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { ConduitDatabaseSchema, ParsedQuery } from '../../../interfaces/index.js';
import { isNil } from 'lodash-es';
import { validateFieldChanges, validateFieldConstraints } from '../../utils/index.js';

import * as deepdash from 'deepdash-es/standalone';

export const extractRelations = (
  name: string,
  originalSchema: ConduitDatabaseSchema,
  model: ModelStatic<any>,
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
) => {
  for (const relation in relations) {
    if (relations.hasOwnProperty(relation)) {
      const value = relations[relation];
      // many-to-many relations cannot be null
      if (Array.isArray(value)) {
        const item = value[0];
        if (
          item.model.associations[model.name + '_' + relation] &&
          item.model.associations[model.name + '_' + relation].foreignKey ===
            item.originalSchema.name
        ) {
          model.belongsToMany(item.model, {
            foreignKey: name,
            as: relation,
            through: model.name + '_' + item.originalSchema.name,
          });
        } else if (
          item.model.associations[model.name + '_' + relation] &&
          item.model.associations[model.name + '_' + relation].foreignKey !==
            item.originalSchema.name
        ) {
          throw new Error(
            `Relation ${relation} already exists on ${item.model.name} with a different foreign key`,
          );
        } else {
          model.belongsToMany(item.model, {
            foreignKey: name,
            as: relation,
            through: model.name + '_' + item.originalSchema.name,
          });
          item.model.belongsToMany(model, {
            foreignKey: item.originalSchema.name,
            as: model.name + '_' + relation,
            through: model.name + '_' + item.originalSchema.name,
          });
          item.sync();
        }
      } else {
        const relationsField = findOriginalSchemaField(originalSchema, relation);
        model.belongsTo(value.model, {
          foreignKey: {
            name: relation + 'Id',
            allowNull: !(relationsField as any).required,
            defaultValue: (relationsField as any).default,
          },
          as: relation,
          constraints: false,
        });
      }
    }
  }
};

const findOriginalSchemaField = (
  originalSchema: ConduitDatabaseSchema,
  field: string,
) => {
  if (field.indexOf('_') === -1) {
    return originalSchema.compiledFields[field];
  } else {
    const fieldParts = field.split('_');
    let currentField: any = originalSchema.compiledFields[fieldParts[0]];
    for (let i = 1; i < fieldParts.length; i++) {
      if (currentField.type) {
        currentField = currentField.type[fieldParts[i]];
      } else {
        currentField = currentField[fieldParts[i]];
      }
    }
    return currentField;
  }
};

export const sqlTypesProcess = (
  sequelize: Sequelize,
  originalSchema: Indexable,
  schema: Indexable,
  excludedFields: string[],
) => {
  let primaryKeyExists = false;
  let idField: string | null = null;

  deepdash.eachDeep(
    originalSchema.fields,
    //@ts-ignore
    (value: Indexable, key: string, parentValue: Indexable) => {
      if (
        isNil(parentValue) ||
        !parentValue.hasOwnProperty(key) ||
        isNil(parentValue[key])
      ) {
        return true;
      }

      if (parentValue[key].hasOwnProperty('select')) {
        if (!parentValue[key].select) {
          excludedFields.push(key);
        }
      }

      if (parentValue[key].hasOwnProperty('primaryKey') && parentValue[key].primaryKey) {
        primaryKeyExists = true;
        idField = key;
      }
    },
  );
  if (!primaryKeyExists) {
    schema.fields._id = {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    };
  } else {
    schema.fields._id = {
      type: DataTypes.VIRTUAL,
      get() {
        return `${this[idField!]}`;
      },
    };
  }
  return idField ?? '_id';
};

export async function getTransactionAndParsedQuery(
  transaction: Transaction | undefined,
  query: string | ParsedQuery,
  sequelize: Sequelize,
): Promise<{ t: Transaction; parsedQuery: ParsedQuery; transactionProvided: boolean }> {
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
    t = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
  }
  return { t, parsedQuery, transactionProvided };
}

export function processPushOperations(
  parentDoc: any,
  push: any,
  extractedRelations: any,
) {
  for (const key in push) {
    if (extractedRelations[key]) {
      if (!Array.isArray(extractedRelations[key])) {
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
}

export function compileSchema(
  schema: ConduitDatabaseSchema,
  registeredSchemas: Map<string, ConduitDatabaseSchema>,
  sequelizeModels: Indexable,
): ConduitDatabaseSchema {
  let compiledSchema = JSON.parse(JSON.stringify(schema));
  validateFieldConstraints(compiledSchema, 'sql');
  (compiledSchema as any).fields = JSON.parse(JSON.stringify(schema.compiledFields));
  if (registeredSchemas.has(compiledSchema.name)) {
    if (compiledSchema.name !== 'Config') {
      compiledSchema = validateFieldChanges(
        registeredSchemas.get(compiledSchema.name)!,
        compiledSchema,
      );
    }
    delete sequelizeModels[compiledSchema.collectionName];
  }
  return compiledSchema;
}

type Relation = {
  type: 'Relation';
  model: string;
  required?: boolean;
  select?: boolean;
};

type ExtractedRelations = {
  [p: string]: Relation | Relation[];
};

export async function resolveRelatedSchemas(
  schema: ConduitDatabaseSchema,
  extractedRelations: ExtractedRelations,
  models: Indexable,
) {
  const relatedSchemas: { [key: string]: SequelizeSchema | SequelizeSchema[] } = {};

  if (Object.keys(extractedRelations).length > 0) {
    let pendingModels: string[] = [];
    for (const relation in extractedRelations) {
      const rel = Array.isArray(extractedRelations[relation])
        ? (extractedRelations[relation] as UntypedArray)[0]
        : extractedRelations[relation];
      if (
        (!models[rel.model] || !models[rel.model].synced) &&
        schema.name !== rel.model
      ) {
        if (!pendingModels.includes(rel.model)) {
          pendingModels.push(rel.model);
        }
        if (Array.isArray(extractedRelations[relation])) {
          relatedSchemas[relation] = [rel.model];
        } else {
          relatedSchemas[relation] = rel.model;
        }
      } else {
        if (Array.isArray(extractedRelations[relation])) {
          relatedSchemas[relation] = [models[rel.model]];
        } else {
          relatedSchemas[relation] = models[rel.model];
        }
      }
    }
    while (pendingModels.length > 0) {
      await ConduitGrpcSdk.Sleep(500);
      pendingModels = pendingModels.filter(model => {
        if (!models[model] || !models[model].synced) {
          return true;
        } else {
          for (const schema in relatedSchemas) {
            const simple = Array.isArray(relatedSchemas[schema])
              ? (relatedSchemas[schema] as SequelizeSchema[])[0]
              : relatedSchemas[schema];
            // @ts-ignore
            if (simple === model) {
              relatedSchemas[schema] = Array.isArray(relatedSchemas[schema])
                ? [models[model]]
                : models[model];
            }
          }
        }
      });
    }
  }
  return relatedSchemas;
}

import { ParsedQuery } from '../../SchemaAdapter.js';
import { isNil } from 'lodash-es';
import { parseQuery } from '../parser/index.js';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { Model, ModelStatic, Transaction } from 'sequelize';
import { Indexable } from '@conduitplatform/grpc-sdk';

export function parseQueryFilter(
  sequelizeSchema: SequelizeSchema,
  parsedQuery: ParsedQuery,
  options?: { populate?: string[]; select?: string },
) {
  const queryOptions = !isNil(options)
    ? { ...options, exclude: [...sequelizeSchema.excludedFields] }
    : {};
  const parsingResult = parseQuery(
    sequelizeSchema.originalSchema,
    parsedQuery,
    sequelizeSchema.adapter.sequelize.getDialect(),
    sequelizeSchema.extractedRelations,
    queryOptions,
    sequelizeSchema.objectDotPaths,
    sequelizeSchema.objectDotPathMapping,
  );

  const filter = parsingResult.query ?? {};
  return { filter, parsingResult };
}

export function includeRelations(
  sequelizeSchema: SequelizeSchema,
  relationDirectory: string[],
  populate: string[],
) {
  return constructRelationInclusion(sequelizeSchema, relationDirectory, true).concat(
    constructRelationInclusion(
      sequelizeSchema,
      populate?.filter(p => !relationDirectory.includes(p)) || [],
    ),
  );
}

export function constructRelationInclusion(
  sequelizeSchema: SequelizeSchema,
  populate?: string[],
  required?: boolean,
) {
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
      let relationName = path[0];
      for (const objectPath of sequelizeSchema.objectDotPaths) {
        if (population.startsWith(objectPath)) {
          relationName = objectPath.replace(/\./g, '_');
          if (population === objectPath) {
            path = [relationName];
          } else {
            path = [relationName].concat(
              population
                .replace(objectPath + (population === objectPath ? '' : '.'), '')
                .split('.'),
            );
          }
          break;
        }
      }
      const relationTarget = sequelizeSchema.extractedRelations[relationName];
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
        attributes: {
          exclude: relationSchema.excludedFields.concat(
            path.length === 1 || Array.isArray(relationSchema.extractedRelations[path[1]])
              ? []
              : [`${path[1]}Id`],
          ),
        },
      };
      path.shift();
      if (path.length > 0) {
        path = [path.join('.')];
        relationObject.include = constructRelationInclusion(
          relationSchema,
          path,
          required,
        );
      }
      inclusionArray.push(relationObject);
    } else {
      const relationTarget = sequelizeSchema.extractedRelations[population];
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

export function createWithPopulation(
  sequelizeSchema: SequelizeSchema,
  doc: Model,
  relationObjects: Indexable,
  transaction?: Transaction,
) {
  let hasOne = false;
  for (const relation in sequelizeSchema.extractedRelations) {
    if (!sequelizeSchema.extractedRelations.hasOwnProperty(relation)) continue;
    if (!relationObjects.hasOwnProperty(relation)) continue;
    const relationTarget = sequelizeSchema.extractedRelations[relation];
    hasOne = true;
    if (Array.isArray(relationTarget)) {
      let modelName = relation.charAt(0).toUpperCase() + relation.slice(1);
      if (!modelName.endsWith('s')) {
        modelName = modelName + 's';
      }
      // @ts-ignore
      doc[`set${modelName}`](relationObjects[relation]);
    } else {
      const actualRel = relation.charAt(0).toUpperCase() + relation.slice(1);
      // @ts-ignore
      doc[`set${actualRel}`](relationObjects[relation]);
    }
  }
  return hasOne ? doc.save({ transaction }) : doc;
}

export function extractRelationsModification(
  sequelizeSchema: SequelizeSchema,
  parsedQuery: ParsedQuery,
) {
  const relationObjects = {};
  for (const target in parsedQuery) {
    if (!parsedQuery.hasOwnProperty(target)) continue;
    if (sequelizeSchema.extractedRelations.hasOwnProperty(target)) {
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

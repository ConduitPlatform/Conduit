import { ConduitError, ConduitModel, ConduitModelField } from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';
import { isObject } from 'lodash-es';

/*
 * Validates schema field constraints.
 * 'unique' requires 'required'
 */
export function validateFieldConstraints(schema: ConduitDatabaseSchema, db: string) {
  fieldsValidator(schema.name, schema.compiledFields, db);
}

export function fieldsValidator(
  schemaName: string,
  schemaFields: ConduitModel,
  db: string,
  blockRelations = false,
) {
  Object.keys(schemaFields).forEach(f => {
    if (f.includes('.')) {
      throw new ConduitError(
        'INVALID_ARGUMENTS',
        400,
        `Schema '${schemaName}' violates field '${f}' constraint (field names cannot contain '.').`,
      );
    }
    if (typeof schemaFields[f] === 'object') {
      const target: ConduitModelField = schemaFields[f] as ConduitModelField;
      const isUnique = !!target.unique;
      const isRequired = !!target.required;
      if (isUnique && !isRequired) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          `Schema '${schemaName}' violates unique field '${f}' constraint (field should be 'required').`,
        );
      }

      if (target.hasOwnProperty('type') && typeof target.type === 'object') {
        if (Array.isArray(target.type)) {
          if ((target.type as unknown[]).length !== 1) {
            throw new ConduitError(
              'INVALID_ARGUMENTS',
              400,
              `Schema '${schemaName}' array field '${f}' has invalid format (array should contain a single type).`,
            );
          }
          if (
            (target.type[0] &&
              typeof target.type[0] === 'object' &&
              target.type[0].hasOwnProperty('type') &&
              target.type[0].type !== 'Relation') ||
            (target.type[0] && typeof target.type[0] === 'object')
          ) {
            fieldsValidator(schemaName, target.type[0] as ConduitModel, db, db === 'sql');
          } else {
            fieldsValidator(
              schemaName,
              target.type[0] as unknown as ConduitModel,
              db,
              blockRelations,
            );
          }
        } else {
          fieldsValidator(schemaName, target.type as ConduitModel, db, blockRelations);
        }
      } else if (!target.hasOwnProperty('type') && isObject(target)) {
        if (Array.isArray(target)) {
          if ((target as unknown[]).length !== 1) {
            throw new ConduitError(
              'INVALID_ARGUMENTS',
              400,
              `Schema '${schemaName}' array field '${f}' has invalid format (array should contain a single type).`,
            );
          }
          if (
            (target[0] &&
              typeof target[0] === 'object' &&
              target[0].hasOwnProperty('type') &&
              target[0].type !== 'Relation') ||
            (target[0] && typeof target[0] === 'object')
          ) {
            fieldsValidator(schemaName, target[0] as ConduitModel, db, db === 'sql');
          } else {
            fieldsValidator(schemaName, target[0] as ConduitModel, db, blockRelations);
          }
        } else {
          fieldsValidator(schemaName, target as ConduitModel, db, blockRelations);
        }
      } else if (
        target.hasOwnProperty('type') &&
        target.type === 'Relation' &&
        blockRelations
      ) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          `Schema '${schemaName}' violates field '${f}' constraint (relations not allowed in embedded objects).`,
        );
      }
    }
  });
}

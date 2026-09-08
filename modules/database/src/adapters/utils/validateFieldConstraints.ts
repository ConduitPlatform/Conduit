import { ConduitError, ConduitModel, ConduitModelField } from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';
import { isObject } from 'lodash-es';
import { assertVectorFieldIfPresent } from './vectorField.js';

/*
 * Validates schema field constraints.
 * 'unique' requires 'required'
 */
export function validateFieldConstraints(schema: ConduitDatabaseSchema, db: string) {
  fieldsValidator(schema.name, schema.compiledFields, db);
}

function invalidField(message: string): never {
  throw new ConduitError('INVALID_ARGUMENTS', 400, message);
}

function usesSqlRelationBlock(item: unknown): boolean {
  return Boolean(
    (item &&
      typeof item === 'object' &&
      (item as ConduitModelField).hasOwnProperty('type') &&
      (item as ConduitModelField).type !== 'Relation') ||
    (item && typeof item === 'object'),
  );
}

function validateArrayContents(
  schemaName: string,
  field: string,
  items: unknown[],
  db: string,
  blockRelations: boolean,
) {
  if (items.length !== 1) {
    invalidField(
      `Schema '${schemaName}' array field '${field}' has invalid format (array should contain a single type).`,
    );
  }
  const nestedBlock = usesSqlRelationBlock(items[0]) ? db === 'sql' : blockRelations;
  fieldsValidator(schemaName, items[0] as ConduitModel, db, nestedBlock);
}

function validateObjectField(
  schemaName: string,
  field: string,
  target: ConduitModelField,
  db: string,
  blockRelations: boolean,
) {
  if (target.unique && !target.required) {
    invalidField(
      `Schema '${schemaName}' violates unique field '${field}' constraint (field should be 'required').`,
    );
  }
  if (target.hasOwnProperty('type') && typeof target.type === 'object') {
    if (Array.isArray(target.type)) {
      validateArrayContents(
        schemaName,
        field,
        target.type as unknown[],
        db,
        blockRelations,
      );
      return;
    }
    fieldsValidator(schemaName, target.type as ConduitModel, db, blockRelations);
    return;
  }
  if (!target.hasOwnProperty('type') && isObject(target)) {
    if (Array.isArray(target)) {
      validateArrayContents(schemaName, field, target as unknown[], db, blockRelations);
      return;
    }
    fieldsValidator(schemaName, target as ConduitModel, db, blockRelations);
    return;
  }
  if (target.hasOwnProperty('type') && target.type === 'Relation' && blockRelations) {
    invalidField(
      `Schema '${schemaName}' violates field '${field}' constraint (relations not allowed in embedded objects).`,
    );
  }
}

export function fieldsValidator(
  schemaName: string,
  schemaFields: ConduitModel,
  db: string,
  blockRelations = false,
) {
  Object.keys(schemaFields).forEach(f => {
    if (f.includes('.')) {
      invalidField(
        `Schema '${schemaName}' violates field '${f}' constraint (field names cannot contain '.').`,
      );
    }
    assertVectorFieldIfPresent(schemaName, f, schemaFields[f]);
    if (typeof schemaFields[f] === 'object') {
      validateObjectField(
        schemaName,
        f,
        schemaFields[f] as ConduitModelField,
        db,
        blockRelations,
      );
    }
  });
}

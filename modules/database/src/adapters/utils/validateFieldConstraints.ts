import { ConduitError, ConduitModel, ConduitModelField } from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema } from '../../interfaces';
import { isObject } from 'lodash';

/*
 * Validates schema field constraints.
 * 'unique' requires 'required'
 */
export function validateFieldConstraints(schema: ConduitDatabaseSchema) {
  fieldsValidator(schema.name, schema.compiledFields);
}

export function fieldsValidator(schemaName: string, schemaFields: ConduitModel) {
  Object.keys(schemaFields).forEach(f => {
    if (/(?<=[a-zA-Z0-9])_(?=[a-zA-Z0-9])|(?<=[a-zA-Z0-9])_$/g.test(f)) {
      throw new ConduitError(
        'INVALID_ARGUMENTS',
        400,
        `Schema '${schemaName}' violates field '${f}' constraint (field names cannot contain '_' in-between characters).`,
      );
    }
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
      // temporary disable
      // if (isUnique && !isRequired) {
      //   throw new ConduitError(
      //     'INVALID_ARGUMENTS',
      //     400,
      //     `Schema '${schemaName}' violates unique field '${f}' constraint (field should be 'required').`,
      //   );
      // }

      if (target.hasOwnProperty('type') && typeof target.type === 'object') {
        if (Array.isArray(target.type)) {
          if ((target.type as unknown[]).length !== 1) {
            throw new ConduitError(
              'INVALID_ARGUMENTS',
              400,
              `Schema '${schemaName}' array field '${f}' has invalid format (array should contain a single type).`,
            );
          }
          fieldsValidator(schemaName, target.type[0] as ConduitModel);
        } else {
          fieldsValidator(schemaName, target.type as ConduitModel);
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
          fieldsValidator(schemaName, target[0] as ConduitModel);
        } else {
          fieldsValidator(schemaName, target as ConduitModel);
        }
      }
    }
  });
}

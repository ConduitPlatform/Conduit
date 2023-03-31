import { ConduitError, Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema, Fields } from '../../interfaces';
import { isArray, isEqual, isNil, isString } from 'lodash';
import { DataTypes } from 'sequelize';

/*
 * Validates schema compiled fields for type changes.
 */
export function validateFieldChanges(
  oldSchema: ConduitDatabaseSchema,
  newSchema: ConduitDatabaseSchema,
) {
  validateSchemaFields(oldSchema.compiledFields, newSchema.compiledFields);
  return newSchema;
}

function validateSchemaFields(oldSchemaFields: Indexable, newSchemaFields: Indexable) {
  const tempObj: Fields = {};

  Object.keys(oldSchemaFields).forEach(key => {
    if (
      !oldSchemaFields[key].type &&
      !isString(oldSchemaFields[key]) &&
      !isArray(oldSchemaFields[key])
    ) {
      tempObj[key] = validateSchemaFields(oldSchemaFields[key], newSchemaFields[key]);
    } else {
      const oldType = oldSchemaFields[key].type ?? oldSchemaFields[key];
      if (isNil(newSchemaFields)) return;
      const newType = newSchemaFields[key]?.type ?? null;
      if (!newType) return;
      if (oldType === DataTypes.JSONB && newType === 'JSON') return;
      if (isArray(oldType) && isArray(newType)) {
        if (JSON.stringify(oldType[0]) !== JSON.stringify(newType[0]))
          throw ConduitError.forbidden('Invalid schema types');
      } else if (!isEqual(oldType, newType)) {
        // TODO: Support schema field type migration
        throw ConduitError.forbidden('Invalid schema types');
      }
    }
  });
  return newSchemaFields;
}

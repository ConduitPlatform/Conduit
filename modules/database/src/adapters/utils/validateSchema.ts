import { ConduitSchema, ConduitError } from '@conduitplatform/grpc-sdk';
import { Fields } from '../../interfaces';
import { isString, isArray, isNil } from 'lodash';
import { DataTypes } from 'sequelize';

/*
 * Validates base schema fields for type changes.
 * Extension fields are ignored.
 */
export function validateSchema(oldSchema: ConduitSchema, newSchema: ConduitSchema) {
  validateSchemaFields(oldSchema.fields, newSchema.fields);
  return newSchema;
}

function validateSchemaFields(oldSchemaFields: any, newSchemaFields: any) {
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
      } else if (oldType !== newType) {
        // TODO: Support schema field type migration
        throw ConduitError.forbidden('Invalid schema types');
      }
    }
  });
  return newSchemaFields;
}

import { ConduitError, ConduitSchema } from '@conduitplatform/grpc-sdk';
import { cloneDeep, isArray, isEmpty, isObject, isString, merge } from 'lodash';
import { Fields } from '../../interfaces';
import { DataTypes } from 'sequelize';

const deepdash = require('deepdash/standalone');

export function systemRequiredValidator(
  oldSchema: ConduitSchema,
  newSchema: ConduitSchema,
): ConduitSchema {
  const clonedOld = cloneDeep(oldSchema.fields);

  // get system required fields
  deepdash.eachDeep(
    clonedOld,
    (value: any, key: any, parent: any, ctx: any) => {
      if (ctx.depth === 0) return true;
      if (
        ((isString(value) || isArray(value)) && !parent.systemRequired) ||
        (!value.systemRequired && (isString(value.type) || isArray(value.type)))
      ) {
        delete parent[key];
        return false;
      } else if (isObject(value) && isEmpty(value)) {
        delete parent[key];
        return false;
      }
    },
    { callbackAfterIterate: true },
  );

  if (!isEmpty(clonedOld)) {
    merge(newSchema.fields, clonedOld);
  }

  // validate types
  validateSchemaFields(
    oldSchema.fields ?? oldSchema.modelSchema,
    newSchema.fields ?? newSchema.modelSchema,
  );

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
      // There used to be a check here for missing (non system required fields) from the new schema.
      // this got removed so that deletion of fields is supported
      // For a schema to be updated the caller must give the new schema after he gets the old one with getSchema

      const oldType = oldSchemaFields[key].type
        ? oldSchemaFields[key].type
        : oldSchemaFields[key];
      const newType =
        newSchemaFields[key] && newSchemaFields.type ? newSchemaFields[key].type : null;
      if (!newType) return;
      if (oldType === DataTypes.JSONB && newType === 'JSON') return;
      if (isArray(oldType) && isArray(newType)) {
        if (JSON.stringify(oldType[0]) !== JSON.stringify(newType[0]))
          throw ConduitError.forbidden('Invalid schema types');
      } else if (oldType !== newType) {
        // TODO migrate types
        throw ConduitError.forbidden('Invalid schema types');
      }
    }
  });
  return tempObj;
}

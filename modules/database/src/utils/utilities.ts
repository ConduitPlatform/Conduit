import {
  isArray,
  isBoolean,
  isEmpty,
  isEqual,
  isNil,
  isObject,
  isPlainObject,
  isString,
} from 'lodash-es';
import {
  ConduitModel,
  ConduitModelOptionsPermModifyType as ValidModifyPermValues,
  ConduitSchemaOptions,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';

import * as deepdash from 'deepdash-es/standalone';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

type CrudOperationConfig = { enabled?: boolean; authenticated?: boolean };

type CrudOperations = {
  create?: CrudOperationConfig;
  read?: CrudOperationConfig;
  update?: CrudOperationConfig;
  delete?: CrudOperationConfig;
};

interface Permissions {
  extendable?: boolean;
  canCreate?: boolean;
  canModify?: 'Everything' | 'Nothing' | 'ExtensionOnly';
  canDelete?: boolean;
}

export function wrongFields(schemaFields: string[], updateFields: string[]): boolean {
  const blackList = ['updatedAt', 'createdAt', '_id', '__v'];
  for (const element of blackList) {
    const index1 = schemaFields.indexOf(element);
    const index2 = updateFields.indexOf(element);
    if (index1 > -1) {
      schemaFields.splice(index1, 1);
    }
    if (index2 > -1) {
      updateFields.splice(index2, 1);
    }
  }

  if (!isEqual(schemaFields, updateFields)) {
    for (const element of updateFields) {
      if (!schemaFields.includes(element)) return false;
    }
  }

  return true;
}

export function validateSchemaInput(
  name: string,
  fields: ConduitModel | undefined,
  modelOptions: ConduitSchemaOptions,
) {
  if (!isNil(name) && !isString(name))
    throw new ModuleError({
      ...errors.SCHEMA_NAME_INVALID,
      message: "Field 'name' must be of type String",
    });
  if (name.indexOf('-') >= 0 || name.indexOf(' ') >= 0) {
    throw new ModuleError({
      ...errors.SCHEMA_NAME_INVALID,
      message: 'Names cannot include spaces and - characters',
    });
  }

  if (!isNil(modelOptions)) {
    validateModelOptions(modelOptions);
  }

  if (isNil(fields)) return null;
  if (!isPlainObject(fields)) {
    throw new ModuleError({
      ...errors.SCHEMA_FIELDS_INVALID,
      message: "'fields' must be an object",
    });
  }
  if (isEmpty(fields))
    throw new ModuleError({
      ...errors.SCHEMA_FIELDS_INVALID,
      message: "'fields' can't be an empty object",
    });

  let fieldsErrorFlag = false;
  deepdash.eachDeep(
    fields,
    (value: any, key: string, parent: Indexable, ctx: Indexable) => {
      if (fieldsErrorFlag) {
        ctx.break();
        return false;
      }

      if (isObject(value) && !value.hasOwnProperty('type')) return true;
      else if (isString(value) && key !== 'default') {
        fieldsErrorFlag = !Object.keys(TYPE).includes(value);
        return false;
      } else if (isPlainObject(value) && value.hasOwnProperty('type')) {
        if (!fieldsErrorFlag && isObject(value.type)) {
          return true;
        } else if (!fieldsErrorFlag && isArray(value.type)) {
          if (value.type.length > 1) fieldsErrorFlag = true;
          if (!fieldsErrorFlag)
            fieldsErrorFlag = !Object.values(TYPE).includes(value.type[0]);
          return false;
        } else fieldsErrorFlag = !Object.keys(TYPE).includes(value.type);
        if (!fieldsErrorFlag && value.type === TYPE.Relation) {
          if (value.hasOwnProperty('model')) {
            if (!isString(value.model)) fieldsErrorFlag = true;
          } else {
            fieldsErrorFlag = true;
          }
        }
        if (!fieldsErrorFlag && value.hasOwnProperty('select')) {
          fieldsErrorFlag = !isBoolean(value.select);
        }
        if (!fieldsErrorFlag && value.hasOwnProperty('unique')) {
          fieldsErrorFlag = !isBoolean(value.unique);
        }
        if (!fieldsErrorFlag && value.hasOwnProperty('required')) {
          fieldsErrorFlag = !isBoolean(value.required);
        }

        return false;
      } else if (isArray(value)) {
        if (value.length > 1) fieldsErrorFlag = true;
        if (!fieldsErrorFlag) fieldsErrorFlag = !Object.values(TYPE).includes(value[0]);
        return false;
      } else if (key === 'select' || key === 'required' || key === 'unique') {
        fieldsErrorFlag = !isBoolean(value);
      } else if (key === 'default') {
        fieldsErrorFlag = !isString(value);
      } else if (key === 'type') return true;
      else {
        fieldsErrorFlag = true;
        return false;
      }
    },
  );
  if (fieldsErrorFlag)
    throw new ModuleError({
      ...errors.SCHEMA_FIELDS_INVALID,
      message: 'Invalid schema fields configuration',
    });
}

export function populateArray(pop: any) {
  if (!pop) return pop;
  if (pop.indexOf(',') !== -1) {
    pop = pop.split(',');
  } else if (Array.isArray(pop)) {
    return pop;
  } else {
    pop = [pop];
  }
  return pop;
}

const ALLOWED_CONDUIT_READ_PREFERENCES = [
  'primary',
  'primaryPreferred',
  'secondary',
  'secondaryPreferred',
  'nearest',
] as const;

function validateModelOptions(modelOptions: ConduitSchemaOptions) {
  if (!isPlainObject(modelOptions))
    throw new ModuleError({
      ...errors.SCHEMA_OPTIONS_INVALID,
      message: 'Model options must be an object',
    });
  Object.keys(modelOptions).forEach(key => {
    if (key !== 'conduit' && key !== 'timestamps' && key !== 'indexes')
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: "Only 'conduit', 'timestamps', and 'indexes' options allowed",
      });
    else if (key === 'timestamps' && !isBoolean(modelOptions.timestamps))
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: "Option 'timestamps' must be of type Boolean",
      });
    else if (key === 'indexes' && !isArray(modelOptions.indexes))
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: "Option 'indexes' must be of type Array",
      });
    else if (key === 'conduit') {
      if (!isObject(modelOptions.conduit))
        throw new ModuleError({
          ...errors.SCHEMA_OPTIONS_INVALID,
          message: "Option 'conduit' must be of type Object",
        });
      Object.keys(modelOptions.conduit).forEach((conduitKey: string) => {
        if (conduitKey === 'readPreference') {
          const rp = modelOptions.conduit!.readPreference;
          if (rp !== undefined && rp !== null && rp !== '') {
            if (typeof rp !== 'string')
              throw new ModuleError({
                ...errors.SCHEMA_OPTIONS_INVALID,
                message: "Conduit field 'readPreference' must be of type string",
              });
            if (
              !ALLOWED_CONDUIT_READ_PREFERENCES.includes(
                rp as (typeof ALLOWED_CONDUIT_READ_PREFERENCES)[number],
              )
            ) {
              throw new ModuleError({
                ...errors.SCHEMA_OPTIONS_INVALID,
                message: `Invalid conduit.readPreference: ${rp}`,
              });
            }
          }
          return;
        }
        if (
          conduitKey !== 'cms' &&
          conduitKey !== 'permissions' &&
          conduitKey !== 'authorization' &&
          conduitKey !== 'imported' &&
          conduitKey !== 'realtime'
        )
          throw new ModuleError({
            ...errors.SCHEMA_OPTIONS_INVALID,
            message:
              "Only 'cms', 'permissions', 'authorization', 'imported', 'readPreference', and 'realtime' fields allowed inside 'conduit' field",
          });
        if (conduitKey === 'imported') {
          if (!isBoolean(modelOptions.conduit!.imported))
            throw new ModuleError({
              ...errors.SCHEMA_OPTIONS_INVALID,
              message: `Conduit field option 'imported' must be of type Boolean`,
            });
        } else {
          if (!isObject(modelOptions.conduit![conduitKey]))
            throw new ModuleError({
              ...errors.SCHEMA_OPTIONS_INVALID,
              message: `Conduit field option ${conduitKey} must be of type Object`,
            });
        }
      });
      if (modelOptions.conduit!.cms?.enabled) {
        if (!isBoolean(modelOptions.conduit.cms.enabled))
          throw new ModuleError({
            ...errors.SCHEMA_OPTIONS_INVALID,
            message: "CMS field 'enabled' must be of type Boolean",
          });
      }
      if (modelOptions.conduit!.cms?.crudOperations) {
        validateCrudOperations(modelOptions.conduit.cms.crudOperations);
      }
      if (modelOptions.conduit!.permissions) {
        validatePermissions(modelOptions.conduit.permissions);
      }
    }
  });
}

function validateCrudOperations(crudOperations: CrudOperations) {
  const allowedCrudOperations: Array<keyof CrudOperations> = [
    'create',
    'read',
    'update',
    'delete',
  ];

  if (!isObject(crudOperations))
    throw new ModuleError({
      ...errors.SCHEMA_OPTIONS_INVALID,
      message: `CMS field 'crudOperations' must be of type Object`,
    });

  (Object.keys(crudOperations) as Array<keyof CrudOperations>).forEach(op => {
    if (!allowedCrudOperations.includes(op)) {
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: `Unrecognized CRUD operation '${op}' provided`,
      });
    }

    const operationConfig = crudOperations[op];

    if (!isObject(operationConfig)) {
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: `Crud operation field '${op}' must be of type Object`,
      });
    }

    const config = operationConfig as CrudOperationConfig;

    Object.keys(config).forEach(opField => {
      if (opField !== 'enabled' && opField !== 'authenticated') {
        throw new ModuleError({
          ...errors.SCHEMA_OPTIONS_INVALID,
          message: `Unrecognized crud operation field '${opField}' for operation '${op}' provided`,
        });
      }

      if (!isBoolean(config[opField])) {
        throw new ModuleError({
          ...errors.SCHEMA_OPTIONS_INVALID,
          message: `Crud operation field '${opField}' for operation '${op}' must be of type Boolean`,
        });
      }
    });
  });
}

export function validatePermissions(permissions: Permissions) {
  Object.keys(permissions).forEach(perm => {
    const key = perm as keyof Permissions;
    if (permissions[key] === undefined) return;
    if (!['extendable', 'canCreate', 'canModify', 'canDelete'].includes(key)) {
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: `Unrecognized permission '${key}' provided`,
      });
    }
    if (key !== 'canModify') {
      if (!isBoolean(permissions[key]))
        throw new ModuleError({
          ...errors.SCHEMA_OPTIONS_INVALID,
          message: `Permission field '${key}' must be of type Boolean`,
        });
    } else if (
      !isString(permissions[key]) ||
      !ValidModifyPermValues.includes(
        permissions.canModify as 'Everything' | 'Nothing' | 'ExtensionOnly',
      )
    )
      throw new ModuleError({
        ...errors.SCHEMA_OPTIONS_INVALID,
        message: `Permission field 'canModify' must be one of: ${ValidModifyPermValues.join(
          ', ',
        )}`,
      });
  });
}

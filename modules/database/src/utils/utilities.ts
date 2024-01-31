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

type CrudOperations = {
  create?: { enabled?: boolean; authenticated?: boolean };
  read?: { enabled?: boolean; authenticated?: boolean };
  update?: { enabled?: boolean; authenticated?: boolean };
  delete?: { enabled?: boolean; authenticated?: boolean };
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
  fields: ConduitModel,
  modelOptions: ConduitSchemaOptions,
) {
  if (!isNil(name) && !isString(name))
    throw new Error("Field 'name' must be of type String");
  if (name.indexOf('-') >= 0 || name.indexOf(' ') >= 0) {
    throw new Error('Names cannot include spaces and - characters');
  }

  if (!isNil(modelOptions)) {
    validateModelOptions(modelOptions);
  }

  if (isNil(fields)) return null;
  if (!isPlainObject(fields)) {
    return "'fields' must be an object";
  }
  if (isEmpty(fields)) throw new Error("'fields' can't be an empty object");

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
  if (fieldsErrorFlag) throw new Error('Invalid schema fields configuration');
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

function validateModelOptions(modelOptions: ConduitSchemaOptions) {
  if (!isPlainObject(modelOptions)) throw new Error('Model options must be an object');
  Object.keys(modelOptions).forEach(key => {
    if (key !== 'conduit' && key !== 'timestamps')
      throw new Error("Only 'conduit' and 'timestamps' options allowed");
    else if (key === 'timestamps' && !isBoolean(modelOptions.timestamps))
      throw new Error("Option 'timestamps' must be of type Boolean");
    else if (key === 'conduit') {
      if (!isObject(modelOptions.conduit))
        throw new Error("Option 'conduit' must be of type Object");
      Object.keys(modelOptions.conduit).forEach((conduitKey: string) => {
        if (
          conduitKey !== 'cms' &&
          conduitKey !== 'permissions' &&
          conduitKey !== 'authorization' &&
          conduitKey !== 'imported'
        )
          throw new Error(
            "Only 'cms' and 'permissions' fields allowed inside 'conduit' field",
          );
        if (conduitKey === 'imported') {
          if (!isBoolean(modelOptions.conduit!.imported))
            throw new Error(`Conduit field option 'imported' must be of type Boolean`);
        } else {
          if (!isObject(modelOptions.conduit![conduitKey]))
            throw new Error(`Conduit field option ${conduitKey} must be of type Object`);
        }
      });
      if (modelOptions.conduit!.cms?.enabled) {
        if (!isBoolean(modelOptions.conduit.cms.enabled))
          return "CMS field 'enabled' must be of type Boolean";
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
    throw new Error(`CMS field 'crudOperations' must be of type Object`);

  Object.keys(crudOperations).forEach(op => {
    if (!allowedCrudOperations.includes(op as keyof CrudOperations)) {
      throw new Error(`Unrecognized CRUD operation '${op}' provided`);
    }
    // @ts-ignore
    if (!isObject(crudOperations[op])) {
      throw new Error(`Crud operation field '${op}' must be of type Object`);
    }
    // @ts-ignore
    Object.keys(crudOperations[op]).forEach(opField => {
      if (!['enabled', 'authenticated'].includes(opField)) {
        throw new Error(
          `Unrecognized crud operation field '${opField}' for operation '${op}' provided`,
        );
      }
      // @ts-ignore
      if (!isBoolean(crudOperations[op][opField])) {
        throw new Error(
          `Crud operation field '${opField}' for operation '${op}' must be of type Boolean`,
        );
      }
    });
  });
}

export function validatePermissions(permissions: Permissions) {
  Object.keys(permissions).forEach(perm => {
    const key = perm as keyof Permissions;
    if (permissions[key] === undefined) return;
    if (!['extendable', 'canCreate', 'canModify', 'canDelete'].includes(key)) {
      throw new Error(`Unrecognized permission '${key}' provided`);
    }
    if (key !== 'canModify') {
      if (!isBoolean(permissions[key]))
        throw new Error(`Permission field '${key}' must be of type Boolean`);
    } else if (
      !isString(permissions[key]) ||
      !ValidModifyPermValues.includes(
        permissions.canModify as 'Everything' | 'Nothing' | 'ExtensionOnly',
      )
    )
      throw new Error(
        `Permission field 'canModify' must be one of: ${ValidModifyPermValues.join(
          ', ',
        )}`,
      );
  });
}

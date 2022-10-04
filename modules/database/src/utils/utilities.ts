import {
  isArray,
  isBoolean,
  isEmpty,
  isNil,
  isObject,
  isPlainObject,
  isString,
  isEqual,
} from 'lodash';
import {
  ConduitModel,
  ConduitSchemaOptions,
  Indexable,
  TYPE,
  ConduitModelOptionsPermModifyType as ValidModifyPermValues,
} from '@conduitplatform/grpc-sdk';

const deepdash = require('deepdash/standalone');

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
        if (conduitKey !== 'cms' && conduitKey !== 'permissions')
          throw new Error(
            "Only 'cms' and 'permissions' fields allowed inside 'conduit' field",
          );
        if (!isObject(modelOptions.conduit![conduitKey]))
          throw new Error(`Conduit field option ${conduitKey} must be of type Object`);
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

function validateCrudOperations(crudOperations: {
  create?: { enabled?: boolean; authenticated?: boolean };
  read?: { enabled?: boolean; authenticated?: boolean };
  update?: { enabled?: boolean; authenticated?: boolean };
  delete?: { enabled?: boolean; authenticated?: boolean };
}) {
  if (!isObject(crudOperations))
    throw new Error(`CMS field 'crudOperations' must be of type Object`);
  Object.keys(crudOperations).forEach(op => {
    // @ts-ignore
    if (!crudOperations[op] === undefined) return;
    if (!['create', 'read', 'update', 'delete'].includes(op)) {
      throw new Error(`Unrecognized CRUD operation '${op}' provided`);
    }
    // @ts-ignore
    if (!isObject(crudOperations[op])) {
      throw new Error(`Crud operation field '${op}' must be of type Object`);
    }
    // @ts-ignore
    Object.keys(crudOperations[op]).forEach(opField => {
      // @ts-ignore
      if (!crudOperations[op][opField] === undefined) return;
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

export function validatePermissions(permissions: {
  extendable?: boolean;
  canCreate?: boolean;
  canModify?: 'Everything' | 'Nothing' | 'ExtensionOnly';
  canDelete?: boolean;
}) {
  Object.keys(permissions).forEach(perm => {
    // @ts-ignore
    if (permissions[perm] === undefined) return;
    if (!['extendable', 'canCreate', 'canModify', 'canDelete'].includes(perm)) {
      throw new Error(`Unrecognized permission '${perm}' provided`);
    }
    if (perm !== 'canModify') {
      // @ts-ignore
      if (!isBoolean(permissions[perm]))
        throw new Error(`Permission field '${perm}' must be of type Boolean`);
    } else if (
      !isString(permissions[perm]) ||
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

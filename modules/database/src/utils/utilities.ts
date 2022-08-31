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
  enabled?: boolean,
) {
  if (!isNil(enabled) && !isBoolean(enabled)) {
    return "Field 'enabled' must be of type Boolean";
  }

  if (!isNil(name) && !isString(name)) return "Field 'name' must be of type String";

  if (!isNil(modelOptions)) {
    let optionsValidationError = null;
    if (!isPlainObject(modelOptions)) {
      optionsValidationError = 'Model options must be an object';
    }
    Object.keys(modelOptions).forEach(key => {
      if (key === 'timestamps' && !isBoolean(modelOptions[key])) {
        optionsValidationError = "Option 'timestamps' must be of type Boolean";
      }
      if (key !== 'timestamps') {
        optionsValidationError = "Only 'timestamps' option is allowed";
      }
    });
    if (!isNil(optionsValidationError)) return optionsValidationError;
  }

  if (isNil(fields)) return null;
  if (!isPlainObject(fields)) {
    return "'fields' must be an object";
  }
  if (isEmpty(fields)) return "'fields' can't be an empty object";

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
  if (fieldsErrorFlag) return 'Invalid schema fields configuration';
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

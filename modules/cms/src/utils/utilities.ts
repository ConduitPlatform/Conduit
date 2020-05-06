import { isBoolean, isEmpty, isNil, isObject, isPlainObject, isString, isArray } from 'lodash';
import { TYPE } from '@conduit/sdk';
const deepdash = require('deepdash/standalone');

export function validateSchemaInput(name: any, fields: any, modelOptions: any, enabled?: any) {
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
  deepdash.eachDeep(fields, (value: any, key: any, parent: any, ctx: any) => {
    if (fieldsErrorFlag) {
      ctx.break();
      return false;
    }

    if (isObject(value) && !value.hasOwnProperty('type')) return true;
    else if (isString(value)) {
      fieldsErrorFlag = !Object.keys(TYPE).includes(value);
      return false;
    }
    else if (isPlainObject(value) && value.hasOwnProperty('type')) {
      if (!fieldsErrorFlag && isArray(value.type)) {
        if (value.type.length > 1) fieldsErrorFlag = true;
        if (!fieldsErrorFlag) fieldsErrorFlag = !Object.values(TYPE).includes(value.type[0]);
        return false;
      }
      fieldsErrorFlag = !Object.keys(TYPE).includes(value.type);
      if (!fieldsErrorFlag && value.type === TYPE.Relation) {
        if (value.hasOwnProperty('ref')) {
          if (!isString(value.ref)) fieldsErrorFlag = true;
        } else {
          fieldsErrorFlag = true;
        }
      }
      if (!fieldsErrorFlag && value.hasOwnProperty('unique')) {
        fieldsErrorFlag = !isBoolean(value.unique);
      }
      if (!fieldsErrorFlag && value.hasOwnProperty('required')) {
        fieldsErrorFlag = !isBoolean(value.required);
      }

      return false;
    }
    else if (isArray(value)) {
      if (value.length > 1) fieldsErrorFlag = true;
      if (!fieldsErrorFlag) fieldsErrorFlag = !Object.values(TYPE).includes(value[0]);
      return false;
    }
    else {
      fieldsErrorFlag = true;
      return false;
    }

  });
  if (fieldsErrorFlag) return "Invalid schema fields configuration";
}

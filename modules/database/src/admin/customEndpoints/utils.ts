import { Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';

/**
 * Query schema:
 * {
 * name: String,
 * type: String that is inside the TYPE enum of the sdk
 * location: String (Body, queryParams, url)
 * }
 */
export function queryValidation(
  query: any,
  findSchema: Indexable,
  inputs: Indexable,
): true | string {
  if (query.hasOwnProperty('AND')) {
    if (Object.keys(query).length !== 1) {
      return 'Invalid number of keys';
    }
    query = query['AND'];
  } else if (query.hasOwnProperty('OR')) {
    if (Object.keys(query).length !== 1) {
      return 'Invalid number of keys';
    }
    query = query['OR'];
  } else if (query.hasOwnProperty('schemaField')) {
    const error = _queryValidation(
      findSchema,
      inputs,
      query.schemaField,
      query.operation,
      query.comparisonField,
    );
    if (error !== true) {
      return error;
    }
    query['AND'] = [{ ...query }];
    delete query.schemaField;
    delete query.operation;
    delete query.comparisonField;
    return true;
  } else {
    return 'Invalid field, missing an AND/OR';
  }

  for (const q of query) {
    if (q.hasOwnProperty('schemaField')) {
      const error = _queryValidation(
        findSchema,
        inputs,
        q.schemaField,
        q.operation,
        q.comparisonField,
      );
      if (error !== true) {
        return error;
      }
    } else if (q.hasOwnProperty('AND') || q.hasOwnProperty('OR')) {
      const error = queryValidation(q, findSchema, inputs);
      if (error !== true) {
        return error;
      }
    } else {
      return 'Invalid fields';
    }
  }

  return true;
}

function _queryValidation(
  findSchema: Indexable,
  inputs: Indexable,
  schemaField: string,
  operation: number,
  comparisonField: Indexable,
) {
  if (isNil(schemaField) || isNil(operation) || isNil(comparisonField)) {
    return 'schemaField, operation and comparisonField must be present in the input';
  }
  if (schemaField.length === 0) {
    return 'schemaField cannot be empty';
  }

  if (
    Object.keys(comparisonField).length === 0 ||
    isNil(comparisonField.type) ||
    isNil(comparisonField.value)
  ) {
    return 'comparisonField cannot be empty and should contain type and value';
  }

  if (!Object.keys(findSchema.compiledFields).includes(schemaField)) {
    return 'schemaField is not present in selected schema!';
  }

  if (operation < 0 || operation > 10) {
    return 'operation is invalid!';
  }

  if (comparisonField.type === 'Schema') {
    if (!Object.keys(findSchema.compiledFields).includes(comparisonField.value)) {
      return 'comparisonField value is not present in selected schema!';
    }
  } else if (comparisonField.type === 'Input') {
    const inputNames = inputs.map((r: Indexable) => r.name);
    if (!inputNames.includes(comparisonField.value)) {
      return 'comparisonField value is not present in provided inputs!';
    }
  } else if (comparisonField.type !== 'Custom' && comparisonField.type !== 'Context') {
    return 'comparisonField type is invalid!';
  }
  return true;
}

/**
 * Input schema:
 * {
 * name: String,
 * type: String that is inside the TYPE enum of the sdk
 * location: String (Body, queryParams, url)
 * }
 */
export function inputValidation(
  name: string,
  type: any,
  location: number,
  isArray?: boolean,
): boolean | string {
  if (isNil(name) || isNil(type) || isNil(location)) {
    return 'Name, type and location must be present in the input';
  }
  if (name.length === 0) {
    return 'Name cannot be empty';
  }
  if (type.length === 0) {
    return 'Type cannot be empty';
  }

  if (!Object.values(TYPE).includes(type)) {
    return 'Type is not valid!';
  }

  if (location < 0 || location > 2) {
    return 'Location is not valid!';
  }

  if (location === 2 && isArray) {
    return 'Url params cant have an array input';
  }

  return true;
}

/**
 * Assignment schema:
 * {
 * schemaField: String
 * action: Number
 * assignmentField: {type: String, value: String}
 * }
 */
export function assignmentValidation(
  findSchema: Indexable,
  inputs: Indexable,
  operation: number,
  schemaField: string,
  assignmentField: Indexable,
  action: number,
): boolean | string {
  if (isNil(schemaField) || isNil(assignmentField) || isNil(action)) {
    return 'schemaField, assignmentField and action must be present in the input';
  }
  if (schemaField.length === 0) {
    return 'schemaField cannot be empty';
  }

  if (action < 0 || action > 4) {
    return 'action is invalid!';
  }

  // action are available only for PUT (update) operations
  if (operation !== 2 && action !== 0) {
    return 'action is invalid';
  }

  if (
    Object.keys(assignmentField).length === 0 ||
    isNil(assignmentField.type) ||
    isNil(assignmentField.value)
  ) {
    return 'assignmentField cannot be empty and should contain type and value';
  }

  if (!Object.keys(findSchema.compiledFields).includes(schemaField)) {
    return 'schemaField is not present in selected schema!';
  }

  if (assignmentField.type === 'Input') {
    const inputNames = inputs.map((r: Indexable) => r.name);
    if (!inputNames.includes(assignmentField.value)) {
      return 'assignmentField value is not present in provided inputs!';
    }
  } else if (assignmentField.type !== 'Custom' && assignmentField.type !== 'Context') {
    return 'assignmentField type is invalid!';
  }

  if (action === 3 || action === 4) {
    if (!Array.isArray(findSchema.compiledFields[schemaField].type)) {
      return 'append and remove actions are valid only for array schema fields';
    }
  }

  return true;
}

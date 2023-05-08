import { ConduitModel, GrpcError, Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { isNil, isPlainObject, get } from 'lodash';
import { status } from '@grpc/grpc-js';
import { LocationEnum, OperationsEnum } from '../../enums';
import { ICustomEndpoint } from '../../interfaces';

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
  fields: ConduitModel,
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
      fields,
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
        fields,
        inputs,
        q.schemaField,
        q.operation,
        q.comparisonField,
      );
      if (error !== true) {
        return error;
      }
    } else if (q.hasOwnProperty('AND') || q.hasOwnProperty('OR')) {
      const error = queryValidation(q, fields, inputs);
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
  fields: ConduitModel,
  inputs: Indexable,
  schemaField: string,
  operation: number,
  comparisonField: Indexable,
) {
  if (isNil(schemaField) || isNil(operation) || isNil(comparisonField)) {
    return 'schemaField, operation and comparisonField must be present/accessible in the input';
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

  if (!get(fields, schemaField)) {
    return 'schemaField is not present/accessible in selected schema!';
  }

  if (operation < 0 || operation > 10) {
    return 'operation is invalid!';
  }

  if (comparisonField.type === 'Schema') {
    if (!Object.keys(fields).includes(comparisonField.value)) {
      return 'comparisonField value is not present/accessible in selected schema!';
    }
  } else if (comparisonField.type === 'Input') {
    const inputNames = inputs.map((r: Indexable) => r.name);
    if (!inputNames.includes(comparisonField.value)) {
      return 'comparisonField value is not present/accessible in provided inputs!';
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
function _inputValidation(
  operation: number,
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

  if (location === LocationEnum.URL && isArray) {
    return "Url params can't have an array input";
  }

  if (
    (operation === OperationsEnum.GET || operation === OperationsEnum.DELETE) &&
    location === LocationEnum.BODY
  ) {
    return 'GET or DELETE requests can not have body parameters';
  }

  return true;
}

export function inputValidation(
  operation: number,
  inputs?: Indexable | null,
): boolean | string {
  if (!isNil(inputs) && inputs.length) {
    for (const r of Object.keys(inputs)) {
      const input = inputs[r];
      const error = _inputValidation(
        operation,
        input.name,
        input.type,
        input.location,
        input.array,
      );
      if (error !== true) {
        return error as string;
      }
    }
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
  fields: ConduitModel,
  inputs: Indexable,
  operation: number,
  schemaField: string,
  assignmentField: Indexable,
  action: number,
): boolean | string {
  if (isNil(schemaField) || isNil(assignmentField) || isNil(action)) {
    return 'schemaField, assignmentField and action must be present/accessible in the input';
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

  if (!get(fields, schemaField)) {
    return 'schemaField is not present/accessible in selected schema!';
  }

  if (assignmentField.type === 'Input') {
    const inputNames = inputs.map((r: Indexable) => r.name);
    if (!inputNames.includes(assignmentField.value)) {
      return 'assignmentField value is not present/accessible in provided inputs!';
    }
  } else if (assignmentField.type !== 'Custom' && assignmentField.type !== 'Context') {
    return 'assignmentField type is invalid!';
  }

  if (action === 3 || action === 4) {
    if (!Array.isArray((fields[schemaField] as Indexable).type)) {
      return 'append and remove actions are valid only for array schema fields';
    }
  }

  return true;
}

export function paramValidation(params: Indexable): boolean | string {
  const { name, operation, selectedSchema, selectedSchemaName, query, assignments } =
    params;
  const error = selectedSchemaValidation(selectedSchema, selectedSchemaName);
  if (error !== true) {
    return error as string;
  }
  if (name.length === 0) {
    return 'name must not be empty';
  }
  if (operation < 0 || operation > 4) {
    return 'operation is not valid';
  }
  if (operation !== OperationsEnum.POST && isNil(query)) {
    return 'Specified operation requires that query field also be provided';
  }
  if (
    (operation === OperationsEnum.POST ||
      operation === OperationsEnum.PUT ||
      operation === OperationsEnum.PATCH) &&
    isNil(assignments)
  ) {
    return 'Specified operation requires that assignments field also be provided';
  }
  return true;
}

function selectedSchemaValidation(
  selectedSchema: string,
  selectedSchemaName: string,
): boolean | string {
  if (isNil(selectedSchema) && isNil(selectedSchemaName)) {
    return 'Either selectedSchema or selectedSchemaName must be specified';
  }
  if (!isNil(selectedSchema) && selectedSchema.length === 0) {
    return 'selectedSchema must not be empty';
  }
  if (isNil(selectedSchema) && selectedSchemaName.length === 0) {
    return 'selectedSchemaName must not be empty';
  }
  return true;
}

export function operationValidation(
  operation: number,
  query: Indexable,
  assignments: Indexable,
): boolean | string {
  if (operation !== OperationsEnum.POST && !isPlainObject(query)) {
    return 'The query field must be an object';
  }
  if (
    (operation === OperationsEnum.POST ||
      operation === OperationsEnum.PUT ||
      operation === OperationsEnum.PATCH) &&
    (!Array.isArray(assignments) || assignments.length === 0)
  ) {
    return "Custom endpoint's target operation requires that assignments field be a non-empty array";
  }
  return true;
}

export function paginationAndSortingValidation(
  operation: number,
  params: ICustomEndpoint,
  fields: ConduitModel,
  endpoint: Indexable | null,
) {
  const { query, inputs, sorted, paginated } = params;

  if (paginated && operation !== OperationsEnum.GET) {
    return 'Cannot add pagination to non-get endpoint';
  } else if (paginated && endpoint !== null) {
    endpoint.paginated = paginated;
  }
  if (sorted && operation !== OperationsEnum.GET) {
    return 'Cannot add sorting to non-get endpoint';
  } else if (sorted && endpoint !== null) {
    endpoint.sorted = sorted;
  }
  if (operation !== OperationsEnum.POST) {
    const error = queryValidation(query, fields, inputs);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    if (endpoint !== null) {
      endpoint.query = query;
    }
  }
  return true;
}

export function validateAssignments(
  assignments: {
    schemaField: string;
    action: number;
    assignmentField: { type: string; value: Indexable };
  }[],
  fields: ConduitModel,
  inputs: Indexable,
  operation: OperationsEnum,
): void {
  assignments.forEach(
    (r: {
      schemaField: string;
      action: number;
      assignmentField: { type: string; value: Indexable };
    }) => {
      const error = assignmentValidation(
        fields,
        inputs,
        operation,
        r.schemaField,
        r.assignmentField,
        r.action,
      );
      if (error !== true) {
        throw new GrpcError(status.INVALID_ARGUMENT, error as string);
      }
    },
  );
}

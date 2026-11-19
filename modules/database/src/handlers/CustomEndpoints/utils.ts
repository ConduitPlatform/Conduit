import { isNil } from 'lodash-es';
import { Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { CustomEndpointsQuery } from '../../interfaces/index.js';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';

interface Inputs {
  name: string;
  type: string;
  location: number;
  optional?: boolean;
  array?: boolean;
}

interface constructQueryParams {
  inputs: Inputs[];
  params: Indexable;
  context: Indexable;
}

const SCALAR_TYPES: string[] = [
  TYPE.String,
  TYPE.Number,
  TYPE.Boolean,
  TYPE.Date,
  TYPE.ObjectId,
];

// true if any key, at any depth, starts with '$'
export function hasOperatorKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || value instanceof Date) return false;
  if (Array.isArray(value)) return value.some(hasOperatorKeys);
  return Object.entries(value).some(
    ([key, nested]) => key.startsWith('$') || hasOperatorKeys(nested),
  );
}

function isPlainScalar(value: unknown) {
  return value === null || typeof value !== 'object' || value instanceof Date;
}

// reject object values for scalar inputs and operator keys in user-supplied input
export function validateInputs(inputs: Inputs[], params: Indexable) {
  for (const input of inputs) {
    const value = params[input.name];
    if (isNil(value)) continue;
    const invalid = (reason: string) =>
      new ModuleError({
        ...errors.CUSTOM_ENDPOINT_INPUT_INVALID,
        message: `Input ${input.name} ${reason}`,
      });
    if (SCALAR_TYPES.includes(input.type)) {
      const valid = input.array
        ? Array.isArray(value) && value.every(isPlainScalar)
        : isPlainScalar(value);
      if (!valid) {
        throw invalid(`must be of type ${input.type}${input.array ? ' array' : ''}`);
      }
    } else if (hasOperatorKeys(value)) {
      throw invalid('contains invalid keys');
    }
  }
}

export function constructQuery(
  endpointQuery: Indexable,
  { inputs, params, context }: constructQueryParams,
) {
  const res: Indexable = {};
  let resTopLevel: string;
  let endpointTopLevel: string;

  if (endpointQuery.hasOwnProperty('AND')) {
    resTopLevel = '$and';
    endpointTopLevel = 'AND';
  } else if (endpointQuery.hasOwnProperty('OR')) {
    resTopLevel = '$or';
    endpointTopLevel = 'OR';
  } else {
    throw new ModuleError(errors.CUSTOM_ENDPOINT_DEFINITION_CORRUPT, 'Invalid fields');
  }

  res[resTopLevel] = [];
  endpointQuery[endpointTopLevel].forEach((query: CustomEndpointsQuery) => {
    if (query.hasOwnProperty('schemaField')) {
      const r = _constructQuery(query, { inputs, params, context });
      if (!isNil(r)) {
        res[resTopLevel].push(r);
      }
    } else if (query.hasOwnProperty('AND') || query.hasOwnProperty('OR')) {
      const r = constructQuery(query, { inputs, params, context });
      if (!isNil(r)) {
        res[resTopLevel].push(r);
      }
    } else {
      throw new ModuleError(errors.CUSTOM_ENDPOINT_DEFINITION_CORRUPT, 'Invalid fields');
    }
  });

  if (res[resTopLevel].length === 0) {
    return {};
  }
  return res;
}

function _constructQuery(
  query: {
    schemaField: string;
    operation: number;
    comparisonField: {
      type: string;
      value: any;
      like?: boolean;
      caseSensitiveLike?: boolean;
    };
  },
  { inputs, params, context }: constructQueryParams,
) {
  if (query.comparisonField.type === 'Input') {
    if (isNil(params[query.comparisonField.value])) {
      const res = inputs.filter(input => {
        return input.name === query.comparisonField.value && input.optional;
      });
      if (res && res.length > 0) {
        return;
      }

      throw new ModuleError({
        ...errors.CUSTOM_ENDPOINT_INPUT_MISSING,
        message: `Field ${query.comparisonField.value} is missing from input`,
      });
    }

    return _translateQuery(
      query.schemaField,
      query.operation,
      params[query.comparisonField.value],
      query.comparisonField.like,
      query.comparisonField.caseSensitiveLike,
    );
  } else if (query.comparisonField.type === 'Context') {
    if (isNil(context)) {
      throw new ModuleError({
        ...errors.CUSTOM_ENDPOINT_CONTEXT_MISSING,
        message: `Field ${query.comparisonField.value} is missing from context`,
      });
    }
    for (const key of query.comparisonField.value.split('.')) {
      if (context.hasOwnProperty(key)) {
        context = context[key];
      } else {
        throw new ModuleError({
          ...errors.CUSTOM_ENDPOINT_CONTEXT_MISSING,
          message: `Field ${query.comparisonField.value} is missing from context`,
        });
      }
    }
    return _translateQuery(
      query.schemaField,
      query.operation,
      context,
      query.comparisonField.like,
      query.comparisonField.caseSensitiveLike,
    );
  } else {
    return _translateQuery(
      query.schemaField,
      query.operation,
      query.comparisonField.value,
      query.comparisonField.like,
      query.comparisonField.caseSensitiveLike,
    );
  }
}

function _translateQuery(
  schemaField: string,
  operation: number,
  comparisonField: any,
  like?: boolean,
  caseSensitiveLike?: boolean,
) {
  //   EQUAL: 0, //'equal to'
  //   NEQUAL: 1, //'not equal to'
  //   GREATER: 2, //'greater than'
  //   GREATER_EQ: 3, //'greater that or equal to'
  //   LESS: 4, //'less than'
  //   LESS_EQ: 5, //'less that or equal to'
  //   EQUAL_SET: 6, //'equal to any of the following'
  //   NEQUAL_SET: 7, //'not equal to any of the following'
  //   CONTAIN: 8, //'an array containing'
  if (like) {
    if (caseSensitiveLike) {
      comparisonField = { $like: `%${comparisonField}%` };
    } else {
      comparisonField = { $ilike: `%${comparisonField}%` };
    }
  }

  switch (operation) {
    case 0:
      return { [schemaField]: comparisonField };
    case 1:
      return { [schemaField]: { $ne: comparisonField } };
    case 2:
      return { [schemaField]: { $gt: comparisonField } };
    case 3:
      return { [schemaField]: { $gte: comparisonField } };
    case 4:
      return { [schemaField]: { $lt: comparisonField } };
    case 5:
      return { [schemaField]: { $lte: comparisonField } };
    case 6:
      return { [schemaField]: { $in: comparisonField } };
    case 7:
      return { [schemaField]: { $nin: comparisonField } };
    default:
      return { [schemaField]: comparisonField };
  }
}

export function constructAssignment(
  schemaField: string,
  action: number,
  assignmentValue: string,
) {
  //   SET: 0,
  //   INCREMENT: 1,
  //   DECREMENT: 2,
  //   APPEND: 3,
  //   REMOVE: 4
  switch (action) {
    case 0:
      return `\"${schemaField}\": ${assignmentValue}`;
    case 1:
      return `\"$inc\": { \"${schemaField}\": ${assignmentValue} }`;
    case 2:
      return `\"$inc\": { \"${schemaField}\": -${assignmentValue} }`;
    case 3:
      return `\"$push\": { \"${schemaField}\": ${assignmentValue} }`;
    case 4:
      return `\"$pull\": { \"${schemaField}\": ${assignmentValue} }`;
    default:
      return `\"${schemaField}\": ${assignmentValue}`;
  }
}

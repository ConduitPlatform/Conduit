import moment from 'moment';
import { isNil } from 'lodash';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { CustomEndpointsQuery } from '../../interfaces';

const escapeStringRegexp = require('escape-string-regexp');

export function constructQuery(
  endpointQuery: Indexable,
  inputs: {
    name: string;
    type: string;
    location: number;
    optional?: boolean;
    array?: boolean;
  }[],
  params: Indexable,
  context: Indexable,
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
    throw new Error('Invalid fields');
  }

  res[resTopLevel] = [];
  endpointQuery[endpointTopLevel].forEach((query: CustomEndpointsQuery) => {
    if (query.hasOwnProperty('schemaField')) {
      const r = _constructQuery(query, inputs, params, context);
      if (!isNil(r)) {
        res[resTopLevel].push(r);
      }
    } else if (query.hasOwnProperty('AND') || query.hasOwnProperty('OR')) {
      const r = constructQuery(query, inputs, params, context);
      if (!isNil(r)) {
        res[resTopLevel].push(r);
      }
    } else {
      throw new Error('Invalid fields');
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
    comparisonField: { type: string; value: any; like: boolean };
  },
  inputs: {
    name: string;
    type: string;
    location: number;
    optional?: boolean;
    array?: boolean;
  }[],
  params: Indexable,
  context: Indexable,
) {
  if (query.comparisonField.type === 'Input') {
    if (isNil(params[query.comparisonField.value])) {
      const res = inputs.filter(input => {
        return input.name === query.comparisonField.value && input.optional;
      });
      if (res && res.length > 0) {
        return;
      }

      throw new Error(`Field ${query.comparisonField.value} is missing from input`);
    }

    return _translateQuery(
      query.schemaField,
      query.operation,
      params[query.comparisonField.value],
      query.comparisonField.like,
    );
  } else if (query.comparisonField.type === 'Context') {
    if (isNil(context)) {
      throw new Error(`Field ${query.comparisonField.value} is missing from context`);
    }
    for (const key of query.comparisonField.value.split('.')) {
      if (context.hasOwnProperty(key)) {
        context = context[key];
      } else {
        throw new Error(`Field ${query.comparisonField.value} is missing from context`);
      }
    }
    return _translateQuery(
      query.schemaField,
      query.operation,
      context,
      query.comparisonField.like,
    );
  } else {
    return _translateQuery(
      query.schemaField,
      query.operation,
      query.comparisonField.value,
      query.comparisonField.like,
    );
  }
}

function _translateQuery(
  schemaField: string,
  operation: number,
  comparisonField: any,
  like?: boolean,
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
  const isDate = moment(comparisonField, 'YYYY-MM-DDTHH:MM:SS.mmmZ', true).isValid();
  if (isDate) {
    comparisonField = { $date: comparisonField };
  } else if (like) {
    comparisonField = escapeStringRegexp(comparisonField);
    comparisonField = { $regex: `.*${comparisonField}.*`, $options: 'i' };
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
    // maybe something else??
    case 8:
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

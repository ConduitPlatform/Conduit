import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export type VectorFilterProvider = 'mongodb' | 'postgres';

const COMPARISON_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte']);
const MEMBERSHIP_OPERATORS = new Set(['$in', '$nin']);
const LOGICAL_OPERATORS = new Set(['$and', '$or', '$nor']);
const MONGO_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const POSTGRES_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_FIELD_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

export interface ValidatedVectorSearchFilter {
  filter: Indexable;
  emptyResult: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function invalid(message: string): never {
  throw new GrpcError(status.INVALID_ARGUMENT, message);
}

function assertAllowedField(
  field: string,
  provider: VectorFilterProvider,
  allowedFields?: readonly string[],
): void {
  const pattern = provider === 'postgres' ? POSTGRES_FIELD_PATTERN : MONGO_FIELD_PATTERN;
  if (!pattern.test(field) || field.startsWith('$') || RESERVED_FIELD_NAMES.has(field)) {
    invalid(`Unsupported vector search filter field '${field}'`);
  }
  if (allowedFields && !allowedFields.includes(field)) {
    invalid(
      provider === 'mongodb'
        ? `Vector search filter field '${field}' is not an indexed filter field. ` +
            `Allowed fields: ${allowedFields.length ? allowedFields.join(', ') : '(none)'}`
        : `Vector search filter field '${field}' is not a schema field. ` +
            `Allowed fields: ${allowedFields.join(', ')}`,
    );
  }
}

function validateMembership(value: unknown, operator: string): { empty: boolean } {
  if (!Array.isArray(value)) {
    invalid(`Vector search operator ${operator} requires an array`);
  }
  for (const item of value) {
    if (!isScalar(item)) {
      invalid(`Vector search operator ${operator} only accepts scalar values`);
    }
  }
  if (operator === '$in' && value.length === 0) {
    return { empty: true };
  }
  return { empty: false };
}

function validateComparisonValue(value: unknown, operator: string): void {
  if (operator === '$eq' || operator === '$ne') {
    if (!isScalar(value)) {
      invalid(`Vector search operator ${operator} only accepts scalar values`);
    }
    return;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    invalid(`Vector search operator ${operator} only accepts number or string values`);
  }
}

function validateFieldPredicate(
  field: string,
  value: unknown,
  provider: VectorFilterProvider,
  allowedFields?: readonly string[],
): { empty: boolean } {
  assertAllowedField(field, provider, allowedFields);
  if (isScalar(value)) {
    return { empty: false };
  }
  if (!isPlainObject(value)) {
    invalid(`Unsupported vector search filter value for '${field}'`);
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    invalid(`Unsupported vector search filter value for '${field}'`);
  }
  let empty = false;
  for (const operator of keys) {
    if (operator === '$not') {
      const nested = value[operator];
      if (!isPlainObject(nested)) {
        invalid(`Vector search operator $not requires a comparison object`);
      }
      // Negating a match-nothing predicate matches everything.
      validateFieldPredicate(field, nested, provider, allowedFields);
      continue;
    }
    if (COMPARISON_OPERATORS.has(operator)) {
      validateComparisonValue(value[operator], operator);
      continue;
    }
    if (MEMBERSHIP_OPERATORS.has(operator)) {
      const result = validateMembership(value[operator], operator);
      if (result.empty) empty = true;
      continue;
    }
    invalid(`Unsupported vector search filter operator '${operator}'`);
  }
  return { empty };
}

function validateLogical(
  operator: string,
  value: unknown,
  provider: VectorFilterProvider,
  allowedFields?: readonly string[],
): { empty: boolean } {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(`Vector search operator ${operator} requires a non-empty array`);
  }
  const branchEmpty = value.map(branch =>
    validateFilterNode(branch, provider, allowedFields),
  );
  if (operator === '$and') {
    return { empty: branchEmpty.some(branch => branch.empty) };
  }
  if (operator === '$or') {
    return { empty: branchEmpty.every(branch => branch.empty) };
  }
  return { empty: false };
}

function validateFilterNode(
  node: unknown,
  provider: VectorFilterProvider,
  allowedFields?: readonly string[],
): { empty: boolean } {
  if (!isPlainObject(node)) {
    invalid('Vector search filter must be an object');
  }
  const keys = Object.keys(node);
  if (!keys.length) {
    return { empty: false };
  }
  let emptyAnd = false;
  const orEmpty: boolean[] = [];
  for (const key of keys) {
    if (LOGICAL_OPERATORS.has(key)) {
      const result = validateLogical(key, node[key], provider, allowedFields);
      if (key === '$and' && result.empty) emptyAnd = true;
      if (key === '$or') orEmpty.push(result.empty);
      continue;
    }
    const result = validateFieldPredicate(key, node[key], provider, allowedFields);
    if (result.empty) emptyAnd = true;
  }
  if (emptyAnd) return { empty: true };
  if (orEmpty.length && orEmpty.every(Boolean) && keys.every(key => key === '$or')) {
    return { empty: true };
  }
  return { empty: false };
}

export function validateVectorSearchFilter(
  filter: Indexable | undefined,
  options: {
    provider: VectorFilterProvider;
    allowedFilterFields?: readonly string[];
  },
): ValidatedVectorSearchFilter {
  if (filter === undefined || filter === null) {
    return { filter: {}, emptyResult: false };
  }
  if (!isPlainObject(filter)) {
    invalid('Vector search filter must be an object');
  }
  const allowedFields =
    options.provider === 'mongodb'
      ? (options.allowedFilterFields ?? [])
      : options.allowedFilterFields;
  const emptyResult = validateFilterNode(filter, options.provider, allowedFields).empty;
  return { filter, emptyResult };
}

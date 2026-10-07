import { GrpcError, Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Types } from 'mongoose';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const LOGICAL_OPERATORS = new Set(['$and', '$or', '$nor']);
const SCALAR_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte']);
const ARRAY_OPERATORS = new Set(['$in', '$nin', '$all']);
const PREDICATE_OPERATORS = new Set(['$not', '$elemMatch']);

/**
 * Pipeline stages, plus the query operators that evaluate aggregation
 * expressions or server-side JavaScript. None of them belong in a plain filter.
 * `$search` is left out because it is also the operand key of `$text`.
 */
const AGGREGATION_OPERATORS = new Set([
  '$addFields',
  '$bucket',
  '$bucketAuto',
  '$count',
  '$densify',
  '$facet',
  '$fill',
  '$geoNear',
  '$graphLookup',
  '$group',
  '$limit',
  '$lookup',
  '$match',
  '$merge',
  '$out',
  '$project',
  '$redact',
  '$replaceRoot',
  '$replaceWith',
  '$sample',
  '$set',
  '$setWindowFields',
  '$skip',
  '$sort',
  '$sortByCount',
  '$unionWith',
  '$unset',
  '$unwind',
  '$vectorSearch',
  '$expr',
  '$where',
  '$function',
  '$accumulator',
]);

/** Stages that pass documents through unchanged, so later $match stages still see schema fields. */
const SHAPE_PRESERVING_STAGES = new Set([
  '$match',
  '$sort',
  '$skip',
  '$limit',
  '$sample',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Fields Mongo stores as ObjectId: `_id`, ObjectId fields, and Relations. */
export function mongoObjectIdFields(schemaFields: Record<string, unknown>): Set<string> {
  const fields = new Set(['_id']);
  for (const [name, definition] of Object.entries(schemaFields)) {
    const field = Array.isArray(definition) ? definition[0] : definition;
    const type = isPlainObject(field) ? field.type : field;
    if (type === TYPE.ObjectId || type === TYPE.Relation) fields.add(name);
  }
  return fields;
}

/** Returns the first aggregation stage or expression operator found anywhere in `value`. */
export function findMongoAggregationOperator(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMongoAggregationOperator(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!isPlainObject(value)) return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (AGGREGATION_OPERATORS.has(key)) return key;
    const found = findMongoAggregationOperator(nested);
    if (found) return found;
  }
  return undefined;
}

export function assertNoMongoAggregationOperators(filter: Indexable): void {
  const operator = findMongoAggregationOperator(filter);
  if (operator) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Filter must not contain aggregation operator '${operator}'`,
    );
  }
}

function castValue(value: unknown): unknown {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value)
    ? new Types.ObjectId(value)
    : value;
}

// Only comparison and membership operands are IDs; $regex, $exists, $type and
// the like keep their values.
function castPredicate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(castValue);
  if (!isPlainObject(value)) return castValue(value);
  const next: Record<string, unknown> = {};
  for (const [operator, operand] of Object.entries(value)) {
    if (SCALAR_OPERATORS.has(operator)) {
      next[operator] = castValue(operand);
    } else if (ARRAY_OPERATORS.has(operator) && Array.isArray(operand)) {
      next[operator] = operand.map(castValue);
    } else if (PREDICATE_OPERATORS.has(operator)) {
      next[operator] = castPredicate(operand);
    } else {
      next[operator] = operand;
    }
  }
  return next;
}

function castFilter(filter: Indexable, objectIdFields: ReadonlySet<string>): Indexable {
  const next: Indexable = {};
  for (const [key, value] of Object.entries(filter)) {
    if (LOGICAL_OPERATORS.has(key) && Array.isArray(value)) {
      next[key] = value.map(branch =>
        isPlainObject(branch) ? castFilter(branch, objectIdFields) : branch,
      );
    } else if (objectIdFields.has(key)) {
      next[key] = castPredicate(value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Filters that reach the native driver (aggregations) arrive as JSON, so
 * ObjectId values are hex strings, and Mongo never matches a string against an
 * ObjectId: a filter like `_id: { $in: [ids] }` returns nothing. Casts 24-hex
 * strings on ObjectId-typed fields. Rejects filters carrying aggregation
 * operators, since their field references can't be cast by name.
 */
export function castMongoFilterObjectIds(
  filter: Indexable,
  objectIdFields: ReadonlySet<string>,
): Indexable {
  assertNoMongoAggregationOperators(filter);
  return castFilter(filter, objectIdFields);
}

/**
 * Casts ObjectId strings in the $match stages that open a pipeline. Casting
 * stops at the first stage that can reshape documents ($project, $group,
 * $lookup, ...), after which field names no longer map to the schema. A $match
 * that uses aggregation operators such as $expr is left as is: callers convert
 * inside those with $toObjectId.
 */
export function castMongoPipelineObjectIds(
  pipeline: unknown,
  objectIdFields: ReadonlySet<string>,
): unknown {
  if (!Array.isArray(pipeline)) return pipeline;
  const next = [...pipeline];
  for (let i = 0; i < next.length; i++) {
    const stage = next[i];
    if (!isPlainObject(stage)) break;
    const keys = Object.keys(stage);
    if (keys.length !== 1 || !SHAPE_PRESERVING_STAGES.has(keys[0])) break;
    const filter = stage.$match;
    if (isPlainObject(filter) && !findMongoAggregationOperator(filter)) {
      next[i] = { $match: castFilter(filter, objectIdFields) };
    }
  }
  return next;
}

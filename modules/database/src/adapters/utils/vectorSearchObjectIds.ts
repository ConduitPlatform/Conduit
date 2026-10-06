import { Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { Types } from 'mongoose';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const LOGICAL_OPERATORS = new Set(['$and', '$or', '$nor']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function castValue(value: unknown): unknown {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value)
    ? new Types.ObjectId(value)
    : value;
}

function castPredicate(value: unknown): unknown {
  if (!isPlainObject(value)) return castValue(value);
  const next: Record<string, unknown> = {};
  for (const [operator, operand] of Object.entries(value)) {
    if (operator === '$not') {
      next[operator] = castPredicate(operand);
    } else if (Array.isArray(operand)) {
      next[operator] = operand.map(castValue);
    } else {
      next[operator] = castValue(operand);
    }
  }
  return next;
}

/**
 * Vector filters arrive as JSON, so ObjectId values are hex strings, and
 * $vectorSearch never matches a string against an ObjectId: a filter like
 * `_id: { $in: [ids] }` returned nothing. Run this after validation, which only
 * accepts scalars, to cast 24-hex strings on ObjectId-typed fields.
 */
export function castMongoVectorFilterObjectIds(
  filter: Indexable,
  objectIdFields: ReadonlySet<string>,
): Indexable {
  const next: Indexable = {};
  for (const [key, value] of Object.entries(filter)) {
    if (LOGICAL_OPERATORS.has(key) && Array.isArray(value)) {
      next[key] = value.map(branch =>
        isPlainObject(branch)
          ? castMongoVectorFilterObjectIds(branch, objectIdFields)
          : branch,
      );
    } else if (objectIdFields.has(key)) {
      next[key] = castPredicate(value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export interface PostgresWhereRenderer {
  quoteIdentifier: (identifier: string) => string;
  escape: (value: unknown) => string;
}

function invalid(message: string): never {
  throw new GrpcError(status.INVALID_ARGUMENT, message);
}

function renderComparison(
  fieldSql: string,
  operator: string,
  value: unknown,
  renderer: PostgresWhereRenderer,
): string {
  switch (operator) {
    case '$eq':
      return value === null
        ? `${fieldSql} IS NULL`
        : `${fieldSql} = ${renderer.escape(value)}`;
    case '$ne':
      return value === null
        ? `${fieldSql} IS NOT NULL`
        : `${fieldSql} <> ${renderer.escape(value)}`;
    case '$gt':
      return `${fieldSql} > ${renderer.escape(value)}`;
    case '$gte':
      return `${fieldSql} >= ${renderer.escape(value)}`;
    case '$lt':
      return `${fieldSql} < ${renderer.escape(value)}`;
    case '$lte':
      return `${fieldSql} <= ${renderer.escape(value)}`;
    default: {
      const exhaustive: never = operator as never;
      invalid(`Unsupported vector search filter operator '${String(exhaustive)}'`);
    }
  }
}

function renderFieldPredicate(
  field: string,
  value: unknown,
  renderer: PostgresWhereRenderer,
): string {
  const fieldSql = renderer.quoteIdentifier(field);
  if (value === null) {
    return `${fieldSql} IS NULL`;
  }
  if (typeof value === 'boolean') {
    return `${fieldSql} = ${value ? 'TRUE' : 'FALSE'}`;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return `${fieldSql} = ${renderer.escape(value)}`;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Unsupported vector search filter shape');
  }
  const clauses: string[] = [];
  for (const [operator, operand] of Object.entries(value as Record<string, unknown>)) {
    if (operator === '$in') {
      const values = operand as unknown[];
      if (!values.length) {
        return 'FALSE';
      }
      clauses.push(
        `${fieldSql} IN (${values.map(item => renderer.escape(item)).join(', ')})`,
      );
      continue;
    }
    if (operator === '$nin') {
      const values = operand as unknown[];
      if (!values.length) {
        continue;
      }
      clauses.push(
        `${fieldSql} NOT IN (${values.map(item => renderer.escape(item)).join(', ')})`,
      );
      continue;
    }
    if (operator === '$not') {
      const nested = renderFieldPredicate(field, operand, renderer);
      clauses.push(`NOT (${nested})`);
      continue;
    }
    clauses.push(renderComparison(fieldSql, operator, operand, renderer));
  }
  if (!clauses.length) {
    return 'TRUE';
  }
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' AND ')})`;
}

function renderNode(node: Indexable, renderer: PostgresWhereRenderer): string {
  const clauses: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === '$and' && Array.isArray(value)) {
      const nested = value
        .map(item => renderNode(item as Indexable, renderer))
        .filter(Boolean);
      if (nested.length) clauses.push(`(${nested.join(' AND ')})`);
      continue;
    }
    if (key === '$or' && Array.isArray(value)) {
      const nested = value.map(item => renderNode(item as Indexable, renderer));
      clauses.push(`(${nested.join(' OR ')})`);
      continue;
    }
    if (key === '$nor' && Array.isArray(value)) {
      const nested = value.map(item => renderNode(item as Indexable, renderer));
      clauses.push(`NOT (${nested.join(' OR ')})`);
      continue;
    }
    clauses.push(renderFieldPredicate(key, value, renderer));
  }
  return clauses.filter(Boolean).join(' AND ');
}

export function renderPostgresVectorWhere(
  filter: Indexable | undefined,
  renderer: PostgresWhereRenderer,
): string {
  if (!filter || !Object.keys(filter).length) {
    return '';
  }
  const body = renderNode(filter, renderer);
  if (!body) return '';
  if (body === 'FALSE') {
    return ' WHERE FALSE';
  }
  return ` WHERE ${body}`;
}

import { createHash } from 'node:crypto';
import type { SqlDialect } from './constants.js';
import { TRIGGER_NAME_PREFIX } from './constants.js';

const MYSQL_IDENT_LIMIT = 64;
const POSTGRES_IDENT_LIMIT = 63;
const SQLITE_IDENT_LIMIT = 128;

export type QuoteIdent = (name: string) => string;

export function quoteIdent(dialect: SqlDialect, name: string): string {
  if (dialect === 'mysql' || dialect === 'mariadb') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function identifierLimit(dialect: SqlDialect): number {
  switch (dialect) {
    case 'postgres':
      return POSTGRES_IDENT_LIMIT;
    case 'mysql':
    case 'mariadb':
      return MYSQL_IDENT_LIMIT;
    case 'sqlite':
      return SQLITE_IDENT_LIMIT;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

export function triggerBaseName(collectionName: string, dialect: SqlDialect): string {
  return fitIdentifier(
    `${TRIGGER_NAME_PREFIX}${collectionName}`,
    identifierLimit(dialect),
  );
}

export function rowTriggerName(
  collectionName: string,
  operation: 'i' | 'u' | 'd',
  dialect: SqlDialect,
): string {
  return fitIdentifier(
    `${TRIGGER_NAME_PREFIX}${operation}_${collectionName}`,
    identifierLimit(dialect),
  );
}

export function fitIdentifier(raw: string, maxLength: number): string {
  if (raw.length <= maxLength) {
    return raw;
  }
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8);
  const keep = Math.max(0, maxLength - hash.length - 1);
  return `${raw.slice(0, keep)}_${hash}`;
}

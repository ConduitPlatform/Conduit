import { Query } from '../../types/db.js';
import { AuthzOptions, PopulateAuthzOptions } from '../../types/options.js';
import type { FindManyOptions, FindOneOptions } from './types.js';

/**
 * Builders for the query messages, shared by the one-off calls on
 * `DatabaseProvider` and the same calls made inside a `DatabaseTransaction`.
 */

export type CountDocumentsOptions = AuthzOptions & { readPreference?: string };

function toPopulateArray(populate?: string | string[]): string[] {
  if (!populate) return [];
  return Array.isArray(populate) ? populate : [populate];
}

function constructSortObj(sort: string[]) {
  const sortObj: { [field: string]: -1 | 1 } = {};
  sort.forEach((sortVal: string) => {
    sortVal = sortVal.trim();
    if (sortVal.indexOf('-') !== -1) {
      sortObj[sortVal.substring(1)] = -1;
    } else {
      sortObj[sortVal] = 1;
    }
  });
  return sortObj;
}

export function processQuery<T>(query: Query<T> | Query<T>[]) {
  return JSON.stringify(query);
}

export function findOneRequest<T>(
  schemaName: string,
  query: Query<T>,
  options?: FindOneOptions,
) {
  const o = options ?? {};
  return {
    schemaName,
    query: processQuery(query),
    ...o,
    select: o.select === null ? undefined : o.select,
    populate: toPopulateArray(o.populate),
  };
}

export function findManyRequest<T>(
  schemaName: string,
  query: Query<T>,
  options?: FindManyOptions,
) {
  const o: FindManyOptions = { ...(options ?? {}) };
  if (typeof o.sort === 'string') o.sort = [o.sort];
  const sortObj = Array.isArray(o.sort) ? constructSortObj(o.sort) : o.sort;
  return {
    schemaName,
    query: processQuery(query),
    ...o,
    select: o.select === null ? undefined : o.select,
    sort: sortObj,
    populate: toPopulateArray(o.populate),
  };
}

export function queryRequest<T>(
  schemaName: string,
  query: Query<T> | Query<T>[],
  options?: AuthzOptions | CountDocumentsOptions,
) {
  return {
    schemaName,
    query: processQuery(query),
    ...(options ?? {}),
  };
}

export function updateRequest<T>(
  schemaName: string,
  id: string,
  document: Query<T>,
  options?: PopulateAuthzOptions,
) {
  const o = options ?? {};
  return {
    schemaName,
    id,
    query: processQuery(document),
    userId: o.userId,
    scope: o.scope,
    populate: toPopulateArray(o.populate),
    suppressEvent: o.suppressEvent,
  };
}

export function updateManyRequest<T>(
  schemaName: string,
  filterQuery: Query<T>,
  query: Query<T>,
  options?: PopulateAuthzOptions,
) {
  const o = options ?? {};
  return {
    schemaName,
    filterQuery: processQuery(filterQuery),
    query: processQuery(query),
    userId: o.userId,
    scope: o.scope,
    populate: toPopulateArray(o.populate),
    suppressEvent: o.suppressEvent,
  };
}

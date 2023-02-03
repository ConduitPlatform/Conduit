import { ParsedQuery } from '../../../interfaces';
import { isArray, isBoolean, isNumber, isString } from 'lodash';
import { Indexable } from '@conduitplatform/grpc-sdk';

export function parseQuery(query: ParsedQuery): ParsedQuery {
  return _parseQuery(query) as ParsedQuery;
}

export function _parseQuery(query?: ParsedQuery | null): ParsedQuery | null | undefined {
  if (query === undefined) return undefined;
  if (query === null) return null;
  const parsed: Indexable = isArray(query) ? [] : {};
  if (isString(query) || isBoolean(query) || isNumber(query)) return query;
  for (const key in query) {
    if (key === '$or') {
      Object.assign(parsed, {
        $or: query[key].map((operation: ParsedQuery) => {
          return parseQuery(operation);
        }),
      });
    } else if (key === '$and') {
      Object.assign(parsed, {
        $and: query[key].map((operation: ParsedQuery) => {
          return parseQuery(operation);
        }),
      });
    } else {
      if (!!query[key] && typeof query[key] === 'object' && !Array.isArray(query[key])) {
        const likeCandidates = Object.keys(query[key]);
        if (likeCandidates.includes('$like')) {
          Object.assign(parsed, {
            [key]: { $regex: `.*${query[key].$like.slice(1).slice(0, -1)}.*` },
          });
          continue;
        }
        if (likeCandidates.includes('$ilike')) {
          Object.assign(parsed, {
            [key]: {
              $regex: `.*${query[key].$ilike.slice(1).slice(0, -1)}.*`,
              $options: 'i',
            },
          });
          continue;
        }
      }
      if (query[key] === undefined) {
        Object.assign(parsed, {
          [key]: undefined,
        });
      } else {
        Object.assign(parsed, {
          [key]: parseQuery(query[key]),
        });
      }
    }
  }
  return parsed;
}

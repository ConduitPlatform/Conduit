import { Indexable } from '@conduitplatform/grpc-sdk';
import { ParsedQuery } from '../../../interfaces/index.js';
import { Types } from 'mongoose';

import escapeStringRegexp from 'escape-string-regexp';

export function parseQuery(query: ParsedQuery): ParsedQuery {
  if (Array.isArray(query)) {
    return query.map(item => parseQuery(item));
  } else if (
    typeof query === 'object' &&
    query !== null &&
    !(query instanceof Types.ObjectId || query instanceof Buffer || query instanceof Date)
  ) {
    const parsedQuery: Indexable = {};
    if (Object.keys(query).length === 0) return query;
    Object.keys(query).forEach(key => {
      if (key === '$like') {
        parsedQuery.$regex = escapeStringRegexp(query.$like).replace(/%/g, '.*');
      } else if (key === '$ilike') {
        parsedQuery.$regex = escapeStringRegexp(query.$ilike).replace(/%/g, '.*');
        parsedQuery.$options = 'i';
      } else {
        parsedQuery[key] = parseQuery(query[key]);
      }
    });
    return parsedQuery;
  } else {
    return query;
  }
}

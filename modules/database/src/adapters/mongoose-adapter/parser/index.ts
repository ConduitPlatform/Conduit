import { Indexable } from '@conduitplatform/grpc-sdk';
import { ParsedQuery } from '../../../interfaces';

export function parseQuery(query: ParsedQuery): ParsedQuery {
  if (Array.isArray(query)) {
    return query.map(item => parseQuery(item));
  } else if (typeof query === 'object' && query !== null) {
    const parsedQuery: Indexable = {};
    Object.keys(query).forEach(key => {
      if (key === '$like') {
        parsedQuery.$regex = query.$like.replace(/%/g, '.*');
      } else if (key === '$ilike') {
        parsedQuery.$regex = query.$ilike.replace(/%/g, '.*');
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

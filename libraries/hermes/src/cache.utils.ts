import { CacheScope } from 'apollo-cache-control';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from './classes';

const crypto = require('crypto');

export function createHashKey(
  path: string,
  context: Indexable,
  params: Indexable,
  urlParams?: Indexable,
  queryParams?: Indexable,
) {
  let hashKey: string = path + JSON.stringify(context) + JSON.stringify(params);
  if (urlParams) {
    hashKey += JSON.stringify(urlParams);
  }
  if (queryParams) {
    hashKey += JSON.stringify(queryParams);
  }
  hashKey = crypto.createHash('md5').update(hashKey).digest('hex');
  return hashKey;
}

export function extractCaching(
  route: ConduitRoute,
  reqCacheHeader?: string,
): { caching: boolean; cacheAge?: number; scope?: string } {
  let caching: boolean = false;
  let cacheAge: any | undefined;
  let scope: string | undefined;
  if (route.input.cacheControl && route.input.cacheControl.indexOf(',') !== -1) {
    caching = true;
    const cache: string[] = route.input.cacheControl.split(',');
    scope = cache[0];
    cacheAge = cache[1].replace('max-age=', '');
    cacheAge = Number.parseInt(cacheAge);
  }

  if (reqCacheHeader && reqCacheHeader === 'no-cache') {
    caching = false;
  }
  return { caching, cacheAge, scope };
}

export function extractCachingGql(
  route: ConduitRoute,
  cacheHeader?: string,
): { caching: boolean; cacheAge?: number; scope?: CacheScope } {
  let { caching, cacheAge, scope } = extractCaching(route, cacheHeader);
  scope = scope === 'public' ? CacheScope.Public : CacheScope.Private;
  return { caching, cacheAge, scope: scope as CacheScope };
}

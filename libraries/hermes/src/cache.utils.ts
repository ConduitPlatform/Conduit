import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from './classes';
import { CacheScope } from '@apollo/cache-control-types';
const crypto = require('crypto');

export function createHashKey(path: string, context: Indexable, params: Indexable) {
  let hashKey: string = path + JSON.stringify(context) + JSON.stringify(params);
  hashKey = crypto.createHash('md5').update(hashKey).digest('hex');
  return hashKey;
}

export function extractCaching(
  route: ConduitRoute,
  reqCacheHeader?: string,
): { caching: boolean; cacheAge?: number; scope?: string } {
  let caching: boolean = false;
  let cacheAge: number | undefined;
  let scope: string | undefined;
  if (reqCacheHeader === 'no-cache') {
    caching = false;
  } else if (route.input.cacheControl && route.input.cacheControl.indexOf(',') !== -1) {
    caching = true;
    const cache: string[] = route.input.cacheControl.split(',');
    scope = cache[0];
    const cacheAgeStr = cache[1].replace('max-age=', '');
    cacheAge = Number.parseInt(cacheAgeStr);
  }
  return { caching, cacheAge, scope };
}

export function extractCachingGql(
  route: ConduitRoute,
  cacheHeader?: string,
): { caching: boolean; cacheAge?: number; scope?: CacheScope } {
  let { caching, cacheAge, scope } = extractCaching(route, cacheHeader);
  scope = scope === 'public' ? 'PUBLIC' : 'PRIVATE';
  return { caching, cacheAge, scope: scope as CacheScope };
}

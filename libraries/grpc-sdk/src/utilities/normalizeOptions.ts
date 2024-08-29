import { AuthzOptions, PopulateAuthzOptions } from '../types';
import { isNil } from 'lodash';

export function normalizeAuthzOptions(
  userIdOrOptions?: string | AuthzOptions,
  scope?: string,
): AuthzOptions {
  if (typeof userIdOrOptions === 'string' || isNil(userIdOrOptions)) {
    return { userId: userIdOrOptions, scope };
  }
  return userIdOrOptions;
}

export function normalizePopulateAuthzOptions(
  populateOrOptions?: string | string[] | PopulateAuthzOptions,
  userId?: string,
  scope?: string,
) {
  if (
    typeof populateOrOptions === 'string' ||
    Array.isArray(populateOrOptions) ||
    isNil(populateOrOptions)
  ) {
    return { populate: populateOrOptions, userId, scope };
  }
  return populateOrOptions;
}

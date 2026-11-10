import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import escapeStringRegexp from 'escape-string-regexp';
import { AuthUtils } from '../utils/index.js';
import { withHomeScope } from '../utils/realm.logic.js';

/*
 * Pure rules of the user admin routes (no database or grpc access). IO lives in
 * ./user.ts and ./team.ts.
 */

export const OAUTH_PROVIDER_KEYS = [
  'apple',
  'bitbucket',
  'facebook',
  'figma',
  'github',
  'gitlab',
  'google',
  'linkedin',
  'microsoft',
  'reddit',
  'slack',
  'twitch',
  'twitter',
] as const;

/** Values accepted by `GET /users?provider=`. */
export const USER_PROVIDER_FILTERS = [
  'local',
  'phone',
  'metamask',
  'username',
  ...OAUTH_PROVIDER_KEYS,
] as const;

const PROVIDER_TOKEN_SORT_FIELDS = new Set(
  OAUTH_PROVIDER_KEYS.map(provider => `${provider}.token`),
);

const SORT_FIELD = /^-?[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/;

/** E.164, checked only when a phone number changes. */
export const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

export const USER_ADMIN_FILTERS = [
  'isVerified',
  'hasTwoFA',
  'isAnonymousExclusive',
  'providerPhone',
] as const;

export const USER_ADMIN_SORT_FIELDS = [
  'email',
  'createdAt',
  'updatedAt',
  'active',
  'isVerified',
] as const;

export type UserAdminCapabilities = {
  version: 1;
  filters: string[];
  sort: string[];
  actions: string[];
};

/** Fields an admin patch is allowed to write. Anything else on the body is ignored. */
export type UserPatchInput = {
  email?: string;
  isVerified?: boolean;
  hasTwoFA?: boolean;
  phoneNumber?: string;
  twoFaMethod?: string;
};

export type UserPatchSource = {
  email?: string | null;
  isVerified?: boolean;
  hasTwoFA?: boolean;
  phoneNumber?: string | null;
  twoFaMethod?: string | null;
};

export type UserPatchResult = {
  update: Indexable;
  emailChanged: boolean;
};

const exists = { $exists: true, $ne: null };

function providerFilter(provider: string): Indexable {
  if (!(USER_PROVIDER_FILTERS as readonly string[]).includes(provider)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid provider');
  }
  if (provider === 'local') return { hashedPassword: exists };
  // Phone-login users have a number and no password. SMS 2FA accounts that also
  // have a local password do not match.
  if (provider === 'phone') {
    return { phoneNumber: exists, hashedPassword: { $exists: false } };
  }
  if (provider === 'username') return { username: exists };
  return { [provider]: exists };
}

/** The user query of the getUsers filters, except `realm`. */
export function userFilterQuery(params: Indexable): Indexable {
  const { isActive, isAnonymous, isVerified, hasTwoFA, provider, search, homeRealm } =
    params;
  const query: Indexable = {};
  if (!isNil(isActive)) query.active = isActive;
  if (!isNil(isAnonymous)) query.isAnonymous = isAnonymous ? true : { $ne: true };
  if (!isNil(isVerified)) query.isVerified = isVerified;
  if (!isNil(hasTwoFA)) query.hasTwoFA = hasTwoFA;
  if (!isNil(provider)) Object.assign(query, providerFilter(String(provider)));
  if (!isNil(search)) {
    if (String(search).match(/^[a-fA-F0-9]{24}$/)) {
      query._id = search;
    } else {
      const emailIdentifier = escapeStringRegexp(String(search));
      query.email = { $regex: `.*${emailIdentifier}.*`, $options: 'i' };
    }
  }
  if (!isNil(homeRealm)) {
    return withHomeScope(query, homeRealm === 'global' ? null : homeRealm);
  }
  return query;
}

/**
 * Rejects sorts that would order users by a secret (`hashedPassword`, an OAuth
 * token or the metamask nonce). Other fields, including custom ones, stay allowed.
 */
export function assertSortAllowed(sort: unknown): void {
  if (isNil(sort) || sort === '') return;
  if (typeof sort !== 'string' || !SORT_FIELD.test(sort)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid sort field');
  }
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  if (
    field === 'hashedPassword' ||
    field === 'metamask.nonce' ||
    PROVIDER_TOKEN_SORT_FIELDS.has(field)
  ) {
    throw new GrpcError(status.INVALID_ARGUMENT, `Cannot sort by ${field}`);
  }
}

function smsTwoFa(method: string | null | undefined, enabled: boolean): boolean {
  if (!enabled) return false;
  return method === 'sms' || method === 'phone' || method == null || method === '';
}

/**
 * The update document for `PATCH /users/:id`. `null` clears a field: both database
 * adapters store it, and readers treat null as unset. Email and phone checks that
 * need other users stay in the handler.
 */
export function buildUserPatch(
  user: UserPatchSource,
  params: UserPatchInput,
  options: { authenticatorSecret?: boolean } = {},
): UserPatchResult {
  const update: Indexable = {};
  let emailChanged = false;

  if (typeof params.email === 'string') {
    const email = params.email.trim().toLowerCase();
    const current =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : undefined;
    if (email !== current) {
      AuthUtils.assertValidEmail(email);
      update.email = email;
      emailChanged = true;
    }
  }

  if (!isNil(params.isVerified)) update.isVerified = params.isVerified;
  if (!isNil(params.hasTwoFA)) update.hasTwoFA = params.hasTwoFA;

  const setAuthenticator =
    params.hasTwoFA !== false && params.twoFaMethod === 'authenticator';
  if (setAuthenticator && !options.authenticatorSecret) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Authenticator 2FA requires an existing secret',
    );
  }

  let resultingMethod: string | null | undefined;
  if (params.hasTwoFA === false) {
    resultingMethod = null;
    update.twoFaMethod = null;
  } else if (setAuthenticator) {
    resultingMethod = 'authenticator';
    update.twoFaMethod = 'authenticator';
  } else if (params.hasTwoFA === true) {
    resultingMethod = user.twoFaMethod || 'sms';
    update.twoFaMethod = resultingMethod;
  } else {
    resultingMethod = user.twoFaMethod;
  }

  let resultingPhone: string | null | undefined =
    user.phoneNumber === '' ? null : user.phoneNumber;
  if (typeof params.phoneNumber === 'string') {
    if (params.phoneNumber === '') {
      resultingPhone = null;
      update.phoneNumber = null;
    } else if (params.phoneNumber !== user.phoneNumber) {
      if (!PHONE_E164.test(params.phoneNumber)) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Phone number must be in E.164 format',
        );
      }
      resultingPhone = params.phoneNumber;
      update.phoneNumber = params.phoneNumber;
    }
  }

  const resultingHasTwoFA = !isNil(params.hasTwoFA)
    ? params.hasTwoFA
    : Boolean(user.hasTwoFA);
  const noPhone = resultingPhone == null || resultingPhone === '';
  if (smsTwoFa(resultingMethod, resultingHasTwoFA) && noPhone) {
    if (params.phoneNumber === '') {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Cannot clear the phone number while SMS two-factor authentication is enabled',
      );
    }
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Can not enable 2fa without a phone number',
    );
  }

  return { update, emailChanged };
}

export function buildUserAdminCapabilities(input: {
  emailAvailable: boolean;
  teamsEnabled: boolean;
}): UserAdminCapabilities {
  const actions = ['setPassword'];
  if (input.emailAvailable) actions.push('sendPasswordReset');
  actions.push('resetTwoFa', 'clearPhone', 'bulkDeleteFull', 'bulkToggleFixed');
  if (input.teamsEnabled) actions.push('userTeams');
  return {
    version: 1,
    filters: [...USER_ADMIN_FILTERS],
    sort: [...USER_ADMIN_SORT_FIELDS],
    actions,
  };
}

export function groupUserTeamRelations(
  relations: { resource?: string; relation?: string }[],
): { teamId: string; roles: string[] }[] {
  const order: string[] = [];
  const roles = new Map<string, string[]>();
  for (const relation of relations) {
    const resource = relation.resource ?? '';
    if (!resource.startsWith('Team:')) continue;
    const teamId = resource.slice('Team:'.length);
    if (!teamId) continue;
    let list = roles.get(teamId);
    if (!list) {
      list = [];
      roles.set(teamId, list);
      order.push(teamId);
    }
    if (relation.relation && !list.includes(relation.relation)) {
      list.push(relation.relation);
    }
  }
  return order.map(teamId => ({ teamId, roles: roles.get(teamId) ?? [] }));
}

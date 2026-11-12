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
  // `hashedPassword: null` matches a missing or null value on both adapters, so this
  // is the exact complement of `local`.
  if (provider === 'phone') {
    return { phoneNumber: exists, hashedPassword: null };
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
  if (!isNil(isAnonymous)) {
    if (isAnonymous) {
      query.isAnonymous = true;
    } else {
      // `$ne: true` drops NULL rows on SQL, so spell out false, null and missing
      query.$and = [
        {
          $or: [
            { isAnonymous: false },
            { isAnonymous: null },
            { isAnonymous: { $exists: false } },
          ],
        },
      ];
    }
  }
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

function normalizedEmail(value: string | null | undefined): string | undefined {
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
}

function emailPatch(
  user: UserPatchSource,
  params: UserPatchInput,
): { email?: string; emailChanged: boolean } {
  const email = normalizedEmail(params.email);
  if (email === undefined || email === normalizedEmail(user.email)) {
    return { emailChanged: false };
  }
  AuthUtils.assertValidEmail(email);
  return { email, emailChanged: true };
}

/** Two-factor methods an admin may set. */
export const TWO_FA_METHODS = ['sms', 'authenticator'] as const;

/**
 * The method sent on a patch: `''` counts as not sent and the legacy `'phone'` is
 * `'sms'`, so a client echoing a stored value is not refused.
 */
function requestedTwoFaMethod(value: string | undefined): string | undefined {
  if (isNil(value) || value === '') return undefined;
  if (value === 'phone') return 'sms';
  if (!(TWO_FA_METHODS as readonly string[]).includes(value)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `twoFaMethod must be one of: ${TWO_FA_METHODS.join(', ')}`,
    );
  }
  return value;
}

/** null, '' and 'phone' are stored spellings of SMS 2FA. */
function canonicalTwoFaMethod(method: string | null | undefined): string {
  return method === 'authenticator' ? 'authenticator' : 'sms';
}

function twoFaMethodPatch(
  user: UserPatchSource,
  params: UserPatchInput,
  enabled: boolean,
  authenticatorSecret: boolean,
): { method: string | null | undefined; update: Indexable } {
  if (params.hasTwoFA === false) {
    // turning 2FA off discards whatever method was sent with it
    return { method: null, update: { twoFaMethod: null } };
  }
  const requested = requestedTwoFaMethod(params.twoFaMethod);
  if (!isNil(requested) && !enabled) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'twoFaMethod can only be set while two-factor authentication is enabled',
    );
  }
  if (requested === 'authenticator' && !authenticatorSecret) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Authenticator 2FA requires an existing secret',
    );
  }
  if (!isNil(requested)) {
    return { method: requested, update: { twoFaMethod: requested } };
  }
  if (params.hasTwoFA === true && !user.hasTwoFA) {
    // turning 2FA on: keep a stored method, default to SMS
    const method = user.twoFaMethod || 'sms';
    return { method, update: { twoFaMethod: method } };
  }
  return { method: user.twoFaMethod, update: {} };
}

function phonePatch(
  user: UserPatchSource,
  params: UserPatchInput,
): { phone: string | null | undefined; update: Indexable } {
  const stored = user.phoneNumber === '' ? null : user.phoneNumber;
  if (typeof params.phoneNumber !== 'string' || params.phoneNumber === stored) {
    return { phone: stored, update: {} };
  }
  if (params.phoneNumber === '') {
    return { phone: null, update: { phoneNumber: null } };
  }
  if (!PHONE_E164.test(params.phoneNumber)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Phone number must be in E.164 format');
  }
  return { phone: params.phoneNumber, update: { phoneNumber: params.phoneNumber } };
}

function assertSmsPhoneAvailable(
  method: string | null | undefined,
  enabled: boolean,
  phone: string | null | undefined,
  clearing: boolean,
): void {
  const missing = phone == null || phone === '';
  if (!smsTwoFa(method, enabled) || !missing) return;
  if (clearing) {
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
  const email = emailPatch(user, params);
  const enabled = !isNil(params.hasTwoFA) ? params.hasTwoFA : Boolean(user.hasTwoFA);
  const twoFa = twoFaMethodPatch(
    user,
    params,
    enabled,
    Boolean(options.authenticatorSecret),
  );
  const phone = phonePatch(user, params);
  // only a patch that changes 2FA or the phone is checked, so an unrelated edit (or a
  // client resending unchanged values) of an already inconsistent user goes through
  const changesTwoFa =
    enabled !== Boolean(user.hasTwoFA) ||
    (enabled &&
      canonicalTwoFaMethod(twoFa.method) !== canonicalTwoFaMethod(user.twoFaMethod)) ||
    Object.keys(phone.update).length > 0;
  if (changesTwoFa) {
    assertSmsPhoneAvailable(
      twoFa.method,
      enabled,
      phone.phone,
      params.phoneNumber === '',
    );
  }

  const update: Indexable = { ...twoFa.update, ...phone.update };
  if (email.emailChanged) update.email = email.email;
  if (!isNil(params.isVerified)) update.isVerified = params.isVerified;
  if (!isNil(params.hasTwoFA)) update.hasTwoFA = params.hasTwoFA;
  return { update, emailChanged: email.emailChanged };
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

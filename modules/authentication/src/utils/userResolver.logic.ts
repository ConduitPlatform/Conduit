import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { grpcCallbackError, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

/*
 * The user lookup behind the GetUser rpc, the local module-tools user resolver and the
 * jwt-mode authentication middleware: a read-through of the Redis user cache over the
 * User model. Dependencies are injected so the logic needs neither.
 */

/** Fields that never leave the module even if a read returned them. */
export const ALWAYS_HIDDEN_USER_FIELDS = ['hashedPassword'];

/** Credential-like keys inside a provider sub-document (oauth tokens, secrets, nonces). */
const CREDENTIAL_KEY = /token|secret|password|nonce/i;

/** Largest user document the GetUser rpc will serialize. */
export const MAX_USER_JSON_BYTES = 1024 * 1024;

/**
 * What never leaves the module: the top-level fields declared `select: false` (plus
 * hashedPassword) and, as dotted paths, every credential-like key (`token`,
 * `tokenExpires`, `refreshToken`, `nonce`...) of the nested provider sub-documents
 * (google, github, metamask...), found from the schema.
 */
export function hiddenUserFields(
  fields: Record<string, unknown> | undefined | null,
): string[] {
  const hidden = new Set(ALWAYS_HIDDEN_USER_FIELDS);
  for (const [name, definition] of Object.entries(fields ?? {})) {
    if (!definition || typeof definition !== 'object') continue;
    const def = definition as Record<string, unknown>;
    if (def.select === false) {
      hidden.add(name);
      continue;
    }
    // a nested group (no `type` of its own) holds the provider sub-document's keys
    if (!('type' in def)) {
      for (const key of Object.keys(def)) {
        if (CREDENTIAL_KEY.test(key)) hidden.add(`${name}.${key}`);
      }
    }
  }
  return Array.from(hidden);
}

/** A copy of the user without the hidden fields (dotted paths reach nested ones). */
export function sanitizeUser(user: Indexable, hidden: string[]): Indexable {
  const copy: Indexable = { ...user };
  for (const field of hidden) {
    const [head, ...rest] = field.split('.');
    if (rest.length === 0) {
      delete copy[head];
      continue;
    }
    const nested = copy[head];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const clone = { ...nested };
      delete clone[rest.join('.')];
      copy[head] = clone;
    }
  }
  return copy;
}

export interface UserResolverDeps {
  findUser: (id: string) => Promise<Indexable | null | undefined>;
  cache?: () =>
    | {
        get(id: string): Promise<Indexable | null>;
        set(id: string, user: Indexable): Promise<void>;
      }
    | undefined;
  hiddenFields: () => string[];
}

/**
 * Resolves a user by id: cache hit, else the database (NOT_FOUND when missing), then the
 * cache is filled without waiting for it. Cached documents are re-sanitized, so an entry
 * written by anyone else can not leak a hidden field.
 */
export function createUserResolver(deps: UserResolverDeps) {
  return async (userId: string): Promise<Indexable> => {
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new ModuleError(errors.USER_ID_INVALID);
    }
    let cache: ReturnType<NonNullable<UserResolverDeps['cache']>>;
    try {
      cache = deps.cache?.();
    } catch {
      cache = undefined;
    }
    const cached = await cache?.get(userId).catch(() => null);
    if (cached) return sanitizeUser(cached, deps.hiddenFields());
    const found = await deps.findUser(userId);
    if (!found) throw new ModuleError(errors.USER_NOT_FOUND);
    const user = sanitizeUser(found, deps.hiddenFields());
    void cache?.set(userId, user).catch(() => undefined);
    return user;
  };
}

type GetUserCallback = (
  error: { code: number; message: string } | null,
  response?: { user: string },
) => void;

/**
 * The GetUser rpc handler: the user as JSON (hidden fields removed), NOT_FOUND for an
 * unknown id, INVALID_ARGUMENT for a missing one.
 */
export function createGetUserHandler(resolve: (userId: string) => Promise<Indexable>) {
  return async (call: { request: { userId: string } }, callback: GetUserCallback) => {
    try {
      const user = await resolve(call.request.userId);
      const json = JSON.stringify(user);
      if (Buffer.byteLength(json) > MAX_USER_JSON_BYTES) {
        ConduitGrpcSdk.Logger.error(
          `getUser: user ${call.request.userId} is larger than ${MAX_USER_JSON_BYTES} bytes, not serialized`,
        );
        return callback(grpcCallbackError(errors.USER_DOCUMENT_TOO_LARGE));
      }
      return callback(null, { user: json });
    } catch (e) {
      return callback(grpcCallbackError(e, errors.AUTH_OPERATION_FAILED));
    }
  };
}

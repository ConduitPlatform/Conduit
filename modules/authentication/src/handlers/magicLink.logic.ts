import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';

export function magicLinkExpired(
  expiresAt: Date | string | null | undefined,
  now: number,
): boolean {
  if (expiresAt == null) return true;
  const time = new Date(expiresAt).getTime();
  return Number.isNaN(time) || time <= now;
}

export const MAGIC_LINK_MAX_TTL_MS = 24 * 60 * 60 * 1000;

export function magicLinkExpiryError(value: unknown): string | null {
  if (value === undefined) return null;
  const valid =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAGIC_LINK_MAX_TTL_MS;
  if (valid) return null;
  return `magic_link.expiry_period must be a whole number of milliseconds from 1 to ${MAGIC_LINK_MAX_TTL_MS}`;
}

/** Expired magic-link tokens, and those issued before tokens carried an expiry. */
export function expiredMagicLinksQuery(now: Date) {
  return {
    tokenType: TokenType.MAGIC_LINK,
    $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
  };
}

export async function issueMagicLinkToken<
  T extends { _id: string; createdAt: Date },
>(args: {
  userId: string;
  token: string;
  data: any;
  ttlMs: number;
  now?: number;
  create: (doc: {
    tokenType: string;
    user: string;
    token: string;
    data: any;
    expiresAt: Date;
  }) => Promise<T>;
  deliver: (token: T) => Promise<unknown>;
  deleteMany: (query: {
    user: string;
    tokenType: string;
    _id: { $ne: string };
    createdAt: { $lt: Date };
  }) => Promise<unknown>;
}): Promise<T> {
  const created = await args.create({
    tokenType: TokenType.MAGIC_LINK,
    user: args.userId,
    token: args.token,
    data: args.data,
    expiresAt: new Date((args.now ?? Date.now()) + args.ttlMs),
  });
  await args.deliver(created);
  // only older tokens: two concurrent requests must not delete each other's link
  await args.deleteMany({
    user: args.userId,
    tokenType: TokenType.MAGIC_LINK,
    _id: { $ne: created._id },
    createdAt: { $lt: created.createdAt },
  });
  return created;
}

export async function redeemMagicLink<
  TToken extends {
    _id: string;
    user?: unknown;
    expiresAt?: Date | string | null;
    data?: any;
  },
  TUser extends { _id: string },
  TRealm,
  TSession,
>(args: {
  magicToken: string;
  now?: number;
  findToken: (token: string) => Promise<TToken | null>;
  deleteOne: (query: {
    _id: string;
    user: string;
    tokenType: string;
  }) => Promise<{ deletedCount?: number } | null | undefined>;
  loadUser: (token: TToken) => Promise<TUser | null>;
  resolveRealm: (token: TToken, user: TUser) => Promise<TRealm>;
  admit: (user: TUser, realm: TRealm) => Promise<boolean>;
  issueSession: (token: TToken, user: TUser, realm: TRealm) => Promise<TSession>;
}): Promise<TSession> {
  const now = args.now ?? Date.now();
  const token = await args.findToken(args.magicToken);
  if (token == null || magicLinkExpired(token.expiresAt, now)) {
    throw new GrpcError(status.NOT_FOUND, 'Magic link token does not exist');
  }
  const user = await args.loadUser(token);
  if (user == null) throw new GrpcError(status.NOT_FOUND, 'User not found');
  const realm = await args.resolveRealm(token, user);
  if (!(await args.admit(user, realm))) {
    throw new GrpcError(status.NOT_FOUND, 'User not found');
  }
  const consumed = await args.deleteOne({
    _id: token._id,
    user: user._id,
    tokenType: TokenType.MAGIC_LINK,
  });
  if (consumed?.deletedCount !== 1) {
    throw new GrpcError(status.NOT_FOUND, 'Magic link token does not exist');
  }
  return args.issueSession(token, user, realm);
}

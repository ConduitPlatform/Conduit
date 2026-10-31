import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';

/*
 * Issue and redeem for a magic link. Database calls are injected so the sequence can be
 * tested without Mongo. POST /magic-link/:magicToken and GET /hook/magic-link/:verificationToken
 * both redeem through redeemMagicLink, which deletes the token before issueSession.
 */

export function magicLinkExpiresAt(now: number, ttlMs: number): Date {
  return new Date(now + ttlMs);
}

/** Missing or past expiresAt is expired. The Mongo TTL index removes the document at that time. */
export function magicLinkExpired(
  expiresAt: Date | string | null | undefined,
  now: number,
): boolean {
  if (expiresAt == null) return true;
  const time = new Date(expiresAt).getTime();
  return Number.isNaN(time) || time <= now;
}

export async function issueMagicLinkToken<T>(args: {
  userId: string;
  token: string;
  data: any;
  ttlMs: number;
  now?: number;
  deleteMany: (query: { user: string; tokenType: string }) => Promise<unknown>;
  create: (doc: {
    tokenType: string;
    user: string;
    token: string;
    data: any;
    expiresAt: Date;
  }) => Promise<T>;
}): Promise<T> {
  await args.deleteMany({ user: args.userId, tokenType: TokenType.MAGIC_LINK });
  return args.create({
    tokenType: TokenType.MAGIC_LINK,
    user: args.userId,
    token: args.token,
    data: args.data,
    expiresAt: magicLinkExpiresAt(args.now ?? Date.now(), args.ttlMs),
  });
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

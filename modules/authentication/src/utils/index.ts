import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  ConduitGrpcSdk,
  Cookies,
  DatabaseOperations,
  Headers,
  Indexable,
  SMS,
} from '@conduitplatform/grpc-sdk';
import { Team, Token, User } from '../models/index.js';
import { Redis, Cluster } from 'ioredis';
import { isEmpty, isNil } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import escapeStringRegexp from 'escape-string-regexp';
import { FetchMembersParams } from '../interfaces/index.js';
import { authErrors, ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { assertEmailAllowed } from './emailRestrictions.js';
import { getConfiguredSdk } from './sessionServices.js';

export namespace AuthUtils {
  export function randomToken(size = 64) {
    return crypto.randomBytes(size).toString('base64');
  }

  let redisClient: Redis | Cluster;
  const LOGGED_IN_USERS_KEY = 'logged_in_users';

  export function initMetricsRedis(grpcSdk: ConduitGrpcSdk) {
    redisClient = grpcSdk.redisManager.getClient({
      keyPrefix: 'auth_metrics_',
    });
  }

  export async function addLoggedInUser(userId: string, tokenExpiresOn: Date | string) {
    const expiresOn =
      tokenExpiresOn instanceof Date ? tokenExpiresOn : new Date(tokenExpiresOn);

    await redisClient.zadd(
      LOGGED_IN_USERS_KEY,
      'GT',
      expiresOn.getTime().toString(),
      userId,
    );
  }

  export async function removeLoggedInUser(userId: string) {
    await redisClient.zrem(LOGGED_IN_USERS_KEY, userId);
  }

  export async function getLoggedInUsersCount(): Promise<number> {
    return redisClient.zcount(LOGGED_IN_USERS_KEY, Date.now().toString(), '+inf');
  }

  export async function cleanupExpiredUsers() {
    await redisClient.zremrangebyscore(
      LOGGED_IN_USERS_KEY,
      '-inf',
      Date.now().toString(),
    );
  }

  export async function reconcileLoggedInUsersMetric() {
    const count = await getLoggedInUsersCount();
    ConduitGrpcSdk.Metrics?.set('logged_in_users_total', count);
  }

  export function getToken(
    headers: Headers,
    cookies: Cookies,
    reqType: 'access' | 'refresh',
  ) {
    const tokenHeader = (headers['Authorization'] || headers['authorization']) as string; // formatted token
    const tokenCookie = cookies[`${reqType}Token`] as string; // token
    if (isNil(tokenHeader) && isNil(tokenCookie)) {
      throw new ModuleError(
        reqType === 'access'
          ? authErrors.AUTH_TOKEN_MISSING
          : {
              ...authErrors.AUTH_TOKEN_MISSING,
              message: "No 'Authorization' header or 'refreshToken' cookie present",
            },
      );
    }
    let headerArgs: string[] = [];
    if (tokenHeader) {
      headerArgs = tokenHeader.split(' ');
      if (headerArgs.length !== 2) {
        throw new ModuleError(
          authErrors.AUTH_HEADER_MALFORMED,
          'Authorization header must have exactly two parts',
        );
      }
      if (headerArgs[0] !== 'Bearer') {
        throw new ModuleError(
          authErrors.AUTH_HEADER_MALFORMED,
          "The 'Authorization' header must be prefixed by 'Bearer '",
        );
      }
    }
    return headerArgs[1] || tokenCookie;
  }

  export async function createToken(
    dbUserId: string,
    data: Indexable,
    tokenType: string,
    db?: DatabaseOperations,
  ) {
    // the old tokens are replaced by the new one, or kept when it cannot be created
    const replace = async (ops: DatabaseOperations) => {
      await Token.getInstance().deleteMany(
        {
          user: dbUserId,
          tokenType: tokenType,
        },
        { transaction: ops },
      );
      return Token.getInstance().create(
        {
          user: dbUserId,
          tokenType: tokenType,
          token: uuid(),
          data: data,
        },
        { transaction: ops },
      );
    };
    return db
      ? replace(db)
      : getConfiguredSdk().database!.withOptionalTransaction(replace);
  }

  export function verify(token: string, secret: string): string | object | null {
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (error) {
      return null;
    }
  }

  /** Whether a token fails verification only because it expired (its signature is valid). */
  export function isExpired(token: string, secret: string): boolean {
    try {
      jwt.verify(token, secret, { algorithms: ['HS256'] });
      return false;
    } catch (error) {
      return (error as Error)?.name === 'TokenExpiredError';
    }
  }

  export async function hashPassword(password: string, hashRounds = 10) {
    return bcrypt.hash(password, hashRounds);
  }

  export async function checkPassword(password: string, hashed: string) {
    return bcrypt.compare(password, hashed);
  }

  export async function verifyCode(
    grpcSdk: ConduitGrpcSdk,
    token: Token,
    code: string,
  ): Promise<boolean> {
    if (!grpcSdk.sms) {
      throw new ModuleError(errors.PHONE_PROVIDER_UNAVAILABLE);
    }
    const verified = await grpcSdk.sms.verify(token.data.verification, code);
    if (!verified.verified) {
      return false;
    }
    await Token.getInstance()
      .deleteMany({
        data: {
          phone: token.data.phone,
        },
        tokenType: token.tokenType,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    return true;
  }

  export async function sendVerificationCode(sms: SMS, to: string) {
    const verificationSid = await sms.sendVerificationCode(to);
    return verificationSid.verificationSid || '';
  }

  export function invalidEmailAddress(email: string) {
    return !email
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      );
  }

  export function assertValidEmail(email: string): void {
    if (invalidEmailAddress(email)) {
      throw new ModuleError(errors.USER_EMAIL_INVALID);
    }
    assertEmailAllowed(email);
  }

  export function checkResendThreshold(token: Token, notBefore?: number) {
    const threshold =
      notBefore ||
      ConfigController.getInstance().config.local.verification.resend_threshold;
    const diffInMilliSec = Math.abs(new Date(token.createdAt).getTime() - Date.now());
    if (diffInMilliSec < threshold) {
      const remainTimeInSec = Math.ceil((threshold - diffInMilliSec) / 1000);
      throw new ModuleError({
        ...errors.VERIFICATION_RESEND_THROTTLED,
        message: `Verification not sent. You have to wait ${remainTimeInSec} seconds to try again`,
      });
    } else {
      return true;
    }
  }

  export async function fetchMembers(params: FetchMembersParams) {
    const { relations, search, sort, populate } = params;
    const skip = params.skip ?? 0;
    const limit = params.limit ?? 25;
    const query: Indexable = {
      _id: { $in: relations.relations.map(r => r.subject.split(':')[1]) },
    };
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        const included = relations.relations
          .map(r => r.subject.split(':')[1])
          .includes(search);
        if (included) {
          query['_id'] = search;
        } else {
          return { members: [], count: relations.relations.length };
        }
      } else {
        const searchString = escapeStringRegexp(search);
        query['email'] = { $regex: `.*${searchString}.*`, $options: 'i' };
      }
    }

    const members: (User & { role?: string })[] = await User.getInstance().findMany(
      query,
      { skip, limit, sort, populate },
    );
    const count = await User.getInstance().countDocuments(query);
    members.forEach(member => {
      // add role from relation to each member
      // find relation with member id
      const relation = relations.relations.find(
        r => r.subject.split(':')[1] === member._id,
      );
      if (relation) {
        member.role = relation.relation;
      }
    });
    return { members, count };
  }

  export async function fetchUserTeams(params: FetchMembersParams) {
    const { relations, search, sort, populate } = params;
    const query: Indexable = {
      _id: { $in: relations.relations.map(r => r.resource.split(':')[1]) },
    };
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        const included = relations.relations
          .map(r => r.subject.split(':')[1])
          .includes(search);
        if (included) {
          query['_id'] = search;
        } else {
          return { teams: [], count: relations.count };
        }
      } else {
        const searchString = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${searchString}.*`, $options: 'i' };
      }
    }

    const count = relations.count;
    const teams = await Team.getInstance().findMany(query, { sort, populate });
    return { teams, count };
  }

  export async function validateMembers(members: string[]): Promise<void> {
    if (!members || members.length === 0) {
      throw new ModuleError(errors.USER_IDS_REQUIRED);
    }
    const existingUsers = await User.getInstance().findMany({
      _id: { $in: members },
    });
    if (existingUsers.length !== members.length) {
      throw new ModuleError(errors.USER_IDS_INVALID);
    }
  }

  export function validateRedirectUri(redirectUri?: string) {
    if (!redirectUri || isEmpty(redirectUri)) return undefined;
    type RedirectUris = { allowAny: boolean; whitelistedUris: string[] };
    const { allowAny, whitelistedUris } = ConfigController.getInstance().config
      .redirectUris as RedirectUris;
    if (!allowAny && !whitelistedUris.includes(redirectUri)) {
      throw new ModuleError(errors.REDIRECT_URI_NOT_ALLOWED, redirectUri);
    }
    return redirectUri;
  }

  export function generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  export function checkUserData(userData: Indexable) {
    const userKeys = Object.keys(User.getInstance().fields);
    const userDataKeys = Object.keys(userData);
    const overwrite = userDataKeys.some(key => userKeys.includes(key));
    if (overwrite) {
      throw new ModuleError(errors.USER_DATA_INVALID);
    }
  }

  export function validateAndNormalizeIdentifier(
    email?: string,
    username?: string,
  ): { [key: string]: string } {
    if (!!email === !!username) {
      throw new ModuleError(errors.USER_IDENTIFIER_INVALID);
    }

    if (email) {
      assertValidEmail(email);
    }

    const key = email ? 'email' : 'username';
    const value = (email || username)!.toLowerCase();

    return { [key]: value };
  }
}

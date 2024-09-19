import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  ConduitGrpcSdk,
  Cookies,
  GrpcError,
  Headers,
  Indexable,
  SMS,
} from '@conduitplatform/grpc-sdk';
import { Team, Token, User } from '../models/index.js';
import { isEmpty, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { v4 as uuid } from 'uuid';
import escapeStringRegexp from 'escape-string-regexp';
import { FetchMembersParams } from '../interfaces/index.js';
import { ConfigController } from '@conduitplatform/module-tools';

export namespace AuthUtils {
  export function randomToken(size = 64) {
    return crypto.randomBytes(size).toString('base64');
  }

  export function getToken(
    headers: Headers,
    cookies: Cookies,
    reqType: 'access' | 'refresh',
  ) {
    const tokenHeader = (headers['Authorization'] || headers['authorization']) as string; // formatted token
    const tokenCookie = cookies[`${reqType}Token`] as string; // token
    if (isNil(tokenHeader) && isNil(tokenCookie)) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        `No 'Authorization' header or '${reqType}Token' cookie present`,
      );
    }
    let headerArgs: string[] = [];
    if (tokenHeader) {
      headerArgs = tokenHeader.split(' ');
      if (headerArgs.length !== 2) {
        throw new GrpcError(status.UNAUTHENTICATED, "'Authorization' header malformed");
      }
      if (headerArgs[0] !== 'Bearer') {
        throw new GrpcError(
          status.UNAUTHENTICATED,
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
  ) {
    await Token.getInstance()
      .deleteMany({
        user: dbUserId,
        tokenType: tokenType,
      })
      .catch(e => {
        throw e;
      });
    return Token.getInstance().create({
      user: dbUserId,
      tokenType: tokenType,
      token: uuid(),
      data: data,
    });
  }

  export function verify(token: string, secret: string): string | object | null {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
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
    const verified = await grpcSdk.comms!.sms!.verify(token.data.verification, code);
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

  export function checkResendThreshold(token: Token, notBefore: number = 600000) {
    const diffInMilliSec = Math.abs(new Date(token.createdAt).getTime() - Date.now());
    if (diffInMilliSec < notBefore) {
      const remainTime = Math.ceil((notBefore - diffInMilliSec) / notBefore);
      throw new GrpcError(
        status.RESOURCE_EXHAUSTED,
        'Verification code not sent. You have to wait ' +
          remainTime +
          ' minutes to try again',
      );
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
      undefined,
      skip,
      limit,
      sort,
      populate,
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
    const teams = await Team.getInstance().findMany(
      query,
      undefined,
      undefined,
      undefined,
      sort,
      populate,
    );
    return { teams, count };
  }

  export async function validateMembers(members: string[]): Promise<void> {
    if (!members || members.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'members is required and must be a non-empty array',
      );
    }
    const existingUsers = await User.getInstance().findMany({
      _id: { $in: members },
    });
    if (existingUsers.length !== members.length) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'members array contains invalid user ids',
      );
    }
  }

  export function validateRedirectUri(redirectUri?: string) {
    if (!redirectUri || isEmpty(redirectUri)) return undefined;
    type RedirectUris = { allowAny: boolean; whitelistedUris: string[] };
    const { allowAny, whitelistedUris } = ConfigController.getInstance().config
      .redirectUris as RedirectUris;
    if (!allowAny && !whitelistedUris.includes(redirectUri)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `Invalid redirectUri provided! Check the redirectUris section in Authentication's config.`,
      );
    }
    return redirectUri;
  }

  export function generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}

import * as twoFactor from '@conduitplatform/node-2fa';
import ConduitGrpcSdk, { ConfigController, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AccessToken, RefreshToken, Token, TwoFactorSecret, User } from './models';
import { isNil } from 'lodash';
import { AuthUtils } from './utils/auth';
import { ISignTokenOptions } from './interfaces/ISignTokenOptions';
import moment from 'moment';
import { TokenType } from './constants/TokenType';

export namespace TwoFactorAuth {
  export function generateSecret(options?: { name: string; account: string }) {
    return twoFactor.generateSecret(options);
  }

  export function generateToken(secret: string) {
    return twoFactor.generateToken(secret);
  }

  export function verifyToken(secret: string, token?: string, window?: number) {
    return twoFactor.verifyToken(secret, token, window);
  }

  export async function verifyCode(
    grpcSdk: ConduitGrpcSdk,
    clientId: string,
    user: User,
    token: string,
    code: string,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    const qrVerificationToken = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.QR_TWO_FA_VERIFICATION_TOKEN,
      token: token,
    });
    if (isNil(qrVerificationToken))
      throw new GrpcError(status.UNAUTHENTICATED, 'QR verification token not found');
    await Token.getInstance()
      .deleteMany({ user: user._id, token: token })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    const secret = await TwoFactorSecret.getInstance().findOne({
      userId: user._id,
    });
    if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

    const verification = verifyToken(secret.secret, code);
    if (isNil(verification)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
    }
    await Promise.all(
      AuthUtils.deleteUserTokens(grpcSdk, {
        userId: user._id,
        clientId,
      }),
    );
    const config = ConfigController.getInstance().config;
    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };
    const accessToken: AccessToken = await AccessToken.getInstance().create({
      userId: user._id,
      clientId,
      token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
      expiresOn: moment()
        .add(config.tokenInvalidationPeriod as number, 'milliseconds')
        .toDate(),
    });
    const refreshToken: RefreshToken = await RefreshToken.getInstance().create({
      userId: user._id,
      clientId,
      token: AuthUtils.randomToken(),
      expiresOn: moment()
        .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
        .toDate(),
    });
    return {
      userId: user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    };
  }
}

import ConduitGrpcSdk, {
  ConfigController,
  GrpcError,
  SMS,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { AccessToken, RefreshToken, Token, TwoFactorSecret, User } from '../models';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import * as node2fa from '@conduitplatform/node-2fa';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import moment from 'moment';
import { v4 as uuid } from 'uuid';

export class TwoFa {
  private smsModule: SMS;
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async enable2Fa(user: User, method: string, phoneNumber?: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    if (method === 'phone') {
      return this.enablePhone2Fa(user, phoneNumber!);
    } else if (method === 'qrcode') {
      return this.enableQr2Fa(user);
    } else {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Method not valid');
    }
  }

  private async enablePhone2Fa(user: User, phoneNumber: string): Promise<string> {
    const verificationSid = await AuthUtils.sendVerificationCode(
      this.smsModule,
      phoneNumber,
    );
    if (verificationSid === '') {
      throw new GrpcError(status.INTERNAL, 'Could not send verification code');
    }
    await AuthUtils.createToken(
      user._id,
      { data: phoneNumber },
      TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    ).catch(e => ConduitGrpcSdk.Logger.error(e));

    await User.getInstance().findByIdAndUpdate(user._id, {
      twoFaMethod: 'phone',
    });
    return 'Verification code sent';
  }

  private async enableQr2Fa(user: User): Promise<string> {
    const secret = node2fa.generateSecret({
      //to do: add logic for app name insertion
      name: 'Conduit',
      account: user.email,
    });
    await TwoFactorSecret.getInstance().deleteMany({
      userId: user._id,
    });
    await TwoFactorSecret.getInstance().create({
      userId: user._id,
      secret: secret.secret,
      uri: secret.uri,
      qr: secret.qr,
    });
    await User.getInstance().findByIdAndUpdate(user._id, {
      twoFaMethod: 'qrcode',
    });
    return secret.qr.toString();
  }

  async disable2Fa(user: User): Promise<string> {
    await User.getInstance().findByIdAndUpdate(user._id, {
      hasTwoFA: false,
    });
    this.grpcSdk.bus?.publish(
      'authentication:disableTwofa:user',
      JSON.stringify({ id: user._id }),
    );
    return '2FA disabled';
  }

  async authenticate(user: User): Promise<any> {
    if (user.twoFaMethod === 'phone') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }
      await Token.getInstance()
        .deleteMany({
          userId: user._id,
          type: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      await Token.getInstance().create({
        userId: user._id,
        type: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        token: verificationSid,
      });
      return {
        message: 'Verification code sent',
      };
    } else if (user.twoFaMethod === 'qrcode') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        userId: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');
      await Token.getInstance()
        .deleteMany({
          userId: user._id,
          type: TokenType.QR_TWO_FA_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      const qrVerificationToken = await Token.getInstance().create({
        userId: user._id,
        type: TokenType.QR_TWO_FA_VERIFICATION_TOKEN,
        token: uuid(),
      });
      return {
        message: 'OTP required',
        accessToken: qrVerificationToken.token,
      };
    }
  }

  async verifyAuthentication(
    user: User,
    code: string,
    token: string,
    clientId: string,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    if (user.twoFaMethod === 'phone') {
      return await AuthUtils.verifyCode(
        this.grpcSdk,
        clientId,
        user,
        TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        code,
      );
    } else if (user.twoFaMethod == 'qrcode') {
      if (!token) throw new GrpcError(status.UNAUTHENTICATED, 'No token provided');
      return await this.verifyQrCodeForLogin(clientId, user, token, code);
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
    }
  }

  async changePassword(user: User, newPassword: string): Promise<string> {
    await Token.getInstance()
      .deleteMany({
        userId: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    if (user.twoFaMethod === 'phone') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }
      await Token.getInstance().create({
        userId: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
        token: verificationSid,
        data: {
          password: newPassword,
        },
      });
      return 'Verification code sent';
    } else if (user.twoFaMethod == 'qrcode') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        userId: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');

      await Token.getInstance().create({
        userId: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
        token: uuid(),
        data: {
          password: newPassword,
        },
      });
      return 'OTP required';
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
    }
  }

  async verifyChangePassword(user: User, code: string): Promise<string> {
    const token: Token | null = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Change password token does not exist');
    }
    await this.check2FaCode(user, code, token);
    await Token.getInstance()
      .deleteMany({ userId: user._id, type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    await User.getInstance().findByIdAndUpdate(user._id, {
      hashedPassword: token.data.password,
    });
    return 'Password changed successfully';
  }

  async check2FaCode(user: User, code: string, token: Token) {
    if (user.twoFaMethod === 'phone') {
      const verification = await this.smsModule.verify(token!.token, code);
      if (!verification.verified) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Provided code is invalid');
      }
    } else if (user.twoFaMethod === 'qrcode') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        userId: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');
      const verification = node2fa.verifyToken(secret.secret, code, 1);
      if (isNil(verification) || verification.delta !== 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Provided code is invalid');
      }
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
    }
  }

  // First time QR verification after enabling to set user attributes
  async verifyQrCode(user: User, code: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    const secret = await TwoFactorSecret.getInstance().findOne({
      userId: user._id,
    });
    if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');
    const verification = node2fa.verifyToken(secret.secret, code, 1);
    if (isNil(verification) || verification.delta !== 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Code is not correct');
    }
    await User.getInstance().findByIdAndUpdate(user._id, {
      hasTwoFA: true,
    });
    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({ id: user._id }),
    );
    return '2FA enabled';
  }

  // First time phone verification after enabling to set user attributes
  async verifyPhoneNumber(user: User, code: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    const verificationRecord: Token | null = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    });
    if (isNil(verificationRecord))
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'No verification record for this user',
      );
    const verified = await this.smsModule.verify(verificationRecord.token, code);
    if (!verified.verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'email and code do not match');
    }
    await Token.getInstance()
      .deleteMany({
        userId: user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(user._id, {
      phoneNumber: verificationRecord.data.phoneNumber,
      hasTwoFA: true,
    });
    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({
        id: user._id,
        phoneNumber: verificationRecord.data.phoneNumber,
      }),
    );
    return '2FA enabled';
  }

  private async verifyQrCodeForLogin(
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

    const verification = node2fa.verifyToken(secret.secret, code);
    if (isNil(verification) || verification.delta !== 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Code is not correct');
    }
    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
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

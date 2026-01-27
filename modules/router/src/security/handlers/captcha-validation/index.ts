import { NextFunction, Response } from 'express';
import { ConduitGrpcSdk, DatabaseProvider } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRequest } from '@conduitplatform/hermes';
import { verify as hcaptchaVerify } from 'hcaptcha';
import axios from 'axios';

export class CaptchaValidator {
  database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.database!;
  }

  async recaptchaVerify(secret: string, token: string) {
    const googleUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
    const response = await axios
      .post(
        googleUrl,
        {},
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          },
        },
      )
      .catch(() => {
        return {
          data: {
            success: false,
          },
        };
      });
    return response.data.success;
  }

  async turnstileVerify(secret: string, token: string) {
    const response = await axios
      .post(`https://challenges.cloudflare.com/turnstile/v0/siteverify`, {
        secret,
        response: token,
      })
      .catch(() => {
        return {
          data: {
            success: false,
          },
        };
      });
    return response.data.success;
  }

  async verifyCaptcha(secretKey: string, provider: string, token: string) {
    let success = false;
    if (provider === 'recaptcha') {
      success = await this.recaptchaVerify(secretKey, token);
    } else if (provider === 'hcaptcha') {
      const response = await hcaptchaVerify(secretKey, token);
      success = response.success;
    } else {
      success = await this.turnstileVerify(secretKey, token);
    }
    return success;
  }

  async middleware(req: ConduitRequest, res: Response, next: NextFunction) {
    const { enabled, provider, secretKey } =
      ConfigController.getInstance().config.captcha;
    if (!enabled) {
      req.conduit!.captcha = 'disabled';
      return next();
    }
    const captchaToken = req.body?.captchaToken;
    if (!captchaToken) {
      req.conduit!.captcha = 'missing';
      return next();
    }
    const success = await this.verifyCaptcha(secretKey, provider, captchaToken);
    if (!success) {
      req.conduit!.captcha = 'failed';
      return next();
    } else {
      req.conduit!.captcha = 'success';
      return next();
    }
  }
}

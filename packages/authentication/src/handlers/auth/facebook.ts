import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import * as request from 'request-promise';
import { OptionsWithUrl } from 'request-promise';
import { isNil } from 'lodash';
import moment = require('moment');
import { AuthService } from '../../services/auth';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';

export class FacebookHandlers {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.database = sdk.getDatabase();
  }

  async authenticate(req: Request, res: Response) {
    const { access_token } = req.body;
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    if (!config.facebook.active) {
      return res.status(403).json({ error: 'Facebook authentication is disabled' });
    }

    const facebookOptions: OptionsWithUrl = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      qs: {
        access_token,
        fields: 'id,email'
      },
      json: true
    };

    const facebookResponse = await request(facebookOptions);

    if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
      return res.status(401).json({ error: 'Authentication with facebook failed' });
    }

    const User = this.database.getSchema('User');
    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    let user = await User.findOne({ email: facebookResponse.email });

    if (!isNil(user)) {
      if (!user.active) return res.status(403).json({ error: 'Inactive user' });
      if (!config.facebook.accountLinking) {
        return res.status(401).json({ error: 'User with this email already exists' });
      }
      if (isNil(user.facebook)) {
        user.facebook = {
          id: facebookResponse.id
        };
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await User.findByIdAndUpdate(user);
      }
    } else {
      user = await User.create({
        email: facebookResponse.email,
        facebook: {
          id: facebookResponse.id
        },
        isVerified: true
      });
    }

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod
    };

    const accessToken = await AccessToken.create({
      userId: user._id,
      clientId: req.headers.clientid,
      token: this.authService.signToken({ id: user._id }, signTokenOptions),
      expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
    });

    const refreshToken = await RefreshToken.create({
      userId: user._id,
      clientId: req.headers.clientid,
      token: this.authService.randomToken(),
      expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
    });

    return res.json({ userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token });
  }
}

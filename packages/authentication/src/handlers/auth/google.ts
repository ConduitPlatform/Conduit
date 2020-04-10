import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import { isNil } from 'lodash';
import moment = require('moment');
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import { AuthService } from '../../services/auth';

export class GoogleHandlers {
  private readonly client: OAuth2Client;
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.client = new OAuth2Client();
    this.database = sdk.getDatabase();
  }

  async authenticate(req: Request, res: Response) {
    const { id_token, access_token, refresh_token, expires_in } = req.body;
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    if (!config.google.active) {
      res.status(403).json({ error: 'Google authentication is disabled' });
    }

    const ticket = await this.client.verifyIdToken({
      idToken: id_token,
      audience: config.google.clientId
    });

    const payload = ticket.getPayload();
    if (isNil(payload)) {
      return res.status(401).json({ error: 'Received invalid response from the Google API' });
    }
    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const User = this.database.getSchema('User');
    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    let user = await User.findOne({ email: payload.email });

    if (!isNil(user)) {
      if (!user.active) return res.status(403).json({ error: 'Inactive user' });
      if (!config.google.accountLinking) {
        return res.status(401).json({ error: 'User with this email already exists' });
      }
      if (isNil(user.google)) {
        user.google = {
          id: payload.sub,
          token: access_token,
          tokenExpires: moment().add(expires_in as number, 'milliseconds'),
          refreshToken: refresh_token
        };
        if (!user.isVerified) user.isVerified = true;
        user = await User.findByIdAndUpdate(user);
      }
    } else {
      user = await User.create({
        email: payload.email,
        google: {
          id: payload.sub,
          token: access_token,
          tokenExpires: moment().add(expires_in).format(),
          refreshToken: refresh_token
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
      expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate()
    });

    const refreshToken = await RefreshToken.create({
      userId: user._id,
      clientId: req.headers.clientid,
      token: this.authService.randomToken(),
      expiresOn: moment().add(config.refreshTokenInvalidationPeriod, 'milliseconds').toDate()
    });

    return res.json({ userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token });
  }
}

import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil } from 'lodash';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import { AuthService } from '../../services/auth';
import moment from 'moment';

export class CommonHandlers {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.database = sdk.getDatabase();
  }

  async renewAuth(req: Request, res: Response) {
    const clientId = req.headers.clientid;

    const refreshToken = req.body.refreshToken;
    if (isNil(refreshToken)) {
      return res.status(401).json({ error: 'Invalid parameters' });
    }

    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    const oldRefreshToken = await RefreshToken.findOne({ token: refreshToken, clientId });
    if (isNil(oldRefreshToken)) {
      return res.status(401).json({ error: 'Invalid parameters' });
    }

    const oldAccessToken = await AccessToken.findOne({ clientId });
    if (isNil(oldAccessToken)) {
      return res.status(401).json({ error: 'No access token found' });
    }

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod
    };

    const newAccessToken = await AccessToken.create({
      userId: oldRefreshToken.userId,
      clientId,
      token: this.authService.signToken({ id: oldRefreshToken.userId }, signTokenOptions),
      expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate()
    });

    const newRefreshToken = await RefreshToken.create({
      userId: oldRefreshToken.userId,
      clientId,
      token: this.authService.randomToken(),
      expiresOn: moment().add(config.refreshTokenInvalidationPeriod, 'milliseconds').toDate()
    });

    await oldAccessToken.remove();
    await oldRefreshToken.remove();

    return res.json({
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken.token
    });
  }

  async logOut(req: Request, res: Response) {
    const clientId = req.headers.clientid;

    const user = (req as any).user;

    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    await AccessToken.deleteOne({userId: user._id, clientId});
    await RefreshToken.deleteOne({userId: user._id, clientId});

    return res.json({message: 'Logged out'});
  }
}

import { Request, Response } from 'express';
import { ConduitSDK, IConduitDatabase, IConduitEmail } from '@conduit/sdk';
import { isNil } from 'lodash';
import { AuthService } from '../../services/auth';
import { TokenType } from '../../constants/TokenType';
import { v4 as uuid } from 'uuid';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import moment = require('moment');

export class LocalHandlers {
  private readonly database: IConduitDatabase;
  private readonly emailModule: IConduitEmail;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.database = sdk.getDatabase();
    this.emailModule = sdk.getEmail();
  }

  async register(req: Request, res: Response) {
    const { email, password } = req.body;
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    if (!config.local.active) return res.status(403).json({ error: 'Local authentication is disabled' });
    if (isNil(email) || isNil(password)) return res.status(403).json({ error: 'Email and password required' });

    const User = this.database.getSchema('User');
    const Token = this.database.getSchema('Token');

    let user = await User.findOne({ email });
    if (!isNil(user)) return res.status(403).json({ error: 'User already exists' });

    const hashedPassword = await this.authService.hashPassword(password);
    user = await User.create({
      email,
      hashedPassword
    });

    if (config.local.sendVerificationEmail) {
      const verificationTokenDoc = await Token.create({
        type: TokenType.VERIFICATION_TOKEN,
        userId: user._id,
        token: uuid()
      });

      const link = `${appConfig.get('hostUrl')}/hook/verify-email/${verificationTokenDoc.token}`;
      await this.emailModule.sendEmail('EmailVerification', {
        email: user.email,
        sender: 'conduit@gmail.com',
        variables: {
          applicationName: 'Conduit',
          link
        }
      });
    }

    return res.json({ message: 'Registration was successful' });
  }

  async authenticate(req: Request, res: Response) {
    const { email, password } = req.body;
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    const clientId = req.headers.clientid;

    if (!config.local.active) return res.status(403).json({ error: 'Local authentication is disabled' });
    if (isNil(email) || isNil(password)) return res.status(403).json({ error: 'Email and password required' });

    const User = this.database.getSchema('User');
    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    const user = await User.findOne({ email }, '+hashedPassword');
    if (isNil(user)) return res.status(401).json({ error: 'Invalid login credentials' });
    if (!user.active) return res.status(403).json({ error: 'Inactive user' });

    if (config.local.verificationRequired && !user.isVerified)
      return res.status(403).json({ error: 'You must verify your account to login' });

    const passwordsMatch = await this.authService.checkPassword(password, user.hashedPassword);
    if (!passwordsMatch) return res.status(401).json({ error: 'Invalid login credentials' });

    await AccessToken.deleteMany({ userId: user._id, clientId });
    await RefreshToken.deleteMany({ userId: user._id, clientId });

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod
    };

    const accessToken = await AccessToken.create({
      userId: user._id,
      clientId,
      token: this.authService.signToken({ id: user._id }, signTokenOptions),
      expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
    });

    const refreshToken = await RefreshToken.create({
      userId: user._id,
      clientId,
      token: this.authService.randomToken(),
      expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
    });

    return res.json({ userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token });
  }

  async forgotPassword(req: Request, res: Response) {
    const email = req.body.email;
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');

    if (isNil(email)) res.status(401).json({ error: 'Email field required' });

    const User = this.database.getSchema('User');
    const Token = this.database.getSchema('Token');

    const user = await User.findOne({ email });

    if (isNil(user) || (config.local.verificationRequired && !user.isVerified))
      return res.json({ message: 'Ok' });

    const oldToken = await Token.findOne({ type: TokenType.PASSWORD_RESET_TOKEN, userId: user._id });
    if (!isNil(oldToken)) await oldToken.remove();

    const passwordResetTokenDoc = await Token.create({
      type: TokenType.PASSWORD_RESET_TOKEN,
      userId: user._id,
      token: uuid()
    });

    const link = `${appConfig.get('hostUrl')}/authentication/reset-password/${passwordResetTokenDoc.token}`;
    await this.emailModule.sendEmail('ForgotPassword', {
      email: user.email,
      sender: 'conduit@gmail.com',
      variables: {
        applicationName: 'Conduit',
        link
      }
    });

    return res.json({ message: 'Ok' });
  }

  async resetPassword(req: Request, res: Response) {
    const passwordResetTokenParam = req.body.passwordResetToken;
    const newPassword = req.body.password;
    if (isNil(newPassword) || isNil(passwordResetTokenParam)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const User = this.database.getSchema('User');
    const Token = this.database.getSchema('Token');
    const AccessToken = this.database.getSchema('AccessToken');
    const RefreshToken = this.database.getSchema('RefreshToken');

    const passwordResetTokenDoc = await Token.findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      token: passwordResetTokenParam
    });
    if (isNil(passwordResetTokenDoc)) return res.status(401).json({ error: 'Invalid parameters' });

    const user = await User.findOne({ _id: passwordResetTokenDoc.userId }, '+hashedPassword');
    if (isNil(user)) return res.status(404).json({ error: 'User not found' });

    const passwordsMatch = await this.authService.checkPassword(newPassword, user.hashedPassword);
    if (passwordsMatch) return res.status(401).json({ error: 'Password can\'t be the same as the old one' });

    user.hashedPassword = await this.authService.hashPassword(newPassword);
    await user.save();
    await passwordResetTokenDoc.remove();
    await AccessToken.deleteMany({ userId: user._id });
    await RefreshToken.deleteMany({ userId: user._id });

    return res.json({ message: 'Password reset successful' });
  }

  async verifyEmail(req: Request, res: Response) {
    const verificationTokenParam = req.params.verificationToken;
    if (isNil(verificationTokenParam)) return res.status(401).json({ error: 'Invalid parameters' });

    const User = this.database.getSchema('User');
    const Token = this.database.getSchema('Token');

    const verificationTokenDoc = await Token.findOne({
      type: TokenType.VERIFICATION_TOKEN,
      token: verificationTokenParam
    });
    if (isNil(verificationTokenDoc)) return res.status(401).json({ error: 'Invalid parameters' });

    const user = await User.findOne({ _id: verificationTokenDoc.userId });
    if (isNil(user)) return res.status(404).json({ error: 'User not found' });

    user.isVerified = true;
    await user.save();
    await verificationTokenDoc.remove();

    return res.json({ message: 'Email verified' });
  }
}

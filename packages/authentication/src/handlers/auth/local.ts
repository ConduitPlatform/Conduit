import {Request, Response} from 'express';
import {
    ConduitError,
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSDK, ConduitString,
    IConduitDatabase,
    IConduitEmail,
    TYPE,
} from '@conduit/sdk';
import {isNil} from 'lodash';
import {AuthService} from '../../services/auth';
import {TokenType} from '../../constants/TokenType';
import {v4 as uuid} from 'uuid';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import moment = require('moment');

export class LocalHandlers {
    private readonly database: IConduitDatabase;
    private readonly emailModule: IConduitEmail;

    constructor(private readonly sdk: ConduitSDK, private readonly authService: AuthService) {
        this.database = sdk.getDatabase();
        this.emailModule = sdk.getEmail();
        this.registerRoutes();
    }

    async register(params: ConduitRouteParameters) {
        const {email, password} = params.params as any;
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        if (isNil(email) || isNil(password)) throw ConduitError.userInput('Email and password required');

        const User = this.database.getSchema('User');
        const Token = this.database.getSchema('Token');

        let user = await User.findOne({email});
        if (!isNil(user)) throw ConduitError.forbidden('User already exists');

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

        return 'Registration was successful';
    }

    async authenticate(params: ConduitRouteParameters) {
        const {email, password} = params.params as any;
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        if (isNil(params.context)) throw ConduitError.unauthorized('No headers provided');
        const clientId = params.context.clientId;

        if (!config.local.active) throw ConduitError.forbidden('Local authentication is disabled');
        if (isNil(email) || isNil(password)) throw ConduitError.userInput('Email and password required');

        const User = this.database.getSchema('User');
        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        const user = await User.findOne({email}, '+hashedPassword');
        if (isNil(user)) throw ConduitError.unauthorized('Invalid login credentials');
        if (!user.active) throw ConduitError.forbidden('Inactive user');

        const passwordsMatch = await this.authService.checkPassword(password, user.hashedPassword);
        if (!passwordsMatch) throw ConduitError.unauthorized('Invalid login credentials');

        if (config.local.verificationRequired && !user.isVerified)
            throw ConduitError.forbidden('You must verify your account to login');

        await AccessToken.deleteMany({userId: user._id, clientId});
        await RefreshToken.deleteMany({userId: user._id, clientId});

        const signTokenOptions: ISignTokenOptions = {
            secret: config.jwtSecret,
            expiresIn: config.tokenInvalidationPeriod
        };

        const accessToken = await AccessToken.create({
            userId: user._id,
            clientId,
            token: this.authService.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        });

        const refreshToken = await RefreshToken.create({
            userId: user._id,
            clientId,
            token: this.authService.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
        });

        return {userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token};
    }

    async forgotPassword(params: ConduitRouteParameters) {
        const email = (params.params as any).email;
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        if (isNil(email)) throw ConduitError.userInput('Email field required');

        const User = this.database.getSchema('User');
        const Token = this.database.getSchema('Token');

        const user = await User.findOne({email});

        if (isNil(user) || (config.local.verificationRequired && !user.isVerified))
            return 'Ok';

        const oldToken = await Token.findOne({type: TokenType.PASSWORD_RESET_TOKEN, userId: user._id});
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

        return 'Ok';
    }

    async resetPassword(params: ConduitRouteParameters) {
        const {passwordResetToken: passwordResetTokenParam, password: newPassword} = params.params as any;

        if (isNil(newPassword) || isNil(passwordResetTokenParam)) {
            throw ConduitError.userInput('Required fields are missing');
        }

        const User = this.database.getSchema('User');
        const Token = this.database.getSchema('Token');
        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        const passwordResetTokenDoc = await Token.findOne({
            type: TokenType.PASSWORD_RESET_TOKEN,
            token: passwordResetTokenParam
        });
        if (isNil(passwordResetTokenDoc)) throw ConduitError.forbidden('Invalid parameters');

        const user = await User.findOne({_id: passwordResetTokenDoc.userId}, '+hashedPassword');
        if (isNil(user)) throw ConduitError.notFound('User not found');

        const passwordsMatch = await this.authService.checkPassword(newPassword, user.hashedPassword);
        if (passwordsMatch) throw ConduitError.forbidden('Password can\'t be the same as the old one');

        user.hashedPassword = await this.authService.hashPassword(newPassword);
        await user.save();
        await passwordResetTokenDoc.remove();
        await AccessToken.deleteMany({userId: user._id});
        await RefreshToken.deleteMany({userId: user._id});

        return 'Password reset successful';
    }

    async verifyEmail(req: Request, res: Response) {
        const verificationTokenParam = req.params.verificationToken;
        if (isNil(verificationTokenParam)) return res.status(401).json({error: 'Invalid parameters'});

        const User = this.database.getSchema('User');
        const Token = this.database.getSchema('Token');

        const verificationTokenDoc = await Token.findOne({
            type: TokenType.VERIFICATION_TOKEN,
            token: verificationTokenParam
        });
        if (isNil(verificationTokenDoc)) return res.status(401).json({error: 'Invalid parameters'});

        const user = await User.findOne({_id: verificationTokenDoc.userId});
        if (isNil(user)) return res.status(404).json({error: 'User not found'});

        user.isVerified = true;
        await user.save();
        await verificationTokenDoc.remove();

        return res.json({message: 'Email verified'});
    }

    registerRoutes() {
        // Register endpoint
        this.sdk.getRouter().registerRoute(new ConduitRoute(
          {
              path: '/authentication/local/new',
              action: Actions.POST,
              bodyParams: {
                  email: TYPE.String,
                  password: TYPE.String
              }
          },
          new ConduitRouteReturnDefinition('RegisterResponse', 'String'), this.register.bind(this)));
        // Login Endpoint
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/local',
                action: Actions.POST,
                bodyParams: {
                    email: TYPE.String,
                    password: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('LoginResponse', {
                userId: ConduitString.Required,
                accessToken: ConduitString.Required,
                refreshToken: ConduitString.Required
            }), this.authenticate.bind(this)));
        // Forgot-password endpoint
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/forgot-password',
                action: Actions.POST,
                bodyParams: {
                    email: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'), this.forgotPassword.bind(this)));
        // Reset-password endpoint
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/reset-password',
                action: Actions.POST,
                bodyParams: {
                    passwordResetToken: TYPE.String,
                    password: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('ResetPasswordResponse', 'String'), this.resetPassword.bind(this)));
    }
}

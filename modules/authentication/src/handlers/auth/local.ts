import {isNil} from 'lodash';
import {AuthService} from '../../services/auth';
import {TokenType} from '../../constants/TokenType';
import {v4 as uuid} from 'uuid';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import moment = require('moment');
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import * as grpc from 'grpc';
import {ConduitError, ConduitRouteParameters} from "@conduit/grpc-sdk";

export class LocalHandlers {
    private database: any;
    private emailModule: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly authService: AuthService) {
        this.initDbAndEmail(grpcSdk);
    }

    private async initDbAndEmail(grpcSdk: ConduitGrpcSdk) {
        await grpcSdk.waitForExistence('database-provider');
        await grpcSdk.waitForExistence('email');
        this.database = grpcSdk.databaseProvider;
        this.emailModule = grpcSdk.emailProvider;
    }

    async register(call: any, callback: any) {
        const {email, password} = JSON.parse(call.request.params);
        let errorMessage = null;

        if (isNil(email) || isNil(password)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Email and password required'
        });

        let user = await this.database.findOne('User', {email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (!isNil(user)) return callback({code: grpc.status.ALREADY_EXISTS, message: 'User already exists'});

        user = await this.authService.hashPassword(password)
            .then((hashedPassword: string) => {
                return this.database.create('User', {email, hashedPassword});
            })
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (config.local.sendVerificationEmail) {
            this.database.create('Token', {
                type: TokenType.VERIFICATION_TOKEN,
                userId: user._id,
                token: uuid()
            })
                .then((verificationToken: any) => {
                    return {verificationToken, hostUrl: this.grpcSdk.config.get('hostUrl')};
                })
                .then((result: { hostUrl: Promise<any>, verificationToken: any }) => {
                    const link = `${result.hostUrl}/hook/verify-email/${result.verificationToken.token}`;
                    return this.emailModule.sendEmail('EmailVerification', {
                        email: user.email,
                        sender: 'conduit@gmail.com',
                        variables: {
                            applicationName: 'Conduit',
                            link
                        }
                    });
                })
                .catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        }

        return callback(null, {result: JSON.stringify({message: 'Registration was successful'})});
    }

    async authenticate(call: any, callback: any) {
        const {email, password} = JSON.parse(call.request.params);
        const context = JSON.parse(call.request.context);
        let errorMessage = null;

        if (isNil(context)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'No headers provided'});
        const clientId = context.clientId;

        if (isNil(email) || isNil(password)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Email and password required'
        });

        const user = await this.database.findOne('User', {email}, 'hashedPassword').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(user)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});
        if (!user.active) return callback({code: grpc.status.PERMISSION_DENIED, message: 'Inactive user'});

        const passwordsMatch = await this.authService.checkPassword(password, user.hashedPassword).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (!passwordsMatch) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (config.local.verificationRequired && !user.isVerified) {
            return callback({code: grpc.status.PERMISSION_DENIED, message: 'You must verify your account to login'});
        }

        const promise1 = this.database.deleteMany('AccessToken', {userId: user._id, clientId});
        const promise2 = this.database.deleteMany('RefreshToken', {userId: user._id, clientId});
        await Promise.all([promise1, promise2]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const signTokenOptions: ISignTokenOptions = {
            secret: config.jwtSecret,
            expiresIn: config.tokenInvalidationPeriod
        };

        const accessToken = await this.database.create('AccessToken', {
            userId: user._id,
            clientId,
            token: this.authService.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: user._id,
            clientId,
            token: this.authService.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {
            result: JSON.stringify({
                userId: user._id.toString(),
                accessToken: accessToken.token,
                refreshToken: refreshToken.token
            })
        });
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
        if (!isNil(oldToken)) await Token.deleteOne(oldToken);

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
        await User.findByIdAndUpdate(user);
        await Token.deleteOne(passwordResetTokenDoc);
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
        await User.findByIdAndUpdate(user);
        await Token.deleteOne(verificationTokenDoc);

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

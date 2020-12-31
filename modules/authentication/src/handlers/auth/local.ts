import {isEmpty, isNil} from 'lodash';
import {AuthUtils} from '../../utils/auth';
import {TokenType} from '../../constants/TokenType';
import {v4 as uuid} from 'uuid';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import moment = require('moment');
import ConduitGrpcSdk, {ConduitError} from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import * as templates from '../../templates';

export class LocalHandlers {
    private database: any;
    private emailModule: any;
    private sms: any;
    private initialized: boolean = false;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.validate()
            .then(r => {
                return this.initDbAndEmail();
            })
            .catch(err => {
                console.log("Local not active");
            })

    }

    async validate(): Promise<Boolean> {
        return this.grpcSdk.config.get('email')
            .then((emailConfig: any) => {
                if (!emailConfig.active) {
                    throw ConduitError.forbidden('Cannot use local authentication without email module being enabled');
                }
            })
            .then(() => {
                if (!this.initialized) {
                    return this.initDbAndEmail();
                }
            })
            .then(r => {
                return true;
            })
            .catch((err: Error) => {
                // De-initialize the provider if the config is now invalid
                this.initialized = false;
                throw err;
            });
    }

    private async initDbAndEmail() {
        await this.grpcSdk.waitForExistence('database-provider');
        await this.grpcSdk.waitForExistence('email');
        this.database = this.grpcSdk.databaseProvider;
        this.emailModule = this.grpcSdk.emailProvider;
        
        let errorMessage = null;
        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            console.error('Could not get authentication config sms 2fa will not be enabled');
            return;
        }
        if (config.twofa.enabled) {
            // maybe check if verify is enabled in sms module
            await this.grpcSdk.waitForExistence('sms');
            this.sms = this.grpcSdk.sms;
        } else {
            console.log('sms 2fa not active');
        }
        this.registerTemplates();
        this.initialized = true;
    }

    private registerTemplates() {
        this.grpcSdk.config.get('email')
            .then((emailConfig: any) => {
                const promises = Object.values(templates).map(template => {
                    return this.emailModule.registerTemplate(template);
                });
                return Promise.all(promises);
            })
            .then(r => {
                console.log("Email templates registered");
            })
            .catch(() => {
                console.error('Internal error while registering email templates')
            });
    }

    async register(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});
        const {email, password} = JSON.parse(call.request.params);
        let errorMessage = null;

        if (isNil(email) || isNil(password)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Email and password required'
        });

        let user = await this.database.findOne('User', {email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (!isNil(user)) return callback({code: grpc.status.ALREADY_EXISTS, message: 'User already exists'});

        user = await AuthUtils.hashPassword(password)
            .then((hashedPassword: string) => {
                return this.database.create('User', {email, hashedPassword});
            })
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        let serverConfig = await this.grpcSdk.config.getServerConfig().catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
        let url = serverConfig.url;

        if (config.local.sendVerificationEmail) {
            this.database.create('Token', {
                type: TokenType.VERIFICATION_TOKEN,
                userId: user._id,
                token: uuid()
            })
                .then((verificationToken: any) => {
                    return {verificationToken, hostUrl: url};
                })
                .then((result: { hostUrl: Promise<any>, verificationToken: any }) => {
                    const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
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
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});
        const {email, password} = JSON.parse(call.request.params);
        const context = JSON.parse(call.request.context);
        let errorMessage = null;

        if (isNil(context)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'No headers provided'});
        const clientId = context.clientId;

        if (isNil(email) || isNil(password)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Email and password required'
        });

        const user = await this.database.findOne('User', {email}, '+hashedPassword').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(user)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});
        if (!user.active) return callback({code: grpc.status.PERMISSION_DENIED, message: 'Inactive user'});

        const passwordsMatch = await AuthUtils.checkPassword(password, user.hashedPassword).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (!passwordsMatch) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (config.local.verificationRequired && !user.isVerified) {
            return callback({code: grpc.status.PERMISSION_DENIED, message: 'You must verify your account to login'});
        }

        if (user.hasTwoFA) {
            const verificationSid = await this.sendVerificationCode(user.phoneNumber);
            if (verificationSid === '') {
                return callback({code: grpc.status.INTERNAL, message: 'Could not send verification code'})
            }

            await this.database.deleteMany('VerificationRecord', {userId: user._id, clientId}).catch(console.error);

            await this.database.create('VerificationRecord', {
                userId: user._id,
                clientId,
                verificationSid
            }).catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

            return callback(null, {
                result: JSON.stringify({
                    message: 'Verification code sent'
                })
            });
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
            token: AuthUtils.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: user._id,
            clientId,
            token: AuthUtils.randomToken(),
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

    async forgotPassword(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});

        const {email} = JSON.parse(call.request.params);
        const config = await this.grpcSdk.config.get('authentication');
        let errorMessage = null;

        if (isNil(email)) return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Email field required'});

        const user = await this.database.findOne('User', {email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(user) || (config.local.verificationRequired && !user.isVerified))
            return callback(null, {result: JSON.stringify({message: 'Ok'})});

        this.database.findOne('Token', {type: TokenType.PASSWORD_RESET_TOKEN, userId: user._id})
            .then((oldToken: any) => {
                if (!isNil(oldToken)) return this.database.deleteOne('Token', oldToken);
            })
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const passwordResetTokenDoc = await this.database.create('Token', {
            type: TokenType.PASSWORD_RESET_TOKEN,
            userId: user._id,
            token: uuid()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        let appUrl = config.local.forgot_password_redirect_uri;
        const link = `${appUrl}?reset_token=${passwordResetTokenDoc.token}`;
        let mail = await this.emailModule.sendEmail('ForgotPassword', {
            email: user.email,
            sender: 'conduit@gmail.com',
            variables: {
                applicationName: 'Conduit',
                link
            }
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {result: JSON.stringify({message: 'Ok'})});
    }

    async resetPassword(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});

        const {passwordResetToken: passwordResetTokenParam, password: newPassword} = JSON.parse(call.request.params);

        if (isNil(newPassword) || isNil(passwordResetTokenParam)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Required fields are missing'});
        }

        let errorMessage = null;

        const passwordResetTokenDoc = await this.database.findOne('Token', {
            type: TokenType.PASSWORD_RESET_TOKEN,
            token: passwordResetTokenParam
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(passwordResetTokenDoc)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Invalid parameters'
        });

        const user = await this.database.findOne('User', {_id: passwordResetTokenDoc.userId}, '+hashedPassword').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(user)) return callback({code: grpc.status.NOT_FOUND, message: 'User not found'});

        const passwordsMatch = await AuthUtils.checkPassword(newPassword, user.hashedPassword).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (passwordsMatch) return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'Password can\'t be the same as the old one'
        });

        user.hashedPassword = await AuthUtils.hashPassword(newPassword).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const userPromise = this.database.findByIdAndUpdate('User', user._id, user);
        const tokenPromise = this.database.deleteOne('Token', passwordResetTokenDoc);
        const accessTokenPromise = this.database.deleteMany('AccessToken', {userId: user._id});
        const refreshTokenPromise = this.database.deleteMany('RefreshToken', {userId: user._id});

        await Promise.all([userPromise, tokenPromise, accessTokenPromise, refreshTokenPromise]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify({message: 'Password reset successful'})});
    }

    async verifyEmail(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});

        const verificationTokenParam = JSON.parse(call.request.params).verificationToken;
        if (isNil(verificationTokenParam)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Invalid parameters'
        });

        let errorMessage = null;
        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const verificationTokenDoc = await this.database.findOne('Token', {
            type: TokenType.VERIFICATION_TOKEN,
            token: verificationTokenParam
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(verificationTokenDoc)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Invalid parameters'
        });

        const user = await this.database.findOne('User', {_id: verificationTokenDoc.userId}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(user)) return callback({code: grpc.status.NOT_FOUND, message: 'User not found'});

        user.isVerified = true;
        const userPromise = this.database.findByIdAndUpdate('User', user._id, user);
        const tokenPromise = this.database.deleteOne('Token', verificationTokenDoc);

        await Promise.all([userPromise, tokenPromise]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if(config.local.verification_redirect_uri){
            return callback(null, {redirect: config.local.verification_redirect_uri});    
        }else{
            return callback(null, {result: JSON.stringify({message: 'Email verified'})});
        }      
    }

    private async sendVerificationCode(to: string) {
        const verificationSid = await this.sms.sendVerificationCode({to})
            .catch(console.error);
        return verificationSid || '';
    }

    async verify(call: any, callback: any) {
        const context = JSON.parse(call.request.context);
        if (isNil(context) || isEmpty(context)) return callback({
            code: grpc.status.UNAUTHENTICATED,
            message: 'No headers provided'
        });

        const clientId = context.clientId;

        const { email, code } = JSON.parse(call.request.params).params;
        if (isNil(email) || isNil(code)) return callback({
            code: grpc.status.INVALID_ARGUMENT, message: 'No email or 2fa code provided'
        });

        let errorMessage = null;
        const user = await this.database.findOne('User', {email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(user)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'User not found'});

        const verificationRecord = await this.database.findOne('VerificationRecord', {userId: user._id, clientId})
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(verificationRecord)) return callback({code: grpc.status.INVALID_ARGUMENT, message: 'No verification record for this user'});

        const verified = await this.sms.verify({verificationSid: verificationRecord.verificationSid, code})
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (!verified) {
            return callback({code: grpc.status.UNAUTHENTICATED, message: 'email and code do not match'});
        }

        await this.database.deleteMany('VerificationRecord', {userId: user._id, clientId}).catch(console.error);

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

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
            token: AuthUtils.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: user._id,
            clientId,
            token: AuthUtils.randomToken(),
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
}

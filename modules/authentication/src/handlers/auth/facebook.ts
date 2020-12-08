import request, {OptionsWithUrl} from 'request-promise';
import {isNil, isEmpty} from 'lodash';
import {AuthUtils} from '../../utils/auth';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import moment = require('moment');
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import {ConduitError} from '@quintessential-sft/conduit-grpc-sdk';

export class FacebookHandlers {
    private database: any;
    private initialized: boolean = false;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.validate()
            .then(r => {
                return this.initDbAndEmail();
            })
            .catch(err => {
                console.log("Facebook not active");
            })
    }

    async validate(): Promise<Boolean> {
        return this.grpcSdk.config.get('authentication')
            .then((authConfig: any) => {
                if (!authConfig.facebook.enabled) {
                    throw ConduitError.forbidden('Facebook auth is deactivated');
                }
                if (!authConfig.facebook || !authConfig.facebook.clientId) {
                    throw ConduitError.forbidden('Cannot enable facebook auth due to missing clientId');
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
        this.database = this.grpcSdk.databaseProvider;
        this.initialized = true;

    }

    async authenticate(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});

        const {access_token} = JSON.parse(call.request.params);

        let errorMessage = null;

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const context = JSON.parse(call.request.context);
        if (isNil(context) || isEmpty(context)) return callback({
            code: grpc.status.UNAUTHENTICATED,
            message: 'No headers provided'
        });


        const facebookOptions: OptionsWithUrl = {
            method: 'GET',
            url: 'https://graph.facebook.com/v5.0/me',
            qs: {
                access_token,
                fields: 'id,email'
            },
            json: true
        };

        const facebookResponse = await request(facebookOptions).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
            return callback({code: grpc.status.UNAUTHENTICATED, message: 'Authentication with facebook failed'});
        }

        let user = await this.database.findOne('User', {email: facebookResponse.email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (!isNil(user)) {
            if (!user.active) return callback({code: grpc.status.PERMISSION_DENIED, message: 'Inactive user'});
            if (!config.facebook.accountLinking) {
                return callback({code: grpc.status.PERMISSION_DENIED, message: 'User with this email already exists'});
            }
            if (isNil(user.facebook)) {
                user.facebook = {
                    id: facebookResponse.id
                };
                // TODO look into this again, as the email the user has registered will still not be verified
                if (!user.isVerified) user.isVerified = true;
                user = await this.database.findByIdAndUpdate('User', user).catch((e: any) => errorMessage = e.message);
                if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            }
        } else {
            user = await this.database.create('User', {
                email: facebookResponse.email,
                facebook: {
                    id: facebookResponse.id
                },
                isVerified: true
            }).catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        const signTokenOptions: ISignTokenOptions = {
            secret: config.jwtSecret,
            expiresIn: config.tokenInvalidationPeriod
        };

        const accessToken = await this.database.create('AccessToken', {
            userId: user._id,
            clientId: context.clientId,
            token: AuthUtils.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: user._id,
            clientId: context.clientId,
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

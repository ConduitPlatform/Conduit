import {auth, OAuth2Client} from 'google-auth-library';
import {isEmpty, isNil} from 'lodash';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import {AuthUtils} from '../../utils/auth';
import moment = require('moment');
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import grpc from "grpc";
import {ConduitError} from "@conduit/grpc-sdk";

export class GoogleHandlers {
    private readonly client: OAuth2Client;
    private database: any;
    private initialized: boolean = false;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.client = new OAuth2Client();
        this.validate()
            .then(() => {
                return this.initDbAndEmail();
            })
            .catch(err => {
                console.log("Google not active");
            })
    }

    async validate(): Promise<Boolean> {
        return this.grpcSdk.config.get('authentication')
            .then((authConfig: any) => {
                if(!authConfig.google.active){
                    throw ConduitError.forbidden('Google auth is deactivated');
                }
                if (!authConfig.google || !authConfig.google.clientId) {
                    throw ConduitError.forbidden('Cannot enable google auth due to missing clientId');
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
        const {id_token, access_token, expires_in} = JSON.parse(call.request.params);

        let errorMessage = null;

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const context = JSON.parse(call.request.context);
        if (isNil(context) || isEmpty(context)) return callback({
            code: grpc.status.UNAUTHENTICATED,
            message: 'No headers provided'
        });

        const ticket = await this.client.verifyIdToken({
            idToken: id_token,
            audience: config.google.clientId
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const payload = ticket.getPayload();
        if (isNil(payload)) {
            return callback({
                code: grpc.status.UNAUTHENTICATED,
                message: 'Received invalid response from the Google API'
            });
        }
        if (!payload.email_verified) {
            return callback({code: grpc.status.UNAUTHENTICATED, message: 'Unauthorized'});
        }

        let user = await this.database.findOne('User', {email: payload.email}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});


        if (!isNil(user)) {
            if (!user.active) return callback({code: grpc.status.PERMISSION_DENIED, message: 'Inactive user'});
            if (!config.google.accountLinking) {
                return callback({code: grpc.status.PERMISSION_DENIED, message: 'User with this email already exists'});
            }
            if (isNil(user.google)) {
                user.google = {
                    id: payload.sub,
                    token: access_token,
                    tokenExpires: moment().add(expires_in as number, 'milliseconds')
                };
                if (!user.isVerified) user.isVerified = true;
                user = await this.database.findByIdAndUpdate('User', user).catch((e: any) => errorMessage = e.message);
                if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            }
        } else {
            user = await this.database.create('User', {
                email: payload.email,
                google: {
                    id: payload.sub,
                    token: access_token,
                    tokenExpires: moment().add(expires_in).format()
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
            expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: user._id,
            clientId: context.clientId,
            token: AuthUtils.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod, 'milliseconds').toDate()
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

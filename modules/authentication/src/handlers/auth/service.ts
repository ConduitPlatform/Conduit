import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../../utils/auth';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import ConduitGrpcSdk, { ConduitError } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import moment from 'moment';

export class ServiceHandler {
    private database: any;
    private initialized: boolean = false;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.validate()
            .then((r: any) => {
                return this.initDb();
            })
            .catch((err: any) => {
                console.error("Service not active");
            })
    }

    async validate(): Promise<Boolean> {
        return this.grpcSdk.config.get('authentication')
            .then((authConfig: any) => {
                if(!authConfig.service.enabled){
                    throw ConduitError.forbidden('Service auth is deactivated');
                }
            })
            .then(() => {
                if (!this.initialized) {
                    return this.initDb();
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

    private async initDb() {
        await this.grpcSdk.waitForExistence('database-provider');
        this.database = this.grpcSdk.databaseProvider;
        this.initialized = true;
    }

    async authenticate(call: any, callback: any) {
        if (!this.initialized) return callback({code: grpc.status.NOT_FOUND, message: 'Requested resource not found'});
        const { serviceName, token } = JSON.parse(call.request.params).params;

        if (isNil(serviceName) || isNil(token)) return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Service name and password required'
        });

        let errorMessage = null;

        const context = JSON.parse(call.request.context);
        if (isNil(context) || isEmpty(context)) return callback({
            code: grpc.status.UNAUTHENTICATED,
            message: 'No headers provided'
        });

        const clientId = context.clientId;

        const serviceUser = await this.database.findOne('Service', {name: serviceName}, '+hashedToken').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(serviceUser)) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});
        if (!serviceUser.active) return callback({code: grpc.status.PERMISSION_DENIED, message: 'Inactive service user'});

        const tokensMatch = await AuthUtils.checkPassword(token, serviceUser.hashedToken).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (!tokensMatch) return callback({code: grpc.status.UNAUTHENTICATED, message: 'Invalid login credentials'});

        const config = await this.grpcSdk.config.get('authentication').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const promise1 = this.database.deleteMany('AccessToken', {userId: serviceUser._id, clientId});
        const promise2 = this.database.deleteMany('RefreshToken', {userId: serviceUser._id, clientId});
        await Promise.all([promise1, promise2]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const signTokenOptions: ISignTokenOptions = {
            secret: config.jwtSecret,
            expiresIn: config.tokenInvalidationPeriod
        };

        const accessToken = await this.database.create('AccessToken', {
            userId: serviceUser._id,
            clientId,
            token: AuthUtils.signToken({id: serviceUser._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const refreshToken = await this.database.create('RefreshToken', {
            userId: serviceUser._id,
            clientId,
            token: AuthUtils.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {
            result: JSON.stringify({
                serviceId: serviceUser._id.toString(),
                accessToken: accessToken.token,
                refreshToken: refreshToken.token
            })
        });
    }
}

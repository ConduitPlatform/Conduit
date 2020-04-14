import {
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters, ConduitRouteReturnDefinition,
    ConduitSDK,
    IConduitDatabase, TYPE
} from '@conduit/sdk';
import {OAuth2Client} from 'google-auth-library';
import {isNil} from 'lodash';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import {AuthService} from '../../services/auth';
import moment = require('moment');

export class GoogleHandlers {
    private readonly client: OAuth2Client;
    private readonly database: IConduitDatabase;

    constructor(private readonly sdk: ConduitSDK, private readonly authService: AuthService) {
        this.client = new OAuth2Client();
        this.database = sdk.getDatabase();
        this.registerRoutes();
    }

    async authenticate(params: ConduitRouteParameters) {
        const {id_token, access_token, refresh_token, expires_in} = params.params as any;
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        if (!config.google.enabled) {
            throw new Error('Google authentication is disabled');
        }

        if (isNil(params.context)) throw new Error('No headers provided');

        const ticket = await this.client.verifyIdToken({
            idToken: id_token,
            audience: config.google.clientId
        });

        const payload = ticket.getPayload();
        if (isNil(payload)) {
            throw new Error('Received invalid response from the Google API');
        }
        if (!payload.email_verified) {
            throw new Error('Unauthorized');
        }

        const User = this.database.getSchema('User');
        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        let user = await User.findOne({email: payload.email});

        if (!isNil(user)) {
            if (!user.active) throw new Error('Inactive user');
            if (!config.google.accountLinking) {
                throw Error('User with this email already exists');
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
            clientId: params.context.clientId,
            token: this.authService.signToken({id: user._id}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate()
        });

        const refreshToken = await RefreshToken.create({
            userId: user._id,
            clientId: params.context.clientId,
            token: this.authService.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod, 'milliseconds').toDate()
        });

        return {userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token};
    }

    registerRoutes() {
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/google',
                action: Actions.POST,
                bodyParams: {
                    id_token: 'String',
                    access_token: 'String',
                    refresh_token: 'String',
                    expires_in: 'String'
                }
            },
            new ConduitRouteReturnDefinition('GoogleResponse', {
                userId: TYPE.String,
                accessToken: TYPE.String,
                refreshToken: TYPE.String
            }), this.authenticate));
    }
}

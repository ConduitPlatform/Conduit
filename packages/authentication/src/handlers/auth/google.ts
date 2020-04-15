import {
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters, ConduitRouteReturnDefinition,
    ConduitSDK, ConduitString,
    IConduitDatabase, TYPE,
    ConduitError
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

        if (isNil(params.context)) throw ConduitError.unauthorized('No headers provided');

        const ticket = await this.client.verifyIdToken({
            idToken: id_token,
            audience: config.google.clientId
        });

        const payload = ticket.getPayload();
        if (isNil(payload)) {
            throw ConduitError.unauthorized('Received invalid response from the Google API');
        }
        if (!payload.email_verified) {
            throw ConduitError.unauthorized();
        }

        const User = this.database.getSchema('User');
        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        let user = await User.findOne({email: payload.email});

        if (!isNil(user)) {
            if (!user.active) throw ConduitError.forbidden('Inactive user');
            if (!config.google.accountLinking) {
                throw ConduitError.forbidden('User with this email already exists');
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
                    id_token: TYPE.String,
                    access_token: TYPE.String,
                    refresh_token: TYPE.String,
                    expires_in: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('GoogleResponse', {
                userId: ConduitString.Required,
                accessToken: ConduitString.Required,
                refreshToken: ConduitString.Required
            }), this.authenticate.bind(this)));
    }
}

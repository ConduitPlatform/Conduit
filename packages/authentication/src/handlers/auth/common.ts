import {
    ConduitError,
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSDK, ConduitString,
    IConduitDatabase,
    TYPE
} from '@conduit/sdk';
import {isNil} from 'lodash';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import {AuthService} from '../../services/auth';
import moment from 'moment';

export class CommonHandlers {
    private readonly database: IConduitDatabase;

    constructor(private readonly sdk: ConduitSDK, private readonly authService: AuthService) {
        this.database = sdk.getDatabase();
        this.registerRoutes();
    }

    async renewAuth(params: ConduitRouteParameters) {
        if (isNil(params.context)) throw ConduitError.forbidden('No headers provided');
        const clientId = params.context.clientId;

        const {refreshToken} = params.params as any;
        if (isNil(refreshToken)) {
            throw ConduitError.userInput('Invalid parameters');
        }

        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        const oldRefreshToken = await RefreshToken.findOne({token: refreshToken, clientId});
        if (isNil(oldRefreshToken)) {
            throw ConduitError.forbidden('Invalid parameters');
        }

        const oldAccessToken = await AccessToken.findOne({clientId});
        if (isNil(oldAccessToken)) {
            throw ConduitError.notFound('No access token found');
        }

        const signTokenOptions: ISignTokenOptions = {
            secret: config.jwtSecret,
            expiresIn: config.tokenInvalidationPeriod
        };

        const newAccessToken = await AccessToken.create({
            userId: oldRefreshToken.userId,
            clientId,
            token: this.authService.signToken({id: oldRefreshToken.userId}, signTokenOptions),
            expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate()
        });

        const newRefreshToken = await RefreshToken.create({
            userId: oldRefreshToken.userId,
            clientId,
            token: this.authService.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod, 'milliseconds').toDate()
        });

        await AccessToken.deleteOne(oldAccessToken);
        await RefreshToken.deleteOne(oldRefreshToken);

        return {
            accessToken: newAccessToken.token,
            refreshToken: newRefreshToken.token
        };
    }

    async logOut(params: ConduitRouteParameters) {
        if (isNil(params.context)) throw ConduitError.forbidden('No headers provided');
        const clientId = params.context.clientId;

        const user = params.context.user;

        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        await AccessToken.deleteOne({userId: user._id, clientId});
        await RefreshToken.deleteOne({userId: user._id, clientId});

        return 'Logged out';
    }

    registerRoutes() {
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/renew',
                action: Actions.POST,
                bodyParams: {
                    refreshToken: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {
                accessToken: ConduitString.Required,
                refreshToken: ConduitString.Required
            }), this.renewAuth.bind(this)));

        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/logout',
                action: Actions.POST
            },
            new ConduitRouteReturnDefinition('LogoutResponse', 'String'), this.logOut.bind(this)));
    }
}

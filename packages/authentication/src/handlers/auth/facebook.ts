import {
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters, ConduitRouteReturnDefinition,
    ConduitSDK, ConduitString,
    ForbiddenError,
    IConduitDatabase,
    UnauthorizedError
} from '@conduit/sdk';
import request, {OptionsWithUrl} from 'request-promise';
import {isNil} from 'lodash';
import {AuthService} from '../../services/auth';
import {ISignTokenOptions} from '../../interfaces/ISignTokenOptions';
import moment = require('moment');

export class FacebookHandlers {
    private readonly database: IConduitDatabase;

    constructor(private readonly sdk: ConduitSDK, private readonly authService: AuthService) {
        this.database = sdk.getDatabase();
        this.registerRoutes();
    }

    async authenticate(params: ConduitRouteParameters) {
        const {access_token} = params.params as any;
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');

        if (!config.facebook.enabled) {
            throw new ForbiddenError('Facebook authentication is disabled');
        }

        if (isNil(params.context)) throw new UnauthorizedError('No headers provided');

        const facebookOptions: OptionsWithUrl = {
            method: 'GET',
            url: 'https://graph.facebook.com/v5.0/me',
            qs: {
                access_token,
                fields: 'id,email'
            },
            json: true
        };

        const facebookResponse = await request(facebookOptions);

        if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
            throw new UnauthorizedError('Authentication with facebook failed');
        }

        const User = this.database.getSchema('User');
        const AccessToken = this.database.getSchema('AccessToken');
        const RefreshToken = this.database.getSchema('RefreshToken');

        let user = await User.findOne({email: facebookResponse.email});

        if (!isNil(user)) {
            if (!user.active) throw new ForbiddenError('Inactive user');
            if (!config.facebook.accountLinking) {
                throw new ForbiddenError('User with this email already exists');
            }
            if (isNil(user.facebook)) {
                user.facebook = {
                    id: facebookResponse.id
                };
                // TODO look into this again, as the email the user has registered will still not be verified
                if (!user.isVerified) user.isVerified = true;
                user = await User.findByIdAndUpdate(user);
            }
        } else {
            user = await User.create({
                email: facebookResponse.email,
                facebook: {
                    id: facebookResponse.id
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
            expiresOn: moment().add(config.tokenInvalidationPeriod as number, 'milliseconds').toDate()
        });

        const refreshToken = await RefreshToken.create({
            userId: user._id,
            clientId: params.context.clientId,
            token: this.authService.randomToken(),
            expiresOn: moment().add(config.refreshTokenInvalidationPeriod as number, 'milliseconds').toDate()
        });

        return {userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token};
    }

    registerRoutes() {
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/authentication/facebook',
                action: Actions.POST,
                bodyParams: {
                    // todo switch to required when the parsing is added
                    access_token: ConduitString.Optional
                }
            },
            new ConduitRouteReturnDefinition('FacebookResponse', {
                userId: ConduitString.Optional,
                accessToken: ConduitString.Required,
                refreshToken: ConduitString.Optional
            }), this.authenticate));
    }
}

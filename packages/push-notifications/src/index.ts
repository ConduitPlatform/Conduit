import {IPushNotificationsProvider} from './interfaces/IPushNotificationsProvider';
import {IFirebaseSettings} from './interfaces/IFirebaseSettings';
import {NotificationTokenModel} from './models/NotificationToken';
import {FirebaseProvider} from './providers/firebase';
import {NextFunction, Request, Response} from 'express';
import {NotificationTokensHandler} from './handlers/notification-tokens/notification-tokens';
import {AdminHandler} from './handlers/admin/admin';
import PushNotificationsConfigSchema from './config/push-notifications';
import {
    ConduitDate,
    ConduitObjectId,
    ConduitRoute,
    ConduitRouteActions, ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSDK, ConduitString,
    IConduitPushNotifications,
    TYPE
} from '@conduit/sdk';

class PushNotificationsModule extends IConduitPushNotifications {

    private readonly _provider: IPushNotificationsProvider;
    private readonly sdk: ConduitSDK
    pushNotificationModel: any;

    constructor(conduit: ConduitSDK) {
        super(conduit);
        this.sdk = conduit;

        const databaseAdapter = conduit.getDatabase();
        databaseAdapter.createSchemaFromAdapter(NotificationTokenModel);

        const name = (conduit as any).config.get('pushNotifications.providerName');
        const settings = (conduit as any).config.get(`pushNotifications.${name}`);

        if (name === 'firebase') {
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        } else {
            // this was done just for now so that we surely initialize the _provider variable
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        }

        conduit.getRouter()
            .registerRouteMiddleware('/notification-token', conduit.getAuthentication().middleware);
        this.registerConsumerRoutes();
        this.registerAdminRoutes();
    }

    static get config() {
        return PushNotificationsConfigSchema;
    }

    registerConsumerRoutes() {
        const notificationTokensHandler = new NotificationTokensHandler(this.sdk);
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/notification-token',
                action: ConduitRouteActions.POST,
                bodyParams: {
                    token: TYPE.String,
                    platform: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
                message: TYPE.String, newTokenDocument: {
                    _id: ConduitObjectId.Required,
                    userId: ConduitObjectId.Required,
                    token: ConduitString.Required,
                    createdAt: ConduitDate.Required,
                    updatedAt: ConduitDate.Required
                }
            }),
            (params: ConduitRouteParameters) => notificationTokensHandler.setNotificationToken(params)
        ));
    }


    registerAdminRoutes() {
        const adminHandler = new AdminHandler(this.sdk, this._provider);
        this.sdk.getAdmin().registerRoute('GET', '/notification-token/:userId',
            (req: Request, res: Response, next: NextFunction) => adminHandler.getNotificationToken(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendNotification(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send-many',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendManyNotifications(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send-to-many-devices',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendToManyDevices(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('GET', '/notifications/config',
            (req: Request, res: Response, next: NextFunction) => adminHandler.getNotificationsConfig(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('PUT', '/notifications/config',
            (req: Request, res: Response, next: NextFunction) => adminHandler.editNotificationsConfig(req, res, next).catch(next));
    }
}

export = PushNotificationsModule;

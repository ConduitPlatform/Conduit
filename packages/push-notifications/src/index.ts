import {IPushNotificationsProvider} from './interfaces/IPushNotificationsProvider';
import {IFirebaseSettings} from './interfaces/IFirebaseSettings';
import {FirebaseProvider} from './providers/firebase';
import {NextFunction, Request, Response} from 'express';
import {NotificationTokensHandler} from './handlers/notification-tokens/notification-tokens';
import {AdminHandler} from './handlers/admin/admin';
import PushNotificationsConfigSchema from './config/push-notifications';
import {
    ConduitDate,
    ConduitObjectId,
    ConduitRoute,
    ConduitRouteActions,
    ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSDK,
    ConduitString,
    IConduitPushNotifications,
    TYPE
} from '@conduit/sdk';
import {isNil} from 'lodash';

export default class PushNotificationsModule extends IConduitPushNotifications {

    private _provider: IPushNotificationsProvider | undefined;
    private readonly sdk: ConduitSDK;
    private isRunning: boolean = false;

    constructor(conduit: ConduitSDK) {
        super(conduit);
        this.sdk = conduit;

        if ((conduit as any).config.get('pushNotifications.active')) {
            this.enableModule().catch(console.log);
        }
    }

    static get config() {
        return PushNotificationsConfigSchema;
    }

    async setConfig(newConfig: any) {
        if (!ConduitSDK.validateConfig(newConfig, PushNotificationsConfigSchema.pushNotifications)) {
            throw new Error('Invalid configuration values');
        }

        let errorMessage: string | null = null;
        const updateResult = await this.sdk.updateConfig(newConfig, 'pushNotifications').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        if ((this.sdk as any).config.get('pushNotifications.active')) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            throw new Error('Module is not active');
        }
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        return updateResult;
    }

    private async enableModule() {
        if (!this.isRunning) {
            this.initProvider();
            this.sdk.getRouter()
                .registerRouteMiddleware('/notification-token', this.sdk.getAuthentication().middleware);
            this.registerConsumerRoutes();
            this.registerAdminRoutes();
            this.isRunning = true;

        } else {
            this.initProvider();
        }
    }

    private initProvider() {
        const name = (this.sdk as any).config.get('pushNotifications.providerName');
        const settings = (this.sdk as any).config.get(`pushNotifications.${name}`);

        if (name === 'firebase') {
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        } else {
            // this was done just for now so that we surely initialize the _provider variable
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        }
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
        const adminHandler = new AdminHandler(this.sdk, this._provider!);
        this.sdk.getAdmin().registerRoute('GET', '/notification-token/:userId',
            (req: Request, res: Response, next: NextFunction) => adminHandler.getNotificationToken(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendNotification(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send-many',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendManyNotifications(req, res, next).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/notifications/send-to-many-devices',
            (req: Request, res: Response, next: NextFunction) => adminHandler.sendToManyDevices(req, res, next).catch(next));

    }
}

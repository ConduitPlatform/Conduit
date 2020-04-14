import { NextFunction, Request, Response } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from '../../interfaces/ISendNotification';
import { isNil, merge, isEmpty } from 'lodash';
import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { IPushNotificationsProvider } from '../../interfaces/IPushNotificationsProvider';

export class AdminHandler {

  private readonly provider: IPushNotificationsProvider;
  private readonly databaseAdapter: IConduitDatabase;
  private readonly conduit: ConduitSDK;

  constructor(conduit: ConduitSDK, provider: IPushNotificationsProvider) {
    this.conduit = conduit;
    this.provider = provider;
    this.databaseAdapter = conduit.getDatabase();
  }

  async sendNotification(req: Request, res: Response, next: NextFunction) {
    const { title, body, data, userId } = req.body;
    if (isNil(title) || isNil(userId)) return res.status(401).json({error: 'Required fields are missing'});
    const params = {
      title,
      body,
      data,
      sendTo: userId
    };
    if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
    await this.provider.sendToDevice(params, this.databaseAdapter);
    return res.json('ok');
  }

  async sendManyNotifications(req: Request, res: Response, next: NextFunction) {
    let requestParams = req.body;
    const params = requestParams.map((param: any) => {
      if (isNil(param.title) || isNil(param.userId)) return res.status(401).json({error: 'Required fields are missing'});
      return {
        sendTo: param.userId,
        title: param.title,
        body: param.body,
        data: param.data
      }
    });
    if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
    await this.provider.sendMany(params, this.databaseAdapter);
    return res.json('ok');
  }

  async sendToManyDevices(req: Request, res: Response, next: NextFunction) {
    const { userIds, title, body, data } = req.body;
    if (isNil(title) || isNil(userIds) || isEmpty(userIds)) return res.status(401).json({error: 'Required fields are missing'});
    const params = {
      sendTo: userIds,
      title,
      body,
      data
    };
    if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
    await this.provider.sendToManyDevices(params, this.databaseAdapter);
    return res.json('ok');
  }

  async getNotificationsConfig(req: Request, res: Response, next: NextFunction) {
    const { config: appConfig } = this.conduit as any;

    const Config = this.databaseAdapter.getSchema('Config');
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }
    return res.json(dbConfig.config.pushNotifications);
  }

  async editNotificationsConfig(req: Request, res: Response, next: NextFunction) {
    const { config: appConfig } = this.conduit as any;

    const Config = this.databaseAdapter.getSchema('Config');

    const newNotificationsConfig = req.body;

    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }

    const currentNotificationsConfig = dbConfig.config.pushNotifications;
    const final = merge(currentNotificationsConfig, newNotificationsConfig);

    dbConfig.config.pushNotifications = final;
    const saved = await dbConfig.save();
    await appConfig.load(saved.config);

    return res.json(saved.config.pushNotifications);
  }
}


import { NextFunction, Request, Response } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from '../../interfaces/ISendNotification';
import { isNil, merge } from 'lodash';
import { ConduitSDK } from '@conduit/sdk';

export class AdminHandler {

  private readonly provider: any;
  private readonly databaseAdapter: any;
  private readonly conduit: ConduitSDK;

  constructor(conduit: ConduitSDK, provider: any, databaseAdapter: any) {
    this.conduit = conduit;
    this.provider = provider;
    this.databaseAdapter = databaseAdapter;
  }

  async sendNotification(req: Request, res: Response, next: NextFunction) {
    const params: ISendNotification = req.body;
    if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
    await this.provider.sendToDevice(params, this.databaseAdapter);
    return res.json('ok');
  }

  async sendManyNotifications(req: Request, res: Response, next: NextFunction) {
    const params: ISendNotification[] = req.body;
    if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
    await this.provider.sendMany(params, this.databaseAdapter);
    return res.json('ok');
  }

  async sendToManyDevices(req: Request, res: Response, next: NextFunction) {
    const params: ISendNotificationToManyDevices = req.body;
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


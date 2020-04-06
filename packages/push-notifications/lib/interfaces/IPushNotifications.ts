import { NextFunction, Request, Response } from 'express';

export interface IPushNotifications {

  sendToDevice(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any>;

  sendMany(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any>;

  sendToManyDevices(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any>;
}

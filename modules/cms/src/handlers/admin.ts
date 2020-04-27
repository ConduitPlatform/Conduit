import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil } from 'lodash';

export class AdminHandlers {
  private readonly _adapter: IConduitDatabase;
  private readonly _createSchema: any;

  constructor(sdk: ConduitSDK, createSchema: any) {
    this._adapter = sdk.getDatabase();
    this._createSchema = createSchema;
  }

  async getAllSchemas(req: Request, res: Response) {
    const { skip, limit } = req.query;
    let skipNumber = 0, limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const schemas = await this._adapter.getSchema('SchemaDefinitions')
      .findPaginated({}, skipNumber, limitNumber);

    const documentsCount = await this._adapter.getSchema('SchemaDefinitions').countDocuments({});

    return res.json({results: schemas, documentsCount});
  }

  async createSchema() {

  }

}

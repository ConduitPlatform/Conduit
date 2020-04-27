import { ConduitSchema, ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil } from 'lodash';

export class AdminHandlers {
  private readonly schemaDefinitionsModel: any;
  // private readonly _createSchema: (schema: ConduitSchema) => void;

  constructor(sdk: ConduitSDK) {
    this.schemaDefinitionsModel = sdk.getDatabase().getSchema('SchemaDefinitions');
    // this._createSchema = createSchema;
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

    const schemas = await this.schemaDefinitionsModel.findPaginated({}, skipNumber, limitNumber);

    const documentsCount = await this.schemaDefinitionsModel.countDocuments({});

    return res.json({results: schemas, documentsCount});
  }

  async createSchema(req: Request, res: Response) {
    const { name, fields, modelOptions, enabled } = req.body;

    if (isNil(name) || isNil(fields)) {
      return res.status(403).json({error: 'Required fields are missing'});
    }

    const newSchema = await this.schemaDefinitionsModel.create({name, fields, modelOptions, enabled});

    return res.json(newSchema);
  }

}

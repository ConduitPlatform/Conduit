import { ConduitSchema, ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil } from 'lodash';
import { CMS } from '../index';

export class AdminHandlers {
  private readonly schemaDefinitionsModel: any;
  private readonly cmsInstance: CMS;
  // private readonly _createSchema: (schema: ConduitSchema) => void;

  constructor(sdk: ConduitSDK, cmsInstance: CMS) {
    this.schemaDefinitionsModel = sdk.getDatabase().getSchema('SchemaDefinitions');
    this.cmsInstance = cmsInstance;

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

  async getById(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(403).json('Path parameter "id" is missing');
    }

    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});

    return res.json(requestedSchema);
  }

  async createSchema(req: Request, res: Response, cmsCreateSchema: (schema: ConduitSchema) => void) {
    const { name, fields, modelOptions, enabled } = req.body;

    if (isNil(name) || isNil(fields)) {
      return res.status(403).json({error: 'Required fields are missing'});
    }

    const options = JSON.stringify(modelOptions);
    const newSchema = await this.schemaDefinitionsModel.create({name, fields, modelOptions: options, enabled});
    cmsCreateSchema.call(this.cmsInstance, newSchema);

    return res.json(newSchema);
  }

  async setEnable(req: Request, res: Response, cmsCreateSchema: (schema: ConduitSchema) => void) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(403).json('Path parameter "id" is missing');
    }
    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});

    if (isNil(requestedSchema)) {
      return res.status(404).json({error: 'Requested schema not found'});
    }

    if (requestedSchema.enabled) {
      requestedSchema.enabled = false;
    } else {
      requestedSchema.enabled = true;
      cmsCreateSchema.call(this.cmsInstance, requestedSchema);
    }

    const updatedSchema = await this.schemaDefinitionsModel.findByIdAndUpdate(requestedSchema);

    return res.json({name: updatedSchema.name, enabled: updatedSchema.enabled});
  }

}

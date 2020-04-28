import { ConduitSchema, ConduitSDK, IConduitDatabase, TYPE } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { CMS } from '../index';

export class AdminHandlers {
  private readonly schemaDefinitionsModel: any;
  private readonly cmsInstance: CMS;
  private readonly _createSchema: (schema: ConduitSchema) => void;

  constructor(sdk: ConduitSDK, cmsInstance: CMS, createSchema: (schema: ConduitSchema) => void) {
    this.schemaDefinitionsModel = sdk.getDatabase().getSchema('SchemaDefinitions');
    this.cmsInstance = cmsInstance;
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

  async createSchema(req: Request, res: Response) {
    const { name, fields, modelOptions, enabled } = req.body;

    if (isNil(name) || isNil(fields)) {
      return res.status(403).json({error: 'Required fields are missing'});
    }

    Object.assign(fields, {
      _id: TYPE.String,
      createdAt: {
        type: TYPE.Date,
        required: true
      },
      updatedAt: {
        type: TYPE.Date,
        required: true
      }
    });
    const options = JSON.stringify(modelOptions);
    const newSchema = await this.schemaDefinitionsModel.create({name, fields, modelOptions: options, enabled});
    newSchema.modelOptions = JSON.parse(newSchema.modelOptions);
    this._createSchema.call(this.cmsInstance, new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions));

    return res.json(newSchema);
  }

  async setEnable(req: Request, res: Response) {
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
      // TODO disable routes
    } else {
      requestedSchema.enabled = true;
      this._createSchema.call(this.cmsInstance, new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
    }

    const updatedSchema = await this.schemaDefinitionsModel.findByIdAndUpdate(requestedSchema);

    return res.json({name: updatedSchema.name, enabled: updatedSchema.enabled});
  }

  async editSchema(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(403).json('Path parameter "id" is missing');
    }
    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});

    if (isNil(requestedSchema)) {
      return res.status(404).json({error: 'Requested schema not found'});
    }

    const { name, fields, modelOptions } = req.body;
    requestedSchema.name = name ? name : requestedSchema.name;
    merge(requestedSchema.fields, fields);
    const schemasModelOptions = JSON.parse(requestedSchema.modelOptions);
    merge(schemasModelOptions, modelOptions);
    requestedSchema.modelOptions = JSON.stringify(schemasModelOptions);

    const updatedSchema = await this.schemaDefinitionsModel.findByIdAndUpdate(requestedSchema);

    // TODO reinitialise routes?
    return res.json(updatedSchema);
  }

  async deleteSchema(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(403).json('Path parameter "id" is missing');
    }

    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});
    if (isNil(requestedSchema)) {
      return res.status(404).json({error: 'Requested schema not found'});
    }

    await this.schemaDefinitionsModel.deleteOne(requestedSchema);

    // TODO disable routes
    return res.json('Schema succesfully deleted');
  }

}

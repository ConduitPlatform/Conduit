import { ConduitSchema, ConduitSDK, IConduitDatabase, TYPE } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { CMS } from '../index';

export class AdminHandlers {
  private readonly schemaDefinitionsModel: any;
  private readonly _createSchema: (schema: ConduitSchema) => void;

  constructor(sdk: ConduitSDK, createSchema: (schema: ConduitSchema) => void) {
    this.schemaDefinitionsModel = sdk.getDatabase().getSchema('SchemaDefinitions');
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

    const schemasPromise = this.schemaDefinitionsModel.findPaginated({}, skipNumber, limitNumber);
    const documentsCountPromise = this.schemaDefinitionsModel.countDocuments({});

    const [schemas, documentsCount] = await Promise.all([schemasPromise, documentsCountPromise]);
    return res.json({results: schemas, documentsCount});
  }

  async getById(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(400).json('Path parameter "id" is missing');
    }

    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});

    if (isNil(requestedSchema)) {
      return res.status(404).json('Requested resource not found');
    }

    return res.json(requestedSchema);
  }

  async createSchema(req: Request, res: Response) {
    const { name, fields, modelOptions, enabled } = req.body;

    if (isNil(name) || isNil(fields)) {
      return res.status(400).json({error: 'Required fields are missing'});
    }

    Object.assign(fields, {
      _id: TYPE.ObjectId,
      createdAt: {
        type: TYPE.Date,
        required: true
      },
      updatedAt: {
        type: TYPE.Date,
        required: true
      }
    });
    let options = undefined;
    if (!isNil(modelOptions)) options = JSON.stringify(modelOptions);

    const newSchema = await this.schemaDefinitionsModel.create({name, fields, modelOptions: options, enabled});
    if (!isNil(modelOptions)) newSchema.modelOptions = JSON.parse(newSchema.modelOptions);
    if (newSchema.enabled) {
      this._createSchema(new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions));
    }

    return res.json(newSchema);
  }

  async setEnable(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(400).json('Path parameter "id" is missing');
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
      this._createSchema(new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
    }

    const updatedSchema = await this.schemaDefinitionsModel.findByIdAndUpdate(requestedSchema);

    return res.json({name: updatedSchema.name, enabled: updatedSchema.enabled});
  }

  async editSchema(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(400).json('Path parameter "id" is missing');
    }
    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});

    if (isNil(requestedSchema)) {
      return res.status(404).json({error: 'Requested schema not found'});
    }

    const { name, fields, modelOptions } = req.body;

    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    requestedSchema.modelOptions = modelOptions ? JSON.stringify(modelOptions) : requestedSchema.modelOptions;

    const updatedSchema = await this.schemaDefinitionsModel.findByIdAndUpdate(requestedSchema);
    if (!isNil(updatedSchema.modelOptions)) updatedSchema.modelOptions = JSON.parse(updatedSchema.modelOptions);

    // TODO reinitialise routes?
    if (updatedSchema.enabled) {
      this._createSchema(new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
    }
    // TODO even if new routes are initiated the old ones don't go anywhere so the user requests to those routes expect values compatible with the old schema

    return res.json(updatedSchema);
  }

  async deleteSchema(req: Request, res: Response) {
    const id = req.params.id;
    if (isNil(id)) {
      return res.status(400).json('Path parameter "id" is missing');
    }

    const requestedSchema = await this.schemaDefinitionsModel.findOne({_id: id});
    if (isNil(requestedSchema)) {
      return res.status(404).json({error: 'Requested schema not found'});
    }

    await this.schemaDefinitionsModel.deleteOne(requestedSchema);

    // TODO disable routes
    return res.json('Schema successfully deleted');
  }

}

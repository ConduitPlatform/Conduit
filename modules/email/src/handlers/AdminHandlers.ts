import { Request, Response } from 'express';
import { isNil } from 'lodash';
import { EmailService } from '../services/email.service';
import ConduitGrpcSdk from '@conduit/grpc-sdk';

export class AdminHandlers {
  private readonly database: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly emailService: EmailService
  ) {
    this.database = this.grpcSdk.databaseProvider;
  }

  async getTemplates(req: Request, res: Response) {
    const { skip, limit } = req.query;
    let skipNumber = 0, limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const templateDocumentsPromise = await this.database.findMany('EmailTemplate', {}, null, skipNumber, limitNumber);
    const totalCountPromise = await this.database.countDocuments({});

    const [templateDocuments, totalCount] = await Promise.all([templateDocumentsPromise, totalCountPromise]);

    return res.json({ templateDocuments, totalCount });
  }

  async createTemplate(req: Request, res: Response) {
    const { name, subject, body, variables } = req.body;
    if (isNil(name) || isNil(subject) || isNil(body) || isNil(variables)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const newTemplate = await this.database.create('EmailTemplate',{
      name,
      subject,
      body,
      variables
    });

    return res.json({ template: newTemplate });
  }

  async editTemplate(req: Request, res: Response) {
    const id = req.params.id;
    const params = req.body;

    const allowedFields = ['name', 'subject', 'body', 'variables'];

    const flag = Object.keys(params).some(key => {
      if (!allowedFields.includes(key)) {
        return true;
      }
    });
    if (flag) return res.status(403).json({ error: 'Invalid parameters are given' });

    const templateDocument = await this.database.findOne('EmailTemplate',{ _id: id });
    if (isNil(templateDocument)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    Object.keys(params).forEach(key => {
      templateDocument[key] = params[key];
    });

    const updatedTemplate = await this.database.findByIdAndUpdate('EmailTemplate', templateDocument);

    return res.json({ updatedTemplate });
  }

  async sendEmail(req: Request, res: Response) {
    const {
      templateName,
      email,
      variables,
      sender
    } = req.body;

    await this.emailService.sendEmail(templateName, {email, variables, sender});

    return res.json({message: 'Email sent'});
  }

}

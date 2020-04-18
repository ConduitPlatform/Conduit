import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { EmailService } from '../services/email.service';

export class AdminHandlers {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly emailService: EmailService
  ) {
    this.database = this.sdk.getDatabase();
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

    const EmailTemplate = this.database.getSchema('EmailTemplate');

    const templateDocumentsPromise = EmailTemplate.findPaginated({}, skipNumber, limitNumber);
    const totalCountPromise = EmailTemplate.countDocuments({});

    const [templateDocuments, totalCount] = await Promise.all([templateDocumentsPromise, totalCountPromise]);

    return res.json({ templateDocuments, totalCount });
  }

  async createTemplate(req: Request, res: Response) {
    const { name, subject, body, variables } = req.body;
    if (isNil(name) || isNil(subject) || isNil(body) || isNil(variables)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const EmailTemplate = this.database.getSchema('EmailTemplate');

    const newTemplate = await EmailTemplate.create({
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

    const EmailTemplate = this.database.getSchema('EmailTemplate');

    const templateDocument = await EmailTemplate.findOne({ _id: id });
    if (isNil(templateDocument)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    Object.keys(params).forEach(key => {
      templateDocument[key] = params[key];
    });

    const updatedTemplate = await EmailTemplate.findByIdAndUpdate(templateDocument);

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

  async getEmailConfig(req: Request, res: Response) {
    const Config = this.database.getSchema('Config');

    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(403).json({ error: 'Config not set' });
    }

    return res.json(dbConfig.config.email);
  }

  async editEmailConfig(req: Request, res: Response) {
    const Config = this.database.getSchema('Config');

    const { config: appConfig } = this.sdk as any;

    const newEmailConfig = req.body;

    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }

    const currentEmailConfig = dbConfig.config.email;
    const final = merge(currentEmailConfig, newEmailConfig);

    dbConfig.config.email = final;
    const saved = await Config.findByIdAndUpdate(dbConfig);
    await appConfig.load(saved.config);

    return res.json(saved.config.email);
  }
}

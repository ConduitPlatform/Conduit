import { isNil } from 'lodash';
import { EmailService } from '../services/email.service';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import to from 'await-to-js';
let paths = require('./admin.json').functions;

export class AdminHandlers {
  private database: any;
  private emailService: EmailService;

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getTemplates: this.getTemplates.bind(this),
        createTemplate: this.createTemplate.bind(this),
        editTemplate: this.editTemplate.bind(this),
        sendEmail: this.sendEmail.bind(this),
        getExternalTemplates: this.getExternalTemplates.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  setEmailService(emailService: EmailService) {
    this.emailService = emailService;
  }

  async getExternalTemplates(call: RouterRequest, callback: RouterResponse) {
    const externalTemplates = await this.emailService.getExternalTemplates();
    if (isNil(externalTemplates)) {
      throw new Error(`External templates didnt found!`);
    }
    let templateDocuments: any = [];
    externalTemplates.forEach((element) => {
      templateDocuments.push({
        _id: element.id,
        name: element.name,
        subject: element.versions[0].subject,
        body: element.versions[0].body,
        createdAt: element.createdAt,
        variables: element.versions[0].variables,
      });
    });
    const totalCount = templateDocuments.length;
    return callback(null, { result: JSON.stringify({ templateDocuments, totalCount }) });
  }

  async getTemplates(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const templateDocumentsPromise = this.database.findMany(
      'EmailTemplate',
      {},
      null,
      skipNumber,
      limitNumber
    );
    const totalCountPromise = this.database.countDocuments('EmailTemplate', {});

    let errorMessage: string | null = null;
    const [templateDocuments, totalCount] = await Promise.all([
      templateDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ templateDocuments, totalCount }) });
  }
  async createTemplate(call: RouterRequest, callback: RouterResponse) {
    const { id, sender, externalManaged, name, subject, body, variables } = JSON.parse(
      call.request.params
    );
    let externalId = undefined;
    if (isNil(name) || isNil(subject) || isNil(body) || isNil(variables)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }
    if (externalManaged) {
      if (isNil(id)) {
        //that means that we want to create an external managed template
        const [err, template] = await to(
          this.emailService.createExternalTemplate({
            name,
            body: body,
            subject,
          }) as any
        );
        if (err) {
          return callback({
            code: status.INTERNAL,
            message: err.message,
          });
        }
        externalId = (template as any)?.id;
      }
    }
    let errorMessage: string | null = null;
    const newTemplate = await this.database
      .create('EmailTemplate', {
        name,
        subject,
        body,
        variables,
        externalManaged,
        sender,
        externalId,
      })
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ template: newTemplate }) });
  }

  async editTemplate(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const id = params.id;

    // WHY THE FUCK
    // const allowedFields = ['name', 'subject', 'body', 'variables'];

    // const flag = Object.keys(params).some(key => {
    //     if (!allowedFields.includes(key)) {
    //         return true;
    //     }
    // });
    // if (flag) return callback({
    //     code: status.INVALID_ARGUMENT,
    //     message: "Invalid given parameters",
    // });

    let errorMessage: string | null = null;
    const templateDocument = await this.database
      .findOne('EmailTemplate', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    if (isNil(templateDocument)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Template not found',
      });
    }

    ['name', 'subject', 'body', 'variables'].forEach((key) => {
      if (params[key]) {
        templateDocument[key] = params[key];
      }
    });

    const updatedTemplate = await this.database
      .findByIdAndUpdate('EmailTemplate', id, templateDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    if (templateDocument.externalManaged) {
      const template = await this.emailService.getExternalTemplate(
        updatedTemplate.externalId
      );
      let versionId = undefined;
      if (!isNil(template?.versions[0].id)) {
        versionId = template?.versions[0].id;
      }

      const data = {
        id: updatedTemplate.externalId,
        subject: updatedTemplate.subject,
        body: updatedTemplate.body,
        versionId: versionId,
      };

      await this.emailService.updateTemplate(data)?.catch((e: any) => {
        errorMessage = e.message;
      });

      if (!isNil(errorMessage)) {
        return callback({
          code: status.INTERNAL,
          message: errorMessage,
        });
      }
    }
    return callback(null, { result: JSON.stringify({ updatedTemplate }) });
  }

  async sendEmail(call: RouterRequest, callback: RouterResponse) {
    let { templateName, body, subject, email, variables, sender } = JSON.parse(
      call.request.params
    );

    if (!templateName && (!body || !subject)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: `Template/body+subject not provided`,
      });
    }

    let errorMessage: string | null = null;
    if (!sender) {
      sender = 'conduit';
    }

    if (sender.indexOf('@') === -1) {
      let emailConfig: any = await this.grpcSdk.config
        .get('email')
        .catch(() => console.log('failed to get sending domain'));
      sender = sender + `@${emailConfig?.sendingDomain ?? 'conduit.com'}`;
    }

    await this.emailService
      .sendEmail(templateName, {
        body,
        subject,
        email,
        variables,
        sender: sender ? sender : 'conduit',
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ message: 'Email sent' }) });
  }
}

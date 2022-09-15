import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
  ConduitJson,
  TYPE,
  ConduitRouteObject,
  Query,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import to from 'await-to-js';
import { isNil } from 'lodash';
import { getHandleBarsValues } from '../email-provider/utils';
import { EmailService } from '../services/email.service';
import { EmailTemplate } from '../models';
import { Config } from '../config';
import { Template } from '../email-provider/interfaces/Template';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  private emailService: EmailService;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.registerAdminRoutes();
  }

  setEmailService(emailService: EmailService) {
    this.emailService = emailService;
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getTemplates: this.getTemplates.bind(this),
        createTemplate: this.createTemplate.bind(this),
        patchTemplate: this.patchTemplate.bind(this),
        deleteTemplate: this.deleteTemplate.bind(this),
        deleteTemplates: this.deleteTemplates.bind(this),
        uploadTemplate: this.uploadTemplate.bind(this),
        getExternalTemplates: this.getExternalTemplates.bind(this),
        syncExternalTemplates: this.syncExternalTemplates.bind(this),
        sendEmail: this.sendEmail.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/templates',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetTemplates', {
          templateDocuments: [EmailTemplate.name],
          count: ConduitNumber.Required,
        }),
        'getTemplates',
      ),
      constructConduitRoute(
        {
          path: '/templates',
          action: ConduitRouteActions.POST,
          bodyParams: {
            _id: ConduitString.Optional, // externally managed
            name: ConduitString.Required,
            subject: ConduitString.Optional,
            body: ConduitString.Required,
            sender: ConduitString.Optional,
            externalManaged: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateTemplate', {
          template: EmailTemplate.getInstance().fields, // @type-inconsistency
        }),
        'createTemplate',
      ),
      constructConduitRoute(
        {
          path: '/templates/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Optional,
            subject: ConduitString.Optional,
            body: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('PatchTemplate', {
          template: EmailTemplate.getInstance().fields, // @type-inconsistency
        }),
        'patchTemplate',
      ),
      constructConduitRoute(
        {
          path: '/templates',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteTemplates', {
          template: [EmailTemplate.name],
        }),
        'deleteTemplates',
      ),
      constructConduitRoute(
        {
          path: '/templates/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteTemplate', {
          deleted: ConduitJson.Required, // DeleteEmailTemplate
        }),
        'deleteTemplate',
      ),
      constructConduitRoute(
        {
          path: '/templates/upload',
          action: ConduitRouteActions.POST,
          bodyParams: {
            _id: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('UploadTemplate', {
          created: ConduitJson.Required, // Template
        }),
        'uploadTemplate',
      ),
      constructConduitRoute(
        {
          path: '/externalTemplates',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetExternalTemplates', {
          templateDocuments: [EmailTemplate.name],
          count: ConduitNumber.Required,
        }),
        'getExternalTemplates',
      ),
      constructConduitRoute(
        {
          path: '/syncExternalTemplates',
          action: ConduitRouteActions.UPDATE,
        },
        new ConduitRouteReturnDefinition('SyncExternalTemplates', {
          updated: [EmailTemplate.name],
          count: ConduitNumber.Required,
        }),
        'syncExternalTemplates',
      ),
      constructConduitRoute(
        {
          path: '/send',
          action: ConduitRouteActions.POST,
          bodyParams: {
            email: ConduitString.Required,
            sender: ConduitString.Required,
            variables: ConduitJson.Optional,
            subject: ConduitString.Optional,
            body: ConduitString.Optional,
            templateName: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('SendEmail', {
          message: ConduitString.Required,
        }),
        'sendEmail',
      ),
    ];
  }

  async getTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        identifier = escapeStringRegexp(call.request.params.search);
        query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
      }
    }

    const templateDocumentsPromise = EmailTemplate.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const totalCountPromise = EmailTemplate.getInstance().countDocuments(query);
    const [templateDocuments, count] = await Promise.all([
      templateDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { result: { templateDocuments, count } };
  }

  async createTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { _id, sender, externalManaged, name, subject, body } = call.request.params;

    let externalId = undefined;
    const body_vars = getHandleBarsValues(body);
    const subject_vars = getHandleBarsValues(subject);

    let variables = Object.keys(body_vars).concat(Object.keys(subject_vars));
    variables = variables.filter((value, index) => variables.indexOf(value) === index);

    if (externalManaged) {
      if (isNil(_id)) {
        //that means that we want to create an external managed template
        const [err, template] = await to(
          this.emailService.createExternalTemplate({
            name,
            body,
            subject,
          }) as any,
        );
        if (err) {
          throw new GrpcError(status.INTERNAL, err.message);
        }
        externalId = (template as Template)?.id;
      } else {
        externalId = _id;
      }
    }
    const newTemplate = await EmailTemplate.getInstance()
      .create({
        name,
        subject,
        body,
        variables,
        externalManaged,
        sender,
        externalId,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.increment('email_templates_total');
    return { template: newTemplate };
  }

  async patchTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    ['name', 'subject', 'body'].forEach(key => {
      if (call.request.params[key]) {
        // @ts-ignore
        templateDocument[key] = call.request.params[key];
      }
    });

    templateDocument.variables = Object.keys(
      getHandleBarsValues(call.request.params.body),
    ).concat(Object.keys(getHandleBarsValues(call.request.params.subject)));
    if (templateDocument.variables) {
      templateDocument.variables = templateDocument.variables.filter(
        (value, index) => templateDocument.variables!.indexOf(value) === index,
      );
    }

    const updatedTemplate = await EmailTemplate.getInstance()
      .findByIdAndUpdate(call.request.params.id, templateDocument)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    if (templateDocument.externalManaged) {
      const template = await this.emailService.getExternalTemplate(
        updatedTemplate!.externalId!,
      );
      let versionId = undefined;
      if (!isNil(template?.versions[0].id)) {
        versionId = template?.versions[0].id;
      }
      const data = {
        id: updatedTemplate!.externalId!,
        subject: updatedTemplate!.subject,
        body: updatedTemplate!.body,
        versionId: versionId,
      };
      await this.emailService.updateTemplate(data)?.catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }

    return { updatedTemplate };
  }

  async deleteTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    await EmailTemplate.getInstance()
      .deleteOne({ _id: call.request.params.id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    let deleted;
    if (templateDocument!.externalManaged) {
      deleted = await this.emailService
        .deleteExternalTemplate(templateDocument!.externalId!)
        ?.catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    }
    ConduitGrpcSdk.Metrics?.decrement('email_templates_total');
    return { deleted };
  }

  async deleteTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    const totalCount = ids.length;
    const templateDocuments = await EmailTemplate.getInstance().findMany({
      _id: { $in: ids },
    });
    const foundDocuments = templateDocuments.length;
    if (foundDocuments !== totalCount) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids array contains invalid ids');
    }

    for (const template of templateDocuments) {
      if (template.externalManaged) {
        await this.emailService
          .deleteExternalTemplate(template.externalId!)
          ?.catch((e: Error) => {
            throw new GrpcError(status.INTERNAL, e.message);
          });
      }
    }
    const deletedDocuments = await EmailTemplate.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.decrement(
      'email_templates_total',
      deletedDocuments.deletedCount,
    );
    return { deletedDocuments };
  }

  async uploadTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance().findOne({
      _id: call.request.params._id,
    });
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    const template = {
      name: templateDocument.name,
      body: templateDocument.body,
    };
    const created = await this.emailService
      .createExternalTemplate(template)!
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    if (templateDocument) {
      templateDocument['externalManaged'] = true;
      templateDocument['externalId'] = created.id;
      await EmailTemplate.getInstance()
        .findByIdAndUpdate(call.request.params._id, templateDocument)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    }

    return { created };
  }

  async getExternalTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const [err, externalTemplates] = await to(this.emailService.getExternalTemplates()!);
    if (!isNil(err)) {
      throw new GrpcError(status.INTERNAL, err.message);
    }
    if (isNil(externalTemplates)) {
      throw new GrpcError(status.NOT_FOUND, 'No external templates could be retrieved');
    }
    const templateDocuments: any = [];
    (externalTemplates as Template[]).forEach((element: Template) => {
      templateDocuments.push({
        _id: element.id,
        name: element.name,
        subject: element.versions[0].subject,
        body: element.versions[0].body,
        createdAt: element.createdAt,
        variables: element.versions[0].variables,
      });
    });
    const count = templateDocuments.length;
    return { templateDocuments, count };
  }

  async syncExternalTemplates(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    let errorMessage: string | null = null;
    const externalTemplates: any = await this.emailService.getExternalTemplates();

    const updated = [];
    for (const element of externalTemplates) {
      const templateDocument = await EmailTemplate.getInstance().findOne({
        externalId: element.id,
      });

      if (isNil(templateDocument)) {
        throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
      }

      const synchronized = {
        name: element.name,
        subject: element.versions[0].subject,
        externalId: element.id,
        variables: element.versions[0].variables,
        body: element.versions[0].body,
      };
      const updatedTemplate = await EmailTemplate.getInstance()
        .findByIdAndUpdate(templateDocument._id, synchronized)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        throw new GrpcError(status.INTERNAL, errorMessage);
      }
      updated.push(updatedTemplate);
    }

    return { updated, count: updated.length };
  }

  async sendEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { templateName, body, subject, email, variables } = call.request.params;
    let { sender } = call.request.params;
    if (!templateName && (!body || !subject)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Template/body+subject not provided');
    }
    if (!sender) {
      sender = 'conduit';
    }

    if (sender.indexOf('@') === -1) {
      const emailConfig: Config = await this.grpcSdk.config
        .get('email')
        .catch(() => ConduitGrpcSdk.Logger.error('Failed to get sending domain'));
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
      .catch((e: Error) => {
        {
          ConduitGrpcSdk.Logger.error(e);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.increment('emails_sent_total');
    return { message: 'Email sent' };
  }
}

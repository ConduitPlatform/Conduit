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
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import to from 'await-to-js';
import { isNil } from 'lodash';
import { getHBValues } from '../parse-test/getHBValues';
import { EmailService } from '../services/email.service';
import { EmailTemplate } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  private emailService: EmailService;

  constructor(private readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
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
        editTemplate: this.editTemplate.bind(this),
        deleteTemplate: this.deleteTemplate.bind(this),
        deleteTemplates: this.deleteTemplates.bind(this),
        uploadTemplate: this.uploadTemplate.bind(this),
        getExternalTemplates: this.getExternalTemplates.bind(this),
        syncExternalTemplates: this.syncExternalTemplates.bind(this),
        sendEmail: this.sendEmail.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      constructConduitRoute(
        {
          path: '/templates',
          action: ConduitRouteActions.GET,
          queryParams: {
             skip: ConduitNumber.Optional,
             limit: ConduitNumber.Optional,
             search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetTemplates', {
          templateDocuments: [EmailTemplate.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getTemplates'
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
          template: EmailTemplate.getInstance().fields,
        }),
        'createTemplate'
      ),
      constructConduitRoute(
        {
          path: '/templates/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            id: ConduitString.Required,
            name: ConduitString.Optional,
            subject: ConduitString.Optional,
            body: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('EditTemplate', {
          template: EmailTemplate.getInstance().fields,
        }),
        'editTemplate'
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
        'deleteTemplate'
      ),
      constructConduitRoute(
        {
          path: '/templates',
          action: ConduitRouteActions.DELETE,
          bodyParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteTemplates', {
          template: [EmailTemplate.getInstance().fields],
        }),
        'deleteTemplates'
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
        'uploadTemplate'
      ),
      constructConduitRoute(
        {
          path: '/externalTemplates',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetExternalTemplates', {
          templateDocuments: [EmailTemplate.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getExternalTemplates'
      ),
      constructConduitRoute(
        {
          path: '/syncExternalTemplates',
          action: ConduitRouteActions.UPDATE,
        },
        new ConduitRouteReturnDefinition('SyncExternalTemplates', {
          updated: [EmailTemplate.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'syncExternalTemplates'
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
        'sendEmail'
      ),
    ];
  }

  async getTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id : call.request.params.search }
      }
      else {
        identifier = escapeStringRegexp(call.request.params.search);
        query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
      }
    }

    const templateDocumentsPromise = EmailTemplate.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
    );
    const totalCountPromise = EmailTemplate.getInstance().countDocuments(query);
    const [templateDocuments, totalCount] = await Promise.all([
      templateDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { result: { templateDocuments, totalCount } };
  }

  async createTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { _id, sender, externalManaged, name, subject, body } = call.request.params;

    let externalId = undefined;
    const body_vars = getHBValues(body);
    const subject_vars = getHBValues(subject);

    let variables = Object.keys(body_vars).concat(Object.keys(subject_vars));
    variables = variables.filter(
      (value: any, index: any) => variables.indexOf(value) === index
    );

    if (externalManaged) {
      if (isNil(_id)) {
        //that means that we want to create an external managed template
        const [err, template] = await to(
          this.emailService.createExternalTemplate({
            name,
            body,
            subject,
          }) as any
        );
        if (err) {
          throw new GrpcError(status.INTERNAL, err.message);
        }
        externalId = (template as any)?.id;
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
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { template: newTemplate };
  }

  async editTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance()
      .findOne({ _id: call.request.params.id })
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    ['name', 'subject', 'body'].forEach((key) => {
      if (call.request.params[key]) {
        // @ts-ignore
        templateDocument[key] = call.request.params[key];
      }
    });

    templateDocument.variables = Object.keys(getHBValues(call.request.params.body)).concat(
      Object.keys(getHBValues(call.request.params.subject))
    );
    if (templateDocument.variables) {
      templateDocument.variables = templateDocument.variables.filter(
        (value: any, index: any) => templateDocument.variables!.indexOf(value) === index
      );
    }

    const updatedTemplate = await EmailTemplate.getInstance()
      .findByIdAndUpdate(call.request.params.id, templateDocument)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    if (templateDocument.externalManaged) {
      const template = await this.emailService.getExternalTemplate(
        updatedTemplate!.externalId!
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
      await this.emailService.updateTemplate(data)?.catch((e: any) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }

    return { updatedTemplate };
  }

  async deleteTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance()
      .findOne({ _id: call.request.params.id })
    if (!isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    await EmailTemplate.getInstance()
      .deleteOne({ _id: call.request.params.id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    let deleted;
    if (templateDocument!.externalManaged){
      deleted = await this.emailService.deleteExternalTemplate(templateDocument!.externalId!)
        ?.catch((e:any) => { throw new GrpcError(status.INTERNAL, e.message); });
    }

    return { deleted };
  }

  async deleteTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    let totalCount = ids.length;
    const templateDocuments = await EmailTemplate.getInstance().findMany({ _id: { $in: ids } })
    const foundDocuments = templateDocuments.length;
    if (foundDocuments !== totalCount) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids array contains invalid ids');
    }

    for (let template of templateDocuments) {
      if( template.externalManaged){
        await this.emailService.deleteExternalTemplate(template.externalId!)
          ?.catch((e:any) => { throw new GrpcError(status.INTERNAL, e.message); });
      }
    }
    const deletedDocuments = await EmailTemplate.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { deletedDocuments };
  }

  async uploadTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance()
      .findOne({ _id: call.request.params._id })
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    const template = {
      name: templateDocument.name,
      body: templateDocument.body,
    }
    const created = await (this.emailService.createExternalTemplate(template) as any)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    if (templateDocument) {
      templateDocument['externalManaged'] = true;
      templateDocument['externalId'] =  created.id;
      await EmailTemplate.getInstance()
        .findByIdAndUpdate(call.request.params._id,templateDocument)
        .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    }

    return { created };
  }

  async getExternalTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse>  {
    const [err, externalTemplates] = await to(
      this.emailService.getExternalTemplates() as any
    );
    if (!isNil(err)) {
      throw new GrpcError(status.INTERNAL, err.message);
    }
    if (isNil(externalTemplates)) {
      throw new GrpcError(status.NOT_FOUND, 'No external templates could be retrieved');
    }
    let templateDocuments: any = [];
    (externalTemplates as any).forEach((element: any) => {
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
    return { templateDocuments, totalCount };
  }

  async syncExternalTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let errorMessage: string | null = null;
    const externalTemplates:any = await this.emailService.getExternalTemplates();

    let updated = [];
    let totalCount = 0;
    for (let element of externalTemplates) {
      const templateDocument = await EmailTemplate.getInstance()
      .findOne({ externalId: element.id })

      if (isNil(templateDocument)) {
        throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
      }

      const synchronized = {
        name: element.name,
        subject: element.versions[0].subject,
        externalId: element.id,
        variables: element.versions[0].variables,
        body: element.versions[0].body,
      }
      const updatedTemplate = await EmailTemplate.getInstance()
      .findByIdAndUpdate(templateDocument._id,synchronized)
      .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        throw new GrpcError(status.INTERNAL, errorMessage);
      }
      updated.push(updatedTemplate);
    }

    totalCount = updated.length;
    return { updated, totalCount };
  }
  
  async sendEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { templateName, body, subject, email, variables, sender } = call.request.params;
    if (!templateName && (!body || !subject)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Template/body+subject not provided');
    }
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
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { message: 'Email sent' };
  }
}

import { isNil } from 'lodash';
import { EmailService } from '../services/email.service';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { getHBValues } from '../parse-test/getHBValues';
import to from 'await-to-js';

let paths = require('./admin.json').functions;
const escapeStringRegexp = require('escape-string-regexp');

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
        deleteTemplate: this.deleteTemplate.bind(this),
        syncExternalTemplates: this.syncExternalTemplates.bind(this),
        deleteManyTemplates: this.deleteManyTemplates.bind(this),
        uploadTemplate: this.uploadTemplate.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  setEmailService(emailService: EmailService) {
    this.emailService = emailService;
  }

  async uploadTemplate(call: RouterRequest, callback: RouterResponse){
    const { _id } = JSON.parse(
      call.request.params
    );

    if( isNil(_id)) {
      return callback({
        code: status.INTERNAL,
        message: 'id must be provided!',
      });
    }

    let errorMessage;

    const templateDocument = await this.database
      .findOne('EmailTemplate', { _id: _id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    const template = {
      name: templateDocument.name,
      body: templateDocument.body,
    }
    const created = await (this.emailService.createExternalTemplate(template) as any)
      .catch((e: any) => (errorMessage = e.message));
    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    if(templateDocument){
      templateDocument['externalManaged'] = true;
      templateDocument['externalId'] = created.id;
      await this.database
        .findByIdAndUpdate('EmailTemplate',_id,templateDocument)
        .catch((e: any) => (errorMessage = e.message));

      if (!isNil(errorMessage))
        return callback({
          code: status.INTERNAL,
          message: errorMessage,
        });
    }
    return callback(null, { result: JSON.stringify({ created }) });
  }

  async syncExternalTemplates(call: RouterRequest, callback: RouterResponse){
    let errorMessage: string | null = null;
    const externalTemplates:any = await this.emailService.getExternalTemplates();

    let updated = [];
    let totalCount = 0;
    for ( let element of externalTemplates){

      const templateDocument = await this.database
      .findOne('EmailTemplate', { externalId: element.id })
      .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({
          code: status.INTERNAL,
          message: errorMessage,
        });

      if(!isNil(templateDocument)){ // if templateDocument exists
        const synchronized = {
          name: element.name,
          subject: element.versions[0].subject,
          externalId: element.id,
          variables: element.versions[0].variables,
          body: element.versions[0].body,
        }

        const updatedTemplate = await this.database
        .findByIdAndUpdate('EmailTemplate', templateDocument._id,synchronized)
        .catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage))
          return callback({
            code: status.INTERNAL,
            message: errorMessage,
          });
        updated.push(updatedTemplate);
      }
    }
    totalCount = updated.length;
    return callback(null, { result: JSON.stringify({ updated,totalCount }) });
  }
  async deleteManyTemplates(call: RouterRequest, callback: RouterResponse){
    const { ids } = JSON.parse(
      call.request.params
    );
    if (isNil(ids) || ids.length === 0) {
      return callback({
        code: status.INTERNAL,
        message: 'ids is required and must be an array',
      });
    }
    let errorMessage;
    let totalCount = ids.length;
    const templateDocuments = await this.database
      .findMany('EmailTemplate',{ _id: { $in: ids } })
      .catch((e:any) => (errorMessage = e.message));
    console.log(templateDocuments);
    if(!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }


    const foundDocuments = templateDocuments.length;
    if( foundDocuments !== totalCount){
        return callback({
          code: status.INTERNAL,
          message: 'some ids were not found',
        })
    }

    for( let template of templateDocuments){

      if( template.externalManaged){
        await this.emailService.deleteExternalTemplate(template.externalId)
          ?.catch((e:any) => (errorMessage= e.message));

        if(!isNil(errorMessage)){
          console.log(errorMessage);
          return callback({
            code: status.INTERNAL,
            message: errorMessage,
          });
        }
      }
    }
    console.log('edw')
    const deletedDocuments = await this.database
      .deleteMany('EmailTemplate',{ _id: { $in: ids } })
      .catch((e: any) => (errorMessage = e.message));

    if(!isNil(errorMessage)){
      console.log('edw');
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    return callback(null, { result: JSON.stringify({ deletedDocuments }) });
  }

  async getExternalTemplates(call: RouterRequest, callback: RouterResponse) {
    const [err, externalTemplates] = await to(
      this.emailService.getExternalTemplates() as any
    );
    if (!isNil(err)) {
      return callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
    if (isNil(externalTemplates)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Templates not found',
      });
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
    return callback(null, { result: JSON.stringify({ templateDocuments, totalCount }) });
  }

  async getTemplates(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit,search } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};
    let identifier;

    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }

    const templateDocumentsPromise = this.database.findMany(
      'EmailTemplate',
      query,
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
    const { _id, sender, externalManaged, name, subject, body } = JSON.parse(
      call.request.params
    );

    let externalId = undefined;
    const body_vars = getHBValues(body);
    const subject_vars = getHBValues(subject);

    let variables = Object.keys(body_vars).concat(Object.keys(subject_vars));
    variables = variables.filter(
      (value: any, index: any) => variables.indexOf(value) === index
    );

    if ((isNil(name) || isNil(subject) || isNil(body))) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }

    if (externalManaged) {

      if (isNil(_id)) {
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
      } else {
        externalId = _id;
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

    ['name', 'subject', 'body'].forEach((key) => {
      if (params[key]) {
        templateDocument[key] = params[key];
      }
    });

    templateDocument['variables'] = Object.keys(getHBValues(params.body)).concat(
      Object.keys(getHBValues(params.subject))
    );
    templateDocument['variables'] = templateDocument['variables'].filter(
      (value: any, index: any) => templateDocument['variables'].indexOf(value) === index
    );
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

  async deleteTemplate(call: RouterRequest, callback: RouterResponse){
    const params = JSON.parse(call.request.params);
    const id = params.id;

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
    await this.database
      .deleteOne('EmailTemplate',{_id:id})
      .catch((e:any) => (errorMessage = e.message));

    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    let deleted;
    if(templateDocument.externalManaged){
      deleted = await this.emailService.deleteExternalTemplate(templateDocument.externalId)
        ?.catch((e:any) => (errorMessage= e.message));
    }
    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    return callback(null, { result: JSON.stringify({ deleted }) });
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

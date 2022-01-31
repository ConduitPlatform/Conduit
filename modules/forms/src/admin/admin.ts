import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { Forms, FormReplies } from '../models';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FormsController } from '../controllers/forms.controller';
const escapeStringRegexp = require('escape-string-regexp');
let paths = require('./admin.json').functions;

export class AdminHandlers {

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly formsController: FormsController
  ) {
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getForms: this.getForms.bind(this),
        getRepliesByFormId: this.getRepliesByFormId.bind(this),
        createForm: this.createForm.bind(this),
        editFormById: this.editFormById.bind(this),
        deleteForms: this.deleteForms.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async deleteForms(call: RouterRequest, callback: RouterResponse){
    const { ids } = JSON.parse(call.request.params);
    if(  ids.length === 0 || isNil(ids)){
      return callback({
        code: status.INTERNAL,
        message: 'There is not array of ids',
      });
    }
    let errorMessage;
    const forms = await Forms.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => (errorMessage = e.message));

    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    const totalCount = (forms as any).deletedCount;
    return callback(null, { result: JSON.stringify({ forms,totalCount }) });
  }
  async getForms(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit,search } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {}
    let identifier;
    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options: 'i'};
    }

    const formsPromise = Forms.getInstance()
      .findMany(
        query,
        undefined,
        skipNumber,
        limitNumber
      );
    const countPromise = Forms.getInstance().countDocuments({});

    let errorMessage: string | null = null;
    const [forms, count] = await Promise.all([formsPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ forms, count }) });
  }

  async getRepliesByFormId(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, formId } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const repliesPromise = FormReplies.getInstance()
      .findMany(
        { form: formId },
        undefined,
        skipNumber,
        limitNumber
      );
    const countPromise = FormReplies.getInstance().countDocuments({ form: formId });

    let errorMessage: string | null = null;
    const [replies, count] = await Promise.all([repliesPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ replies, count }) });
  }

  async createForm(call: RouterRequest, callback: RouterResponse) {
    const { name, fields, forwardTo, emailField, enabled } = JSON.parse(
      call.request.params
    );

    if (
      !name ||
      !forwardTo ||
      !emailField ||
      isNil(enabled) ||
      !fields ||
      Object.keys(fields).length === 0
    ) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message:
          'Required data not provided missing name, fields or fields is not a filled array',
      });
    }
    let error = null;
    Object.keys(fields).forEach((r) => {
      if (['String', 'File', 'Date', 'Number'].indexOf(fields[r]) === -1) {
        error = true;
      }
    });

    if (error) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message:
          'Fields object should contain fields that have their value as a type of: String, File, Date, Number',
      });
    }
    error = null;
    Forms.getInstance()
      .create({
        name,
        fields,
        forwardTo,
        emailField,
        enabled,
      })
      .catch((e: any) => (error = e.message));
    if (!isNil(error))
      return callback({
        code: status.INTERNAL,
        message: error,
      });

    this.formsController.refreshRoutes();

    return callback(null, { result: 'Ok' });
  }

  async editFormById(call: RouterRequest, callback: RouterResponse) {
    const { formId, name, fields, forwardTo, emailField, enabled } = JSON.parse(
      call.request.params
    );

    if (
      !formId ||
      !name ||
      !forwardTo ||
      !emailField ||
      isNil(enabled) ||
      !fields ||
      Object.keys(fields).length === 0
    ) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message:
          'Required data not provided missing name, fields or fields is not a filled array',
      });
    }

    let error = null;
    Object.keys(fields).forEach((r) => {
      if (['String', 'File', 'Date', 'Number'].indexOf(fields[r]) === -1) {
        error = true;
      }
    });

    if (error) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message:
          'Fields object should contain fields that have their value as a type of: String, File, Date, Number',
      });
    }

    error = null;
    Forms.getInstance()
      .findByIdAndUpdate(formId, {
        name,
        fields,
        forwardTo,
        emailField,
        enabled,
      })
      .catch((e: any) => (error = e.message));
    if (!isNil(error))
      return callback({
        code: status.INTERNAL,
        message: error,
      });
    this.formsController.refreshRoutes();

    return callback(null, { result: 'Ok' });
  }
}

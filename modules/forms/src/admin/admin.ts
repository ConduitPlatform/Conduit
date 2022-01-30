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
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FormsController } from '../controllers/forms.controller';
import { Forms, FormReplies } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly formsController: FormsController
  ) {
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getForms: this.getForms.bind(this),
        createForm: this.createForm.bind(this),
        updateForm: this.updateForm.bind(this),
        deleteForms: this.deleteForms.bind(this),
        getFormReplies: this.getFormReplies.bind(this),
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
          path: '/forms',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetForms', {
          forms: [Forms.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getForms'
      ),
      constructConduitRoute(
        {
          path: '/forms',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            fields: ConduitJson.Required,
            forwardTo: ConduitString.Required,
            emailField: ConduitString.Required,
            enabled: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateForm', 'String'),
        'createForm'
      ),
      constructConduitRoute(
        {
          path: '/forms/:formId',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            formId: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Required,
            fields: ConduitJson.Required,
            forwardTo: ConduitString.Required,
            emailField: ConduitString.Required,
            enabled: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('UpdateForm', 'String'),
        'updateForm'
      ),
      constructConduitRoute(
        {
          path: '/forms',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          }
        },
        new ConduitRouteReturnDefinition('DeleteForms', {
          forms: [Forms.getInstance().fields],
          count: ConduitString.Required,
        }),
        'deleteForms'
      ),
      constructConduitRoute(
        {
          path: '/replies',
          action: ConduitRouteActions.GET,
          queryParams: {
            formId: ConduitString.Required,
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetFormReplies', {
          replies: [FormReplies.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getFormReplies'
      ),
    ];
  }

  async getForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {}
    let identifier;
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options: 'i'};
    }
    const formsPromise = Forms.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
      );
    const countPromise = Forms.getInstance().countDocuments({});
    const [forms, count] = await Promise.all([formsPromise, countPromise]).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );
    return { forms, count };
  }

  async createForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (Object.keys(call.request.params.fields).length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Fields object cannot be empty');
    }
    Object.keys(call.request.params.fields).forEach((r) => {
      if (['String', 'File', 'Date', 'Number'].indexOf(call.request.params.fields[r]) === -1) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Fields object should contain fields that have their value as a type of: String, File, Date, Number');
      }
    });
    const formExists = await Forms.getInstance()
      .findOne({ name: call.request.params.name })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (formExists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Form name already taken');
    }
    Forms.getInstance()
      .create({
        name: call.request.params.name,
        fields: call.request.params.fields,
        forwardTo: call.request.params.forwardTo,
        emailField: call.request.params.emailField,
        enabled: call.request.params.enabled,
      })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.formsController.refreshRoutes();
    return 'Ok';
  }

  async updateForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (Object.keys(call.request.params.fields).length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Fields object cannot be empty');
    }
    Object.keys(call.request.params.fields).forEach((r) => {
      if (['String', 'File', 'Date', 'Number'].indexOf(call.request.params.fields[r]) === -1) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Fields object should contain fields that have their value as a type of: String, File, Date, Number');
      }
    });
    Forms.getInstance()
      .findByIdAndUpdate(call.request.params.formId, {
        name: call.request.params.name,
        fields: call.request.params.fields,
        forwardTo: call.request.params.forwardTo,
        emailField: call.request.params.emailField,
        enabled: call.request.params.enabled,
      })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.formsController.refreshRoutes();
    return 'Ok';
  }

  async deleteForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (call.request.params.ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    const forms = await Forms.getInstance()
      .deleteMany({ _id: { $in: call.request.params.ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    const totalCount = (forms as any).deletedCount;
    return { forms, totalCount };
  }

  async getFormReplies(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const repliesPromise = FormReplies.getInstance()
      .findMany(
        { form: call.request.params.formId },
        undefined,
        skip,
        limit,
      );
    const countPromise = FormReplies.getInstance().countDocuments({ form: call.request.params.formId });
    const [replies, count] = await Promise.all([repliesPromise, countPromise]).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );
    return { replies, count };
  }
}

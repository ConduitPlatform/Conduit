import ConduitGrpcSdk, {
  GrpcServer,
  DatabaseProvider,
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
import { isNil } from 'lodash';
import { FormsController } from '../controllers/forms.controller';
import { Forms, FormReplies } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  private readonly database: DatabaseProvider;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly formsController: FormsController
  ) {
    this.database = this.grpcSdk.databaseProvider!;
    Forms.getInstance(this.database);
    FormReplies.getInstance(this.database);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getManyForms: this.getManyForms.bind(this),
        createForm: this.createForm.bind(this),
        editForm: this.editForm.bind(this),
        deleteManyForms: this.deleteManyForms.bind(this),
        getManyFormReplies: this.getManyFormReplies.bind(this),
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
          path: '/get',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetManyForms', {
          forms: [Forms.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getManyForms'
      ),
      constructConduitRoute(
        {
          path: '/new',
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
          path: '/update/:formId',
          action: ConduitRouteActions.UPDATE, // works as PATCH (frontend compat)
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
        new ConduitRouteReturnDefinition('EditForm', 'String'),
        'editForm'
      ),
      constructConduitRoute(
        {
          path: '/delete',
          action: ConduitRouteActions.DELETE,
          bodyParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          }
        },
        new ConduitRouteReturnDefinition('DeleteManyForms', {
          forms: [Forms.getInstance().fields],
          totalCount: ConduitString.Required,
        }),
        'deleteManyForms'
      ),
      constructConduitRoute(
        {
          path: '/replies/:formId',
          action: ConduitRouteActions.GET,
          urlParams: {
            formId: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetManyFormReplies', {
          replies: [FormReplies.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getManyFormReplies'
      ),
    ];
  }

  async getManyForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(call.request.params.skip)) {
      skipNumber = Number.parseInt(call.request.params.skip as string);
    }
    if (!isNil(call.request.params.limit)) {
      limitNumber = Number.parseInt(call.request.params.limit as string);
    }
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
        skipNumber,
        limitNumber
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

  async editForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
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

  async deleteManyForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (isNil(call.request.params.ids) || call.request.params.ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    const forms = await Forms.getInstance()
      .deleteMany({ _id: { $in: call.request.params.ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    const totalCount = (forms as any).deletedCount;
    return { forms, totalCount };
  }

  async getManyFormReplies(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(call.request.params.skip)) {
      skipNumber = Number.parseInt(call.request.params.skip as string);
    }
    if (!isNil(call.request.params.limit)) {
      limitNumber = Number.parseInt(call.request.params.limit as string);
    }
    const repliesPromise = FormReplies.getInstance()
      .findMany(
        { form: call.request.params.formId },
        undefined,
        skipNumber,
        limitNumber
      );
    const countPromise = FormReplies.getInstance().countDocuments({ form: call.request.params.formId });
    const [replies, count] = await Promise.all([repliesPromise, countPromise]).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );
    return { replies, count };
  }
}

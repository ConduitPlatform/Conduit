import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  Query,
  RouteOptionType,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FormsController } from '../controllers/forms.controller';
import { FormReplies, Forms } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly formsController: FormsController,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async getForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<Forms> = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query = { name: { $regex: `.*${identifier}.*`, $options: 'i' } };
    }
    const formsPromise = Forms.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const countPromise = Forms.getInstance().countDocuments(query);
    const [forms, count] = await Promise.all([formsPromise, countPromise]).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { forms, count };
  }

  async createForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.formFieldsChecks(call);
    const formExists = await Forms.getInstance()
      .findOne({ name: call.request.params.name })
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    this.formsController.refreshRoutes();
    ConduitGrpcSdk.Metrics?.increment('forms_total');
    return 'Ok';
  }

  async updateForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.formFieldsChecks(call);
    Forms.getInstance()
      .findByIdAndUpdate(call.request.params.formId, {
        name: call.request.params.name,
        fields: call.request.params.fields,
        forwardTo: call.request.params.forwardTo,
        emailField: call.request.params.emailField,
        enabled: call.request.params.enabled,
      })
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    this.formsController.refreshRoutes();
    return 'Ok';
  }

  async deleteForms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (call.request.params.ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    const forms = await Forms.getInstance()
      .deleteMany({ _id: { $in: call.request.params.ids } })
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const totalCount = forms.deletedCount;
    ConduitGrpcSdk.Metrics?.decrement('forms_total', totalCount);
    return { forms, totalCount };
  }

  async getFormReplies(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const repliesPromise = FormReplies.getInstance().findMany(
      { form: call.request.params.formId },
      undefined,
      skip,
      limit,
      sort,
    );
    const countPromise = FormReplies.getInstance().countDocuments({
      form: call.request.params.formId,
    });
    const [replies, count] = await Promise.all([repliesPromise, countPromise]).catch(
      e => {
        throw new GrpcError(status.INTERNAL, e.message);
      },
    );
    return { replies, count };
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/forms',
        action: ConduitRouteActions.GET,
        description: `Returns queried forms and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetForms', {
        forms: [Forms.name],
        count: ConduitNumber.Required,
      }),
      this.getForms.bind(this),
    );
    this.routingManager.route(
      {
        path: '/forms',
        action: ConduitRouteActions.POST,
        description: `Creates a new form.`,
        bodyParams: {
          name: ConduitString.Required,
          fields: ConduitJson.Required,
          forwardTo: ConduitString.Required,
          emailField: ConduitString.Required,
          enabled: ConduitBoolean.Required,
        },
      },
      new ConduitRouteReturnDefinition('Forms', 'String'),
      this.createForm.bind(this),
    );
    this.routingManager.route(
      {
        path: '/forms/:formId',
        action: ConduitRouteActions.UPDATE,
        description: `Updates a form.`,
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
      this.updateForm.bind(this),
    );
    this.routingManager.route(
      {
        path: '/forms',
        action: ConduitRouteActions.DELETE,
        description: `Deletes queried forms.`,
        queryParams: {
          ids: { type: [TYPE.String], required: true }, // handler array check is still required
        },
      },
      new ConduitRouteReturnDefinition('DeleteForms', {
        forms: [Forms.name],
        count: ConduitString.Required,
      }),
      this.deleteForms.bind(this),
    );
    this.routingManager.route(
      {
        path: '/replies/:formId',
        action: ConduitRouteActions.GET,
        description: `Returns queried form replies and their total count.`,
        urlParams: {
          formId: { type: RouteOptionType.String, required: true },
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetFormReplies', {
        replies: [FormReplies.name],
        count: ConduitNumber.Required,
      }),
      this.getFormReplies.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  private formFieldsChecks(call: ParsedRouterRequest) {
    if (Object.keys(call.request.params.fields).length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Fields object cannot be empty');
    }
    Object.keys(call.request.params.fields).forEach(r => {
      if (
        ['String', 'File', 'Date', 'Number'].indexOf(call.request.params.fields[r]) === -1
      ) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Fields object should contain fields that have their value as a type of: String, File, Date, Number',
        );
      }
    });
  }
}

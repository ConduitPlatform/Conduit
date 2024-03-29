import {
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { constructAssignment, constructQuery } from './utils.js';
import { constructSortObj } from '../utils.js';
import { status } from '@grpc/grpc-js';
import { ICustomEndpoint, PopulatedCustomEndpoint } from '../../interfaces/index.js';
import { isNil } from 'lodash-es';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { OperationsEnum } from '../../enums/index.js';

export class CustomEndpointHandler {
  private static routeControllers: Indexable = {};

  constructor(
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  static addNewCustomOperationControl(
    endpoint: ICustomEndpoint | PopulatedCustomEndpoint,
  ) {
    CustomEndpointHandler.routeControllers[endpoint.name] = endpoint;
  }

  entryPoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    //use it to find the right controller
    const path = call.request.path.split('/')[3];
    const endpoint: ICustomEndpoint = CustomEndpointHandler.routeControllers[path];
    const params = call.request.params;
    const scope = call.request.queryParams.scope;
    let searchQuery: Indexable = {};
    let createString = '';

    if (endpoint.operation !== OperationsEnum.POST) {
      try {
        searchQuery = constructQuery(endpoint.query, {
          inputs: endpoint.inputs,
          params: params,
          context: call.request.context,
        });
      } catch (e) {
        throw new GrpcError(status.INTERNAL, (e as Error).message);
      }
    }

    if (
      endpoint.operation === OperationsEnum.POST ||
      endpoint.operation === OperationsEnum.PUT ||
      endpoint.operation === OperationsEnum.PATCH
    ) {
      endpoint.assignments!.forEach(
        (r: {
          schemaField: string;
          action: number;
          assignmentField: { type: string; value: any };
        }) => {
          if (r.assignmentField.type === 'Input') {
            if (isNil(params[r.assignmentField.value])) {
              const res = endpoint.inputs.filter(input => {
                return input.name === r.assignmentField.value && input.optional;
              });
              if (res && res.length > 0) {
                return;
              }
              throw new GrpcError(
                status.INTERNAL,
                `Field ${r.assignmentField.value} is missing from input`,
              );
            }
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(params[r.assignmentField.value]),
            );
            createString += ',';
          } else if (r.assignmentField.type === 'Context') {
            if (isNil(call.request.context)) {
              throw new GrpcError(
                status.INTERNAL,
                `Field ${r.assignmentField.value} is missing from context`,
              );
            }
            let context = call.request.context;
            for (const key of r.assignmentField.value.split('.')) {
              if (context.hasOwnProperty(key)) {
                context = context[key];
              } else {
                throw new GrpcError(
                  status.INTERNAL,
                  `Field ${r.assignmentField.value} is missing from context`,
                );
              }
            }
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(context),
            );
            createString += ',';
          } else {
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(r.assignmentField.value),
            );
            createString += ',';
          }
        },
      );
      while (createString.charAt(createString.length - 1) === ',') {
        createString = createString.slice(0, -1);
      }
    }

    let sort: { [field: string]: -1 | 1 } | undefined = undefined;
    if (endpoint.sorted && params.sort && params.sort.length > 0) {
      sort = constructSortObj(params.sort);
    }

    const createObj = JSON.parse(`{${createString}}`);
    let promise;
    if (endpoint.operation === OperationsEnum.GET) {
      if (endpoint.paginated) {
        const documentsPromise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.findMany(searchQuery, {
            skip: params['skip'],
            limit: params['limit'],
            scope,
            userId: call.request.context.user?._id,
            sort,
            populate: params['populate'],
          });
        const countPromise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.countDocuments(searchQuery, {
            scope,
            userId: call.request.context.user?._id,
          });
        promise = Promise.all([documentsPromise, countPromise]);
      } else {
        promise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.findMany(searchQuery, {
            sort,
            populate: params['populate'],
            scope,
            userId: call.request.context.user?._id,
          });
      }
    } else if (endpoint.operation === OperationsEnum.POST) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.create(createObj, { scope, userId: call.request.context.user?._id });
    } else if (endpoint.operation === OperationsEnum.PUT) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.updateMany(searchQuery, createObj, {
          scope,
          userId: call.request.context.user?._id,
        });
    } else if (endpoint.operation === OperationsEnum.DELETE) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.deleteMany(searchQuery, { scope, userId: call.request.context.user?._id });
    } else if (endpoint.operation === OperationsEnum.PATCH) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.updateMany(searchQuery, createObj, {
          scope,
          userId: call.request.context.user?._id,
        });
    } else {
      process.exit(-1);
    }

    return promise
      .then((r: any) => {
        if (endpoint.operation === OperationsEnum.POST) {
          r = [r];
        } else if (endpoint.operation === OperationsEnum.PUT) {
          // find a way to return updated documents
          r = ['Ok'];
        } else if (endpoint.operation === OperationsEnum.GET && endpoint.paginated) {
          r = {
            documents: r[0],
            count: r[1],
          };
        }
        return r;
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }
}

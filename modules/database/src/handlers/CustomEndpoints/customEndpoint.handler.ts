import {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { constructAssignment, constructQuery } from './utils';
import { status } from '@grpc/grpc-js';
import { ICustomEndpoint, PopulatedCustomEndpoint } from '../../interfaces';
import { OperationsEnum } from '../../admin/customEndpoints/customEndpoints.admin';
import { isNil } from 'lodash';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';

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
    let searchQuery: Indexable = {};
    let createString = '';

    if (endpoint.operation !== OperationsEnum.POST) {
      try {
        searchQuery = constructQuery(
          endpoint.query,
          endpoint.inputs,
          params,
          call.request.context,
        );
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
          if (createString.length !== OperationsEnum.GET) createString += ',';
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
          } else {
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(r.assignmentField.value),
            );
          }
        },
      );
    }

    let sort: string | undefined = undefined;
    if (endpoint.sorted && params.sort && params.sort.length > 0) {
      sort = params.sort;
    }

    const createObj = this.parseCreateQuery(createString);
    let promise;
    if (endpoint.operation === OperationsEnum.GET) {
      if (endpoint.paginated) {
        const documentsPromise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.findMany(
            searchQuery,
            params['skip'],
            params['limit'],
            undefined,
            sort,
            params['populate'],
          );
        const countPromise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.countDocuments(searchQuery);
        promise = Promise.all([documentsPromise, countPromise]);
      } else {
        promise = this.database
          .getSchemaModel(endpoint.selectedSchemaName)
          .model.findMany(
            searchQuery,
            undefined,
            undefined,
            undefined,
            sort,
            params['populate'],
          );
      }
    } else if (endpoint.operation === OperationsEnum.POST) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.create(createObj);
    } else if (endpoint.operation === OperationsEnum.PUT) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.updateMany(searchQuery, createObj);
    } else if (endpoint.operation === OperationsEnum.DELETE) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.deleteMany(searchQuery);
    } else if (endpoint.operation === OperationsEnum.PATCH) {
      promise = this.database
        .getSchemaModel(endpoint.selectedSchemaName)
        .model.updateMany(searchQuery, createObj, true);
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

  private parseCreateQuery(query: string) {
    // add brackets to each field
    const arr = query.split(',').map(val => `{${val}}`);
    const res: Indexable = {};
    for (const el of arr) {
      const tmp = JSON.parse(el);
      const key = Object.keys(tmp)[0];
      if (!key) continue;
      const innerKey = Object.keys(tmp[key])[0];
      if (!res.hasOwnProperty(key)) res[key] = tmp[key];
      else res[key][innerKey] = tmp[key][innerKey];
    }
    return res;
  }
}

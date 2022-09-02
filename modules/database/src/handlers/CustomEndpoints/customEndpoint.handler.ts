import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { constructAssignment, constructQuery } from './utils';
import { status } from '@grpc/grpc-js';
import { ICustomEndpoint, Sort } from '../../interfaces';
import { OperationsEnum } from '../../admin/customEndpoints/customEndpoints.admin';
import { isNil } from 'lodash';

export class CustomEndpointHandler {
  private static routeControllers: Indexable = {};

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  static addNewCustomOperationControl(endpoint: ICustomEndpoint) {
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

    let sortObj: Sort | null = null;
    if (endpoint.sorted && params.sort && params.sort.length > 0) {
      const sort = params.sort;
      sortObj = {};
      sort.forEach((sortVal: string) => {
        sortVal = sortVal.trim();
        if (sortVal.indexOf('-') !== -1) {
          (sortObj as Indexable)[sortVal.substr(1)] = -1;
        } else {
          (sortObj as Indexable)[sortVal] = 1;
        }
      });
    }

    const createObj = this.parseCreateQuery(createString);
    let promise;
    if (endpoint.operation === OperationsEnum.GET) {
      if (endpoint.paginated) {
        const documentsPromise = this.grpcSdk.databaseProvider!.findMany(
          endpoint.selectedSchemaName,
          searchQuery,
          undefined,
          params['skip'],
          params['limit'],
          sortObj as Sort,
          params['populate'],
        );
        const countPromise = this.grpcSdk.databaseProvider!.countDocuments(
          endpoint.selectedSchemaName,
          searchQuery,
        );
        promise = Promise.all([documentsPromise, countPromise]);
      } else {
        promise = this.grpcSdk.databaseProvider!.findMany(
          endpoint.selectedSchemaName,
          searchQuery,
          undefined,
          undefined,
          undefined,
          sortObj as Sort,
          params['populate'],
        );
      }
    } else if (endpoint.operation === OperationsEnum.POST) {
      promise = this.grpcSdk.databaseProvider!.create(
        endpoint.selectedSchemaName,
        createObj,
      );
    } else if (endpoint.operation === OperationsEnum.PUT) {
      promise = this.grpcSdk.databaseProvider!.updateMany(
        endpoint.selectedSchemaName,
        searchQuery,
        createObj,
      );
    } else if (endpoint.operation === OperationsEnum.DELETE) {
      promise = this.grpcSdk.databaseProvider!.deleteMany(
        endpoint.selectedSchemaName,
        searchQuery,
      );
    } else if (endpoint.operation === OperationsEnum.PATCH) {
      promise = this.grpcSdk.databaseProvider!.updateMany(
        endpoint.selectedSchemaName,
        searchQuery,
        createObj,
        true,
      );
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

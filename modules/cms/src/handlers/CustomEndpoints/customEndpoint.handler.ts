import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { constructAssignment, constructQuery } from './utils';
import grpc from 'grpc';
import { CustomEndpoint } from '../../models/customEndpoint';
import { isNil } from 'lodash';

export class CustomEndpointHandler {
  private static routeControllers: { [name: string]: any } = {};

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  static addNewCustomOperationControl(endpoint: CustomEndpoint) {
    CustomEndpointHandler.routeControllers[endpoint.name] = endpoint;
  }

  entryPoint(call: RouterRequest, callback: RouterResponse) {
    //use it to find the right controller
    let path = call.request.path.split('/')[3];
    let endpoint: CustomEndpoint = CustomEndpointHandler.routeControllers[path];
    let params = JSON.parse(call.request.params);
    let searchQuery: any = {};
    let createString = '';

    let stopExecution: boolean = false;
    // if operation is not POST (CREATE)
    if (endpoint.operation !== 1) {
      try {
        searchQuery = constructQuery(
          endpoint.query,
          endpoint.inputs,
          params,
          JSON.parse(call.request.context)
        );
      } catch (e) {
        return callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    }

    if (
      endpoint.operation === 1 ||
      endpoint.operation === 2 ||
      endpoint.operation === 4
    ) {
      endpoint.assignments!.forEach(
        (r: {
          schemaField: string;
          action: number;
          assignmentField: { type: string; value: any };
        }) => {
          if (stopExecution) return;
          if (createString.length !== 0) createString += ',';
          if (r.assignmentField.type === 'Input') {
            if (isNil(params[r.assignmentField.value])) {
              let res = endpoint.inputs.filter((input) => {
                return input.name === r.assignmentField.value && input.optional;
              });
              if (res && res.length > 0) {
                return;
              }
              stopExecution = true;
              return callback({
                code: grpc.status.INTERNAL,
                message: `Field ${r.assignmentField.value} is missing from input`,
              });
            }
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(params[r.assignmentField.value])
            );
          } else if (r.assignmentField.type === 'Context') {
            if (isNil(call.request.context)) {
              stopExecution = true;
              return callback({
                code: grpc.status.INTERNAL,
                message: `Field ${r.assignmentField.value} is missing from context`,
              });
            }
            let context: any = JSON.parse(call.request.context);
            for (const key of r.assignmentField.value.split('.')) {
              if (context.hasOwnProperty(key)) {
                context = context[key];
              } else {
                stopExecution = true;
                return callback({
                  code: grpc.status.INTERNAL,
                  message: `Field ${r.assignmentField.value} is missing from context`,
                });
              }
            }
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(context)
            );
          } else {
            createString += constructAssignment(
              r.schemaField,
              r.action,
              JSON.stringify(r.assignmentField.value)
            );
          }
        }
      );
    }
    if (stopExecution) return;
    let sortObj: any = null;
    if (endpoint.sorted && params.sort && params.sort.length > 0) {
      let sort = params.sort;
      sortObj = {};
      sort.forEach((sortVal: string) => {
        sortVal = sortVal.trim();
        if (sortVal.indexOf('-') !== -1) {
          sortObj[sortVal.substr(1)] = -1;
        } else {
          sortObj[sortVal] = 1;
        }
      });
    }

    let createObj = this.parseCreateQuery(createString);
    let promise;
    if (endpoint.operation === 0) {
      if (endpoint.paginated) {
        const documentsPromise = this.grpcSdk.databaseProvider!.findMany(
          endpoint.selectedSchemaName,
          searchQuery,
          undefined,
          params['skip'],
          params['limit'],
          sortObj,
          params['populate']
        );
        const countPromise = this.grpcSdk.databaseProvider!.countDocuments(
          endpoint.selectedSchemaName,
          searchQuery
        );

        promise = Promise.all([documentsPromise, countPromise]);
      } else {
        promise = this.grpcSdk.databaseProvider!.findMany(
          endpoint.selectedSchemaName,
          searchQuery,
          undefined,
          undefined,
          undefined,
          sortObj,
          params['populate']
        );
      }
    } else if (endpoint.operation === 1) {
      promise = this.grpcSdk.databaseProvider!.create(
        endpoint.selectedSchemaName,
        createObj
      );
    } else if (endpoint.operation === 2) {
      promise = this.grpcSdk.databaseProvider!.updateMany(
        endpoint.selectedSchemaName,
        searchQuery,
        createObj
      );
    } else if (endpoint.operation === 3) {
      promise = this.grpcSdk.databaseProvider!.deleteMany(
        endpoint.selectedSchemaName,
        searchQuery
      );
    } else if (endpoint.operation === 4) {
      promise = this.grpcSdk.databaseProvider!.updateMany(
        endpoint.selectedSchemaName,
        searchQuery,
        createObj,
        true
      );
    } else {
      process.exit(-1);
    }

    promise
      .then((r: any) => {
        if (endpoint.operation === 1) {
          r = [r];
        } else if (endpoint.operation === 2) {
          // find a way to return updated documents
          r = ['Ok'];
        } else if (endpoint.operation === 0 && endpoint.paginated) {
          r = {
            documents: r[0],
            documentsCount: r[1],
          };
          return callback(null, { result: JSON.stringify(r) });
        }
        callback(null, { result: JSON.stringify({ result: r }) });
      })
      .catch((err: any) => {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      });
  }

  private parseCreateQuery(query: string): any {
    // add brackets to each field
    let arr = query.split(',').map((val) => `{${val}}`);
    let res: any = {};
    for (const el of arr) {
      let tmp = JSON.parse(el);
      let key = Object.keys(tmp)[0];
      if (!key) continue;
      let innerKey = Object.keys(tmp[key])[0];
      if (!res.hasOwnProperty(key)) res[key] = tmp[key];
      else res[key][innerKey] = tmp[key][innerKey];
    }
    return res;
  }
}

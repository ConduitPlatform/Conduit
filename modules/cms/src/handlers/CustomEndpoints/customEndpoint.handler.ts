import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { constructQuery, constructAssignment, mergeQueries } from './utils';
import grpc from 'grpc';
import { CustomEndpoint } from '../../models/customEndpoint';
import { isNil } from 'lodash';

export class CustomEndpointHandler {
  private static routeControllers: { [name: string]: any } = {};

  static addNewCustomOperationControl(endpoint: CustomEndpoint) {
    CustomEndpointHandler.routeControllers[endpoint.name] = endpoint;
  }

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  entryPoint(call: any, callback: any) {
    //use it to find the right controller
    let path = call.request.path.split('/')[3];
    let endpoint: CustomEndpoint = CustomEndpointHandler.routeControllers[path];
    let params = JSON.parse(call.request.params);
    let searchQuery: any = {};
    let searchStrings: string[] = [];
    let createString = '';

    let stopExecution: boolean = false;
    // if operation is not POST (CREATE)
    if (endpoint.operation !== 1) {
      endpoint.queries!.forEach(
        (r: {
          schemaField: string;
          operation: number;
          comparisonField: { type: string; value: any };
        }) => {
          if (stopExecution) return;
          if (r.comparisonField.type === 'Input') {
            if (isNil(params[r.comparisonField.value])) {
              stopExecution = true;
              return callback({
                code: grpc.status.INTERNAL,
                message: `Field ${r.comparisonField.value} is missing from input`,
              });
            }
            searchStrings.push(
              constructQuery(
                r.schemaField,
                r.operation,
                JSON.stringify(params[r.comparisonField.value])
              )
            );
          } else if (r.comparisonField.type === 'Context') {
            if (isNil(call.request.context)) {
              stopExecution = true;
              return callback({
                code: grpc.status.INTERNAL,
                message: `Field ${r.comparisonField.value} is missing from context`,
              });
            }
            let context: any = JSON.parse(call.request.context);
            for (const key of r.comparisonField.value.split('.')) {
              if (context.hasOwnProperty(key)) {
                context = context[key];
              } else {
                stopExecution = true;
                return callback({
                  code: grpc.status.INTERNAL,
                  message: `Field ${r.comparisonField.value} is missing from context`,
                });
              }
            }
            searchStrings.push(
              constructQuery(r.schemaField, r.operation, JSON.stringify(context))
            );
          } else {
            searchStrings.push(
              constructQuery(
                r.schemaField,
                r.operation,
                JSON.stringify(r.comparisonField.value)
              )
            );
          }
        }
      );
      searchQuery = mergeQueries(searchStrings);
    }

    if (stopExecution) return;

    if (endpoint.operation === 1 || endpoint.operation === 2) {
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
      sort.split(',').forEach((sortVal: string) => {
        sortVal = sortVal.trim();
        if (sortVal.indexOf('-') !== -1) {
          sortObj[sortVal.substr(1)] = -1;
        } else {
          sortObj[sortVal] = 1;
        }
      });
    }

    createString = '{' + createString + '}';
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
        JSON.parse(createString)
      );
    } else if (endpoint.operation === 2) {
      promise = this.grpcSdk.databaseProvider!.updateMany(
        endpoint.selectedSchemaName,
        searchQuery,
        JSON.parse(createString)
      );
    } else if (endpoint.operation === 3) {
      promise = this.grpcSdk.databaseProvider!.deleteMany(
        endpoint.selectedSchemaName,
        searchQuery
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
}

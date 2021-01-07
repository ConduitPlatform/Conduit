import { ConduitRouteActions } from "@quintessential-sft/conduit-grpc-sdk";
import { CustomEndpoint } from "../../models/customEndpoint";

export function getOpName(name: string, op: number) {
  let operation;
  switch (op) {
    case 0:
      operation = ConduitRouteActions.GET;
      break;
    case 1:
      operation = ConduitRouteActions.POST;
      break;
    case 2:
      operation = ConduitRouteActions.UPDATE;
      break;
    case 3:
      operation = ConduitRouteActions.DELETE;
      break;
    // won't ever be called by TS doesn't care about that
    default:
      operation = ConduitRouteActions.GET;
      break;
  }
  return operation + name;
}

export function constructQuery(schemaField: string, operation: number, comparisonField: any) {
  //   EQUAL: 0, //'equal to'
  //   NEQUAL: 1, //'not equal to'
  //   GREATER: 2, //'greater than'
  //   GREATER_EQ: 3, //'greater that or equal to'
  //   LESS: 4, //'less than'
  //   LESS_EQ: 5, //'less that or equal to'
  //   EQUAL_SET: 6, //'equal to any of the following'
  //   NEQUAL_SET: 7, //'not equal to any of the following'
  //   CONTAIN: 8, //'an array containing'
  switch (operation) {
    case 0:
      return `\"${schemaField}\":${comparisonField}`;
    case 1:
      return `\"${schemaField}\":{ \"$ne\": ${comparisonField}}`;
    case 2:
      return `\"${schemaField}\":{ \"$gt\": ${comparisonField}}`;
    case 3:
      return `\"${schemaField}\":{ \"$gte\": ${comparisonField}}`;
    case 4:
      return `\"${schemaField}\":{ \"$lt\": ${comparisonField}}`;
    case 5:
      return `\"${schemaField}\":{ \"$lte\": ${comparisonField}}`;
    case 6:
      return `\"${schemaField}\":{ \"$in\": ${comparisonField}}`;
    case 7:
      return `\"${schemaField}\":{ \"$nin\": ${comparisonField}}`;
    // maybe something else??
    case 8:
      return `\'${schemaField}\':{ \"$in\": ${comparisonField}}`;
    default:
      return `\'${schemaField}\':${comparisonField}`;
  }
}

export function constructAssignment(schemaField: string, action: number, assignmentValue: any) {
  //   SET: 0,
  //   INCREMENT: 1,
  //   DECREMENT: 2,
  //   APPEND: 3,
  //   REMOVE: 4
  switch (action) {
    case 0:
      return `\"${schemaField}\": ${assignmentValue}`;
    case 1:
      return `\"$inc\": { \"${schemaField}\": ${assignmentValue} }`;
    case 2:
      return `\"$inc\": { \"${schemaField}\": -${assignmentValue} }`;
    case 3:
      return `\"$push\": { \"${schemaField}\": ${assignmentValue} }`
    case 4:
      return `\"$pull\": { \"${schemaField}\": ${assignmentValue} }`
    default:
      return `\"${schemaField}\": ${assignmentValue}`;
  }
}

export function createController(endpoint: CustomEndpoint) {
  let inputString = "";
  // will probably need the addition of parsing
  endpoint.inputs.forEach((r: { name: string; type: string; location: number }) => {
    inputString += `let ${r.name} = call.request.params.${r.name};`;
  });

  let searchString = "";
  if (endpoint.operation !== 1) {
    endpoint.queries!.forEach(
      (r: { schemaField: string; operation: number; comparisonField: { type: string; value: any } }) => {
        if (searchString.length !== 0) searchString += ",";
        searchString += constructQuery(r.schemaField, r.operation, r.comparisonField);
      }
    );
  }

  try {
    return new Function(
      "grpcSdk",
      "call",
      "callback",
      ` 
      return grpcSdk.database.findOne(\'SchemaDefinitions\', {_id: ${endpoint.selectedSchema}})
        .then((r)=>{
            grpcSdk.database.findMany(r.name, {}})
        })
        .then((r)=>{
            callback(null, {result: JSON.stringify(r)})
        })
        .catch((err)=>{
            callback({code: grpc.status.INTERNAL, message: err.message})
        })
    `
    );
  } catch (err) {
    console.log(err);
    return null;
  }
}

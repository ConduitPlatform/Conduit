import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE,
} from "@quintessential-sft/conduit-grpc-sdk";
import { CustomEndpoint } from "../../models/customEndpoint";

function getOperation(op: number) {
  switch (op) {
    case 0:
      return ConduitRouteActions.GET;
    case 1:
      return ConduitRouteActions.POST;
    case 2:
      return ConduitRouteActions.UPDATE;
    case 3:
      return ConduitRouteActions.DELETE;
    // won't ever be called by TS doesn't care about that
    default:
      return ConduitRouteActions.GET;
  }
}

function extractParams(inputs: { name: string; type: string; location: number }[]) {
  let resultingObject: any = {};
  inputs.forEach((r: { name: string; type: string; location: number }) => {
    //body
    if (r.location === 0) {
      if (!resultingObject["bodyParams"]) resultingObject["bodyParams"] = {};
      resultingObject["bodyParams"][r.name] = r.type;
    }
    // query params
    else if (r.location === 1) {
      if (!resultingObject["queryParams"]) resultingObject["queryParams"] = {};
      resultingObject["queryParams"][r.name] = r.type;
    }
    // urlParams
    else {
      if (!resultingObject["urlParams"]) resultingObject["urlParams"] = {};
      resultingObject["urlParams"][r.name] = r.type;
    }
  });
  return resultingObject;
}

export function createCustomEndpointRoute(endpoint: CustomEndpoint) {
  let input = {
    path: `/customOperation/${endpoint.name}`,
    action: getOperation(endpoint.operation),
    middlewares: endpoint.authentication ? ["authMiddleware"] : undefined,
  };
  let inputs = endpoint.inputs;
  let returns: any = [endpoint.returns];
  if (endpoint.paginated) {
    inputs.push({
      name: "skip",
      type: TYPE.Number,
      location: 1,
    });
    inputs.push({
      name: "limit",
      type: TYPE.Number,
      location: 1,
    });
    returns = {
      documents: [endpoint.returns],
      documentsCount: TYPE.Number,
    };
  }
  if(endpoint.sorted){
    inputs.push({
      name: "sort",
      type: TYPE.String,
      location: 1
    })
  }
  Object.assign(input, extractParams(endpoint.inputs));
  return constructRoute(
    new ConduitRoute(
      input,
      new ConduitRouteReturnDefinition(input.action + endpoint.name, { result: returns }),
      "customOperation"
    )
  );
}

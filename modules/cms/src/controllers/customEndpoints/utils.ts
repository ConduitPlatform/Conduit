import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { CustomEndpoint } from '../../models/customEndpoint';

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

function extractParams(
  inputs: {
    name: string;
    type: string;
    location: number;
    optional?: boolean;
    array?: boolean;
  }[]
) {
  let resultingObject: any = {};
  inputs.forEach(
    (r: {
      name: string;
      type: string;
      location: number;
      optional?: boolean;
      array?: boolean;
    }) => {
      let placement = '';
      //body
      if (r.location === 0) {
        if (!resultingObject['bodyParams']) resultingObject['bodyParams'] = {};
        placement = 'bodyParams';
      }
      // query params
      else if (r.location === 1) {
        if (!resultingObject['queryParams']) resultingObject['queryParams'] = {};
        placement = 'queryParams';
      }
      // urlParams
      else {
        if (!resultingObject['urlParams']) resultingObject['urlParams'] = {};
        placement = 'urlParams';
      }
      resultingObject[placement][r.name] = {
        type: r.type,
        required: r.optional ? r.optional : true,
      };
    }
  );
  return resultingObject;
}

export function createCustomEndpointRoute(endpoint: CustomEndpoint) {
  let input: ConduitRouteOptions = {
    path: `/function/${endpoint.name}`,
    action: getOperation(endpoint.operation),
    middlewares: endpoint.authentication ? ['authMiddleware'] : undefined,
    cacheControl: undefined,
  };
  let inputs = endpoint.inputs;
  let returns: any = { result: [endpoint.returns] };
  if (input.action === ConduitRouteActions.GET) {
    input.cacheControl = endpoint.authentication
      ? 'private, max-age=10'
      : 'public, max-age=10';
  }
  if (endpoint.paginated) {
    inputs.push({
      name: 'skip',
      type: TYPE.Number,
      location: 1,
    });
    inputs.push({
      name: 'limit',
      type: TYPE.Number,
      location: 1,
    });
    returns = {
      documents: [endpoint.returns],
      documentsCount: TYPE.Number,
    };
  }
  if (endpoint.sorted) {
    inputs.push({
      name: 'sort',
      type: TYPE.String,
      location: 1,
    });
  }
  Object.assign(input, extractParams(endpoint.inputs));
  return constructRoute(
    new ConduitRoute(
      input,
      new ConduitRouteReturnDefinition(input.action + endpoint.name, returns),
      'customOperation'
    )
  );
}

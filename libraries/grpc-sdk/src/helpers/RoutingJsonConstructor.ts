import { ConduitRouteReturnDefinition } from '../classes';
import { ConduitRouteOptions } from '../interfaces';


export function constructConduitRoute(
  input: ConduitRouteOptions,
  type: ConduitRouteReturnDefinition,
  handler: string,
) {
  let routeObject: any = {
    options: input,
    returns: {
      name: type.name,
      fields: JSON.stringify(type.fields),
    },
    grpcFunction: handler,
  };
  if (!routeObject.options.middlewares) {
    routeObject.options.middlewares = [];
  }
  if (!routeObject.options.middlewares) {
    routeObject.options.middlewares = [];
  }
  for (let option in routeObject.options) {
    if (!routeObject.options.hasOwnProperty(option)) continue;
    if (option === 'middlewares') continue;
    routeObject.options[option] = JSON.stringify(routeObject.options[option]);
  }
  return routeObject;
}


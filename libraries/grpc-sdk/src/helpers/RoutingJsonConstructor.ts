import { ConduitMiddleware, ConduitRoute, ConduitSocket } from '../classes';
import { EventsProtoDescription, SocketProtoDescription } from '../interfaces';

export function constructRoute(route: ConduitRoute) {
  let routeObject: any = {
    options: {},
    returns: {},
    grpcFunction: '',
  };
  routeObject.grpcFunction = route.handler;
  routeObject.options = route.input;
  routeObject.returns = {
    name: route.returnTypeName,
    fields: JSON.stringify(route.returnTypeFields),
  };
  for (let option in routeObject.options) {
    if (!routeObject.options.hasOwnProperty(option)) continue;
    if (option === 'middlewares') continue;
    routeObject.options[option] = JSON.stringify(routeObject.options[option]);
  }

  return routeObject;
}
export function constructMiddleware(route: ConduitMiddleware) {
  let routeObject: any = {
    options: {},
    grpcFunction: '',
  };
  routeObject.grpcFunction = route.handler;
  routeObject.options = route.input.path ? route.input : null;
  routeObject.options.middlewares = [];

  for (let option in routeObject.options) {
    if (!routeObject.options.hasOwnProperty(option)) continue;
    routeObject.options[option] = JSON.stringify(routeObject.options[option]);
  }

  return routeObject;
}

export function constructSocket(socket: ConduitSocket) {
  let eventsObj: EventsProtoDescription = {};

  Object.keys(socket.events).forEach((eventName: string) => {
    const event = socket.events[eventName];
    eventsObj[eventName] = {
      grpcFunction: event.handler,
      params: JSON.stringify(event.params),
      returns: {
        name: socket.returnTypeName(eventName),
        fields: JSON.stringify(socket.returnTypeFields(eventName)),
      },
    };
  });

  return {
    options: socket.input,
    events: JSON.stringify(eventsObj),
  };
}

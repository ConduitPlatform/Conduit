import { RouteBuilder } from './RouteBuilder.js';
import {
  RequestHandlers,
  SocketEventHandler,
  SocketRequestHandlers,
} from './wrapRouterFunctions.js';
import { wrapFunctionsAsync } from './RoutingUtilities.js';
import {
  Admin,
  ConduitMiddlewareOptions,
  ConduitRouteActions,
  ConduitRouteObject,
  ConduitRouteOptions,
  ConduitGrpcSdk,
  ConduitRouteReturnDefinition,
  ConduitSocketOptions,
  Indexable,
  EventsProtoDescription,
  Router,
  SocketProtoDescription,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '../classes/ModuleError.js';
import { authErrors } from '../utilities/authErrors.js';
import { GrpcServer } from '../classes/index.js';
import { createUserHydrator, UserHydrator, UserResolver } from './hydrateUser.js';
import { RoutingController } from './RoutingController.js';

export class RoutingManager {
  private _moduleRoutes: {
    [key: string]: ConduitRouteObject | SocketProtoDescription;
  } = {};
  static ClientController: RoutingController;
  static AdminController: RoutingController;
  /** Set by ManagedModule; used to hydrate context.user on client routes. */
  static grpcSdk?: ConduitGrpcSdk;
  private static userResolver?: UserResolver;
  private static warnedNoResolver = false;

  /**
   * Overrides how users are fetched for hydration (default: grpcSdk.authentication.getUser).
   * Intended for the module that owns the users: the authentication module has no gRPC
   * client to itself and will register a local resolver here.
   */
  static setUserResolver(resolver: UserResolver | undefined) {
    RoutingManager.userResolver = resolver;
  }

  private static resolveUser(): UserResolver | undefined {
    if (RoutingManager.userResolver) return RoutingManager.userResolver;
    const sdk = RoutingManager.grpcSdk;
    if (!sdk) return undefined;
    return async (userId: string) => {
      const auth = sdk.authentication;
      if (!auth) {
        throw new ModuleError(authErrors.USER_LOOKUP_UNAVAILABLE);
      }
      return auth.getUser(userId);
    };
  }

  private _routeHandlers: {
    [key: string]: RequestHandlers | SocketRequestHandlers;
  } = {};
  private readonly isAdmin: boolean = false;

  constructor(
    private readonly _router: Router | Admin,
    private readonly _server: GrpcServer,
  ) {
    if (_router instanceof Admin) {
      this.isAdmin = true;
    }
  }

  get(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.GET).path(path);
  }

  post(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.POST).path(path);
  }

  delete(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.DELETE).path(path);
  }

  update(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.UPDATE).path(path);
  }

  patch(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.PATCH).path(path);
  }

  clear() {
    this._moduleRoutes = {};
    this._routeHandlers = {};
  }

  middleware(input: ConduitMiddlewareOptions, handler: RequestHandlers) {
    const routeObject: ConduitRouteObject = this.parseRouteObject({
      options: input,
      grpcFunction: input.name,
    }) as ConduitRouteObject;
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  route(
    input: ConduitRouteOptions,
    type: ConduitRouteReturnDefinition,
    handler: RequestHandlers,
  ) {
    const routeObject: ConduitRouteObject = this.parseRouteObject({
      options: input,
      returns: {
        name: type.name,
        fields: JSON.stringify(type.fields),
      },
      grpcFunction: this.generateGrpcName(input),
    }) as ConduitRouteObject;
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  socket(input: ConduitSocketOptions, events: Record<string, SocketEventHandler>) {
    const eventsObj: EventsProtoDescription = {};
    const routeObject: SocketProtoDescription = this.parseRouteObject({
      options: input,
      events: '',
    }) as SocketProtoDescription;
    let primary: string;
    Object.keys(events).forEach((eventName: string) => {
      if (!primary) primary = eventName;
      const event = events[eventName];
      eventsObj[eventName] = {
        grpcFunction: eventName,
        params: JSON.stringify(event.params),
        returns: {
          name: event.returnType?.name ?? '',
          fields: JSON.stringify(event.returnType?.fields),
        },
      };
      this._routeHandlers[eventName] = event.handler;
    });
    routeObject.events = JSON.stringify(eventsObj);

    this._moduleRoutes[primary!] = routeObject;
  }

  async registerRoutes() {
    if (Object.keys(this._routeHandlers).length === 0) return;
    const hydrations: { [name: string]: { options: Indexable; hydrator: UserHydrator } } =
      {};
    if (!this.isAdmin) {
      for (const [name, route] of Object.entries(this._moduleRoutes)) {
        const options = (route as ConduitRouteObject).options as Indexable;
        const hydrator = createUserHydrator(options, RoutingManager.resolveUser);
        if (!hydrator) continue;
        // A socket route is keyed by its first event; every event handler hydrates.
        const names =
          'events' in route
            ? Object.keys(JSON.parse((route as SocketProtoDescription).events || '{}'))
            : [name];
        for (const n of names) hydrations[n] = { options, hydrator };
        if (
          !RoutingManager.grpcSdk &&
          !RoutingManager.userResolver &&
          !RoutingManager.warnedNoResolver
        ) {
          RoutingManager.warnedNoResolver = true;
          ConduitGrpcSdk.Logger.warn(
            'User hydration is needed but RoutingManager.grpcSdk is not set; hydration will fail',
          );
        }
      }
    }
    const modifiedFunctions: {
      [name: string]: (call: any, callback: any) => void;
    } = wrapFunctionsAsync(
      this._routeHandlers,
      this.isAdmin ? 'admin' : 'client',
      hydrations,
      this.declaredErrors(),
    );
    if (this.isAdmin) {
      RoutingManager.AdminController.setRoutes(modifiedFunctions);
    } else {
      RoutingManager.ClientController.setRoutes(modifiedFunctions);
    }
    const paths = Object.values(this._moduleRoutes);
    return this._router.register(paths as unknown as any);
  }

  /** conduitCodes each HTTP route lists in its `errors` option, keyed by handler name. */
  private declaredErrors(): { [name: string]: ReadonlySet<string> } {
    const declared: { [name: string]: ReadonlySet<string> } = {};
    for (const [name, route] of Object.entries(this._moduleRoutes)) {
      if ('events' in route) continue;
      const errors = (route as ConduitRouteObject).options?.errors;
      if (!Array.isArray(errors)) continue;
      declared[name] = new Set(errors.map(e => e.conduitCode));
    }
    return declared;
  }

  private generateGrpcName(options: ConduitRouteOptions) {
    if (options.name) {
      return options.name.charAt(0).toUpperCase() + options.name.slice(1);
    } else {
      const name =
        options.action.charAt(0) +
        options.action.slice(1).toLowerCase() +
        this.extractNameFromPath(options.path);
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  private extractNameFromPath(path: string) {
    path = path.replace(/[-:]/g, '/');
    return path
      .split('/')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private parseRouteObject(
    routeObject: any,
  ): ConduitRouteObject | SocketProtoDescription {
    if (!routeObject.options.middlewares) {
      routeObject.options.middlewares = [];
    }
    for (const option in routeObject.options) {
      if (!routeObject.options.hasOwnProperty(option)) continue;
      if (option === 'middlewares' || option === 'errors') continue;
      if (
        typeof routeObject.options[option] === 'string' ||
        routeObject.options[option] instanceof String
      )
        continue;
      if (
        typeof routeObject.options[option] === 'boolean' ||
        routeObject.options[option] instanceof Boolean
      )
        continue;
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
    return routeObject;
  }
}

import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { RouterAdmin } from './router.js';
import { SecurityAdmin } from './security.js';
import { EventRelayAdmin } from './event-relays.js';
import { errors } from '../errors.js';
import ConduitDefaultRouter from '../Router.js';
import { Client, EventRelay } from '../models/index.js';
import { EventRelayManager } from '../event-relays/EventRelayManager.js';

export class AdminHandlers {
  private readonly routerAdmin: RouterAdmin;
  private readonly securityAdmin: SecurityAdmin;
  private readonly eventRelayAdmin: EventRelayAdmin;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
    eventRelayManager: EventRelayManager,
  ) {
    this.routerAdmin = new RouterAdmin(this.grpcSdk, router);
    this.securityAdmin = new SecurityAdmin(this.grpcSdk);
    this.eventRelayAdmin = new EventRelayAdmin(eventRelayManager);
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    this.routingManager.clear();

    this.routingManager.route(
      {
        path: '/router/middlewares',
        action: ConduitRouteActions.GET,
        description: `Returns middleware.`,
        queryParams: {
          sortByName: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetMiddlewares', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/router/route-middlewares',
        action: ConduitRouteActions.GET,
        errors: [errors.INVALID_ROUTE_ACTION, errors.GRPC_ROUTE_NOT_FOUND],
        description: `Returns the middleware of an app route.`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetAppRouteMiddleware', {
        middlewares: [TYPE.String],
      }),
      this.routerAdmin.getRouteMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/router/patch-middleware',
        action: ConduitRouteActions.PATCH,
        errors: [
          errors.INVALID_ROUTE_ACTION,
          errors.GRPC_ROUTE_NOT_FOUND,
          errors.MIDDLEWARE_PATCH_FAILED,
        ],
        description: `Patches the middleware of an app route.`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
        },
        bodyParams: {
          middlewares: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('PatchAppMiddleware', 'String'),
      this.routerAdmin.patchRouteMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/routes',
        action: ConduitRouteActions.GET,
        description: `Returns available routes.`,
      },
      new ConduitRouteReturnDefinition('GetRoutes', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getRoutes.bind(this.routerAdmin),
    );

    this.routingManager.route(
      {
        path: '/security/client',
        action: ConduitRouteActions.POST,
        errors: [
          errors.PLATFORM_NOT_SUPPORTED,
          errors.INVALID_CLIENT_ALIAS,
          errors.CLIENT_ALIAS_TAKEN,
          errors.CLIENT_DOMAIN_REQUIRED,
          errors.INVALID_CLIENT_DOMAIN,
        ],
        description: `Creates a security client.`,
        bodyParams: {
          platform: ConduitString.Required,
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateSecurityClient', Client.name),
      this.securityAdmin.createSecurityClient.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a security client.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteSecurityClient', {
        message: ConduitString.Required,
      }),
      this.securityAdmin.deleteSecurityClient.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client',
        action: ConduitRouteActions.GET,
        description: `Returns security clients.`,
      },
      new ConduitRouteReturnDefinition('GetSecurityClients', {
        clients: [Client.name],
      }),
      this.securityAdmin.getSecurityClients.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client/:id',
        urlParams: {
          id: ConduitString.Required,
        },
        action: ConduitRouteActions.UPDATE,
        errors: [
          errors.SECURITY_CLIENT_NOT_FOUND,
          errors.INVALID_CLIENT_ALIAS,
          errors.CLIENT_ALIAS_TAKEN,
          errors.CLIENT_DOMAIN_REQUIRED,
          errors.INVALID_CLIENT_DOMAIN,
        ],
        description: `Updates a security client.`,
        bodyParams: {
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateSecurityClient', Client.name),
      this.securityAdmin.updateSecurityClient.bind(this.securityAdmin),
    );

    this.routingManager.route(
      {
        path: '/event-relays',
        action: ConduitRouteActions.GET,
        description: `Returns event-to-socket relays. Delivery is ephemeral Redis pub/sub with no replay.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetEventRelays', {
        relays: [EventRelay.name],
        count: ConduitNumber.Required,
      }),
      this.eventRelayAdmin.listEventRelays.bind(this.eventRelayAdmin),
    );
    this.routingManager.route(
      {
        path: '/event-relays/:id',
        action: ConduitRouteActions.GET,
        errors: [errors.EVENT_RELAY_NOT_FOUND],
        description: `Returns a single event-to-socket relay.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition(EventRelay.name),
      this.eventRelayAdmin.getEventRelay.bind(this.eventRelayAdmin),
    );
    this.routingManager.route(
      {
        path: '/event-relays',
        action: ConduitRouteActions.POST,
        errors: [
          errors.EVENT_RELAY_NAME_TAKEN,
          errors.EVENT_RELAY_FIELD_REQUIRED,
          errors.EVENT_RELAY_NAME_INVALID,
          errors.EVENT_RELAY_NOTES_INVALID,
          errors.EVENT_RELAY_BUS_EVENT_INVALID,
          errors.EVENT_RELAY_SOCKET_EVENT_INVALID,
          errors.EVENT_RELAY_RESOURCE_TYPE_INVALID,
          errors.EVENT_RELAY_PATH_INVALID,
          errors.EVENT_RELAY_PERMISSION_INVALID,
          errors.EVENT_RELAY_TEMPLATE_INVALID,
        ],
        description: `Creates an event-to-socket relay. Clients subscribe on /events/ after a ReBAC check.`,
        bodyParams: {
          name: ConduitString.Required,
          notes: ConduitString.Optional,
          active: ConduitBoolean.Optional,
          busEvent: ConduitString.Required,
          socketEvent: ConduitString.Required,
          resourceType: ConduitString.Required,
          resourceIdPath: ConduitString.Required,
          permission: ConduitString.Required,
          messageTemplate: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition('CreateEventRelay', EventRelay.name),
      this.eventRelayAdmin.createEventRelay.bind(this.eventRelayAdmin),
    );
    this.routingManager.route(
      {
        path: '/event-relays/:id',
        action: ConduitRouteActions.PATCH,
        errors: [
          errors.EVENT_RELAY_NOT_FOUND,
          errors.EVENT_RELAY_NAME_TAKEN,
          errors.EVENT_RELAY_FIELD_REQUIRED,
          errors.EVENT_RELAY_NAME_INVALID,
          errors.EVENT_RELAY_NOTES_INVALID,
          errors.EVENT_RELAY_BUS_EVENT_INVALID,
          errors.EVENT_RELAY_SOCKET_EVENT_INVALID,
          errors.EVENT_RELAY_RESOURCE_TYPE_INVALID,
          errors.EVENT_RELAY_PATH_INVALID,
          errors.EVENT_RELAY_PERMISSION_INVALID,
          errors.EVENT_RELAY_TEMPLATE_INVALID,
        ],
        description: `Updates an event-to-socket relay.`,
        urlParams: {
          id: ConduitString.Required,
        },
        bodyParams: {
          name: ConduitString.Optional,
          notes: ConduitString.Optional,
          active: ConduitBoolean.Optional,
          busEvent: ConduitString.Optional,
          socketEvent: ConduitString.Optional,
          resourceType: ConduitString.Optional,
          resourceIdPath: ConduitString.Optional,
          permission: ConduitString.Optional,
          messageTemplate: ConduitJson.Optional,
        },
      },
      new ConduitRouteReturnDefinition('PatchEventRelay', EventRelay.name),
      this.eventRelayAdmin.patchEventRelay.bind(this.eventRelayAdmin),
    );
    this.routingManager.route(
      {
        path: '/event-relays/:id',
        action: ConduitRouteActions.DELETE,
        errors: [errors.EVENT_RELAY_NOT_FOUND],
        description: `Deletes an event-to-socket relay.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteEventRelay', {
        message: ConduitString.Required,
      }),
      this.eventRelayAdmin.deleteEventRelay.bind(this.eventRelayAdmin),
    );
    this.routingManager.route(
      {
        path: '/event-relays/preview',
        action: ConduitRouteActions.POST,
        errors: [
          errors.EVENT_RELAY_SAMPLE_PAYLOAD_INVALID,
          errors.EVENT_RELAY_TEMPLATE_INVALID,
          errors.EVENT_RELAY_PAYLOAD_PATH_NOT_FOUND,
          errors.EVENT_RELAY_RENDERED_MESSAGE_TOO_LARGE,
          errors.EVENT_RELAY_PATH_INVALID,
        ],
        description: `Renders a relay message template against sample bus JSON (same engine as runtime).`,
        bodyParams: {
          messageTemplate: ConduitJson.Required,
          samplePayload: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition('PreviewEventRelay', {
        rendered: ConduitJson.Required,
      }),
      this.eventRelayAdmin.previewEventRelay.bind(this.eventRelayAdmin),
    );
    this.routingManager.registerRoutes();
  }
}
